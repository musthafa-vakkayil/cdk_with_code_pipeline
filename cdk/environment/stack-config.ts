import { IAwsCdkCodepipelineStackProps } from "../config/codepipeline-config-types";

const environmentConfig: IAwsCdkCodepipelineStackProps = {
    environment: "dev",
    lambdaSecretName: "hb-technical-secret",
    role: {
        name: 'codepipeline-role',
        description: 'Iam role for Codepipeline',
        managedPolicy: 'AdministratorAccess',
    },
    keyDescription: 'KMS Key used by Codepipeline',
    github: {
        tokenSecretName: 'cdk-token',
        owner: 'musthafa-vakkayil',
        repo: 'cdk_with_code_pipeline',
        branch: 'development',
    },
    codebuild: {
        templateProject: 'BuildTemplate',
        lambdaProject: 'buildLambda',
        targetStack: 'HBTechnicalSupportServcieStack',
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