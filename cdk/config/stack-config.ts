import { IAwsCdkCodepipelineStackProps } from "./stack-config-types";

const environmentConfig: IAwsCdkCodepipelineStackProps = {
    role: {
        name: 'codepipeline-role',
        description: 'Iam role for Codepipeline',
        managedPolicy: 'AdministratorAccess',
    },
    keyDescription: 'KMS Key used by Codepipeline',
    github: {
        tokenSecretName: 'cdk-token',
        owner: 'musthafa-vakkayil',
        repo: 'my_first_cdk_stack',
        branch: 'main',
    },
    codebuild: {
        templateProject: 'BuildTemplate',
        lambdaProject: 'buildLambda',
        targetStack: 'MyFirstCdkStackStack',
        targetLambda: 'index.js',
    },
    pipelineName: 'LambdaDeploymentPipeline',
    bucketname: 'sample-bucket-cdk-pipeline',
    topic: {
        name: 'codepipeline',
        subEmails: ['musthuvakkayil@gmail.com'],
    },
}

export default environmentConfig;