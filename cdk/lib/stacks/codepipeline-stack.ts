import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as notifications from 'aws-cdk-lib/aws-codestarnotifications';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_sub from 'aws-cdk-lib/aws-sns-subscriptions';
import { IAwsCdkCodepipelineStackProps } from '../../config/codepipeline-config-types';
import codepipelinePolicyJson from "../policies/codepipelinePolicy.json"

export class CodePipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: IAwsCdkCodepipelineStackProps) {
        super(scope, id, props);

        // create iam user
        const role = new iam.Role(this, 'codePipelineRole', {
            roleName: props.role.name,
            description: props.role.description,
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('cloudformation.amazonaws.com'),
                new iam.ServicePrincipal('codebuild.amazonaws.com'),
                new iam.ServicePrincipal('codepipeline.amazonaws.com'),
            ),
        });

        // Policy for codepipeline
        const codepipelinePolicyJsonFinal = JSON.parse(
            JSON.stringify(codepipelinePolicyJson)
                .replaceAll("${AWS_ACCOUNT_ID}", this.account)
                .replaceAll("${AWS_REGION}", this.region)
        );

        const executionPolicy = new iam.ManagedPolicy(this, "CodePipelinePolicy", {
            managedPolicyName: `code-pipeline-execution-policy`,
            description: "Policy used for codepipeline",
            document: iam.PolicyDocument.fromJson(codepipelinePolicyJsonFinal),
        });

        role.addManagedPolicy(executionPolicy)

        // role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(props.role.managedPolicy))

        /** KMS key used for s3 bucket in codepipeline */
        const key = new kms.Key(this, 'codepipelineKmsKey', { description: props.keyDescription, removalPolicy: cdk.RemovalPolicy.DESTROY })
        key.grantEncryptDecrypt(role)

        /* github token */
        const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'githubSecret', props.github.tokenSecretName);
        githubToken.grantRead(role);

        /* Codepipeline Artifacts and S3 bucket used in Codepipeline */
        const artifactBucket = new s3.Bucket(this, 'codepipelineBucket', {
            bucketName: props.bucketname,
            encryptionKey: key,
            encryption: cdk.aws_s3.BucketEncryption.KMS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        artifactBucket.grantReadWrite(role)

        const source = new codepipeline.Artifact();
        const templateOutput = new codepipeline.Artifact('template');
        const lambdaOutput = new codepipeline.Artifact('lambda');


        // CodeBuild Projects
        const templateBuildProject = new codebuild.PipelineProject(this, 'TemplateCodeBuild', {
            projectName: props.codebuild.templateProject,
            role,
            encryptionKey: key,
            environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_6_0 },
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec-template.yml'),
        });

        const lambdaBuildProject = new codebuild.PipelineProject(this, 'LambdaCodeBuild', {
            projectName: props.codebuild.lambdaProject,
            role,
            encryptionKey: key,
            environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_6_0 },
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec-lambda.yml'),
        });

        // CodePipeline Actions
        const githubSourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: 'CheckoutSourceCode',
            output: source,
            owner: props.github.owner,
            repo: props.github.repo,
            branch: props.github.branch,
            oauthToken: githubToken.secretValueFromJson('secret'),
            trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
            runOrder: 1,
        });

        const templateBuildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'BuildTemplate',
            role,
            input: source,
            project: templateBuildProject,
            outputs: [templateOutput],
            runOrder: 2,
            environmentVariables: {
                ENV: { value: props.environment, type: codebuild.BuildEnvironmentVariableType.PLAINTEXT },
                STACK_CONFIG: { value: props.lambdaSecretName, type: codebuild.BuildEnvironmentVariableType.PLAINTEXT }
            }
        });

        const lambdaBuildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'BuildLambda',
            role,
            input: source,
            project: lambdaBuildProject,
            outputs: [lambdaOutput],
            runOrder: 2,
        });

        const deployAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
            actionName: 'Deploying_Stack',
            role,
            deploymentRole: role,
            adminPermissions: true,
            replaceOnFailure: true,
            stackName: props.codebuild.targetStack,
            templatePath: templateOutput.atPath(`HBTechnicalSupportServcieStack.template.json`),
            extraInputs: [lambdaOutput],
            cfnCapabilities: [
                cdk.CfnCapabilities.NAMED_IAM,
                cdk.CfnCapabilities.AUTO_EXPAND,
            ],
            parameterOverrides: {
                bucketName: lambdaOutput.bucketName,
                bucketKey: lambdaOutput.objectKey,
            },
            runOrder: 3,
        });

        const pipeline = new codepipeline.Pipeline(this, 'codepipeline', {
            pipelineName: props.pipelineName,
            role,
            artifactBucket,
            stages: [
                {
                    stageName: 'Source',
                    actions: [githubSourceAction],
                },
                {
                    stageName: 'Build',
                    actions: [templateBuildAction, lambdaBuildAction]
                },
                {
                    stageName: 'Deploy',
                    actions: [deployAction]
                }
            ],
        });

        pipeline.addToRolePolicy(new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [role.roleArn],
        }));

        /* Notifications */
        const topic = new sns.Topic(this, 'topic', {
            topicName: props.topic.name,
        });
        topic.grantPublish(role);
        props.topic.subEmails.forEach(email => {
            const subscription = new sns_sub.EmailSubscription(email);
            topic.addSubscription(subscription)
        });

        [
            { source: templateBuildProject, name: 'template' },
            { source: lambdaBuildProject, name: 'lambda' },
        ].forEach(build => {
            return new notifications.NotificationRule(
                this,
                `${build.name}-notifications`,
                {
                    notificationRuleName: `${build.name}-notifications`,
                    source: build.source,
                    events: [
                        'codebuild-project-build-state-succeeded',
                        'codebuild-project-build-state-failed'
                    ],
                    targets: [topic],
                },
            );
        });
    }
}