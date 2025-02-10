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
import { IAwsCdkCodepipelineStackProps } from '../config/stack-config-types';

export class CodePipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: IAwsCdkCodepipelineStackProps) {
        super(scope, id, props);

        const role = new iam.Role(this, 'role', {
            roleName: props.role.name,
            description: props.role.description,
            assumedBy: new iam.CompositePrincipal(
                new iam.ServicePrincipal('cloudformation.amazonaws.com'),
                new iam.ServicePrincipal('codebuild.amazonaws.com'),
                new iam.ServicePrincipal('codepipeline.amazonaws.com'),
            ),
        });

        role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName(props.role.managedPolicy));

        /** KMS Key for S3 bucket encryption */
        const key = new kms.Key(this, 'key', { description: props.keyDescription, removalPolicy: cdk.RemovalPolicy.DESTROY });
        key.grantEncryptDecrypt(role);

        /* GitHub Token */
        const githubToken = secretsmanager.Secret.fromSecretNameV2(this, 'githubSecret', props.github.tokenSecretName);
        githubToken.grantRead(role);

        /* S3 Bucket for CodePipeline */
        const artifactBucket = new s3.Bucket(this, 'bucket', {
            bucketName: props.bucketname,
            encryptionKey: key,
            encryption: s3.BucketEncryption.KMS,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        artifactBucket.grantReadWrite(role);

        const source = new codepipeline.Artifact();
        const buildOutput = new codepipeline.Artifact('buildOutput');

        /* Unified CodeBuild Project */
        const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
            projectName: `${props.pipelineName}-Build`,
            role,
            encryptionKey: key,
            environment: { buildImage: codebuild.LinuxBuildImage.STANDARD_6_0 },
            buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec/buildspec.yml'),
            environmentVariables: {
                TARGET_STACK: { value: props.codebuild.targetStack },
            },
        });

        /* CodePipeline Actions */
        const githubSourceAction = new codepipeline_actions.GitHubSourceAction({
            actionName: "Checkout_Source",
            output: source,
            owner: props.github.owner,
            repo: props.github.repo,
            branch: props.github.branch,
            oauthToken: githubToken.secretValueFromJson('secret'),
            trigger: codepipeline_actions.GitHubTrigger.WEBHOOK,
            runOrder: 1,
        });

        const buildAction = new codepipeline_actions.CodeBuildAction({
            actionName: 'Build_CDK_Lambda',
            role,
            input: source,
            project: buildProject,
            outputs: [buildOutput],
            runOrder: 2,
        });

        const deployAction = new codepipeline_actions.CloudFormationCreateUpdateStackAction({
            actionName: 'Deploy_CDK',
            role,
            deploymentRole: role,
            adminPermissions: true,
            replaceOnFailure: true,
            stackName: props.codebuild.targetStack,
            templatePath: buildOutput.atPath(`cdk/dist/${props.codebuild.targetStack}.template.json`),
            extraInputs: [buildOutput],
            cfnCapabilities: [
                cdk.CfnCapabilities.NAMED_IAM,
                cdk.CfnCapabilities.AUTO_EXPAND,
            ],
            parameterOverrides: {
                bucketName: buildOutput.bucketName,
                bucketKey: buildOutput.atPath(`src/dist/`),
            },
            runOrder: 3,
        });

        const pipeline = new codepipeline.Pipeline(this, 'codepipeline', {
            pipelineName: props.pipelineName,
            role,
            artifactBucket,
            stages: [
                { stageName: 'Source', actions: [githubSourceAction] },
                { stageName: 'Build', actions: [buildAction] },
                { stageName: 'Deploy', actions: [deployAction] }
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
            topic.addSubscription(new sns_sub.EmailSubscription(email));
        });
    }
}