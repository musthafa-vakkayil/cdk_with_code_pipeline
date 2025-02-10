import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import CONFIG from "../../config/lambda-config";
import lambdaPolicyJson from "../policies/lambdaPolicy.json";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigateway from "aws-cdk-lib/aws-apigateway";

export class HBTechnicalSupportServcieStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // artifacts bucket
    new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `${CONFIG.artifact.BUCKET_NAME}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Change this if you want to auto-delete the bucket on stack deletion
    });

    const bucketName = new cdk.CfnParameter(this, 'bucketName', {
      type: 'String',
      default: '',
      description: 'S3 Bucket name where Codepipeline will store lambda code'
    })

    const bucketKey = new cdk.CfnParameter(this, 'bucketKey', {
      type: 'String',
      default: '',
      description: 'S3 bucket key which Codepipeline will use to store lambda code'
    })

    const bucket = s3.Bucket.fromBucketName(this, 'pipeline-bucket', bucketName.valueAsString)

    // policy for service lambda
    const lambdaPolicyJsonFinal = JSON.parse(
      JSON.stringify(lambdaPolicyJson)
        .replaceAll("${AWS_ACCOUNT_ID}", this.account)
        .replaceAll("${AWS_REGION}", this.region)
        .replaceAll("${ARTIFACT_BUCKET_NAME}", CONFIG.artifact.BUCKET_NAME)
    );

    const executionPolicy = new iam.ManagedPolicy(this, "LambdaExecutionPolicy", {
      managedPolicyName: `${CONFIG.lambda.FUNCTION_NAME}-execution-policy`,
      description: "Policy used for codepipeline",
      document: iam.PolicyDocument.fromJson(lambdaPolicyJsonFinal),
    });

    // role for service lambda
    const executionRole = new iam.Role(this, "FunctionExecutionRole", {
      roleName: `${CONFIG.lambda.FUNCTION_NAME}-lambda-role`,
      description: `Execution role for ${CONFIG.lambda.FUNCTION_NAME} lambda function`,
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [executionPolicy],
    });


    const serviceLambda = new lambda.Function(this, `${CONFIG.lambda.FUNCTION_NAME}`, {
      functionName: CONFIG.lambda.FUNCTION_NAME,
      code: lambda.Code.fromBucket(bucket, bucketKey.valueAsString),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128,
      role: executionRole
    });

    // Api gateway
    // create api gateway
    const api = new apigateway.RestApi(this, 'RestAPI', {
      restApiName: "test",
      description: "test-description",
      deploy: false,
    })

    // Create a resource and method with authorizer
    const resource = api.root.addResource('{proxy+}');

    // Enable CORS only on the proxy resource
    resource.addCorsPreflight({
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });

    resource.addMethod('ANY', new apigateway.LambdaIntegration(serviceLambda), {});

    // Create API Gateway Deployment and Stage
    new apigateway.Deployment(this, 'ApiDeployment', {
      api: api,
      stageName: process.env.ENV
    });
  }
}
