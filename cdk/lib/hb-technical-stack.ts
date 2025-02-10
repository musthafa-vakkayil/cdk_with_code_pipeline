import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class HBTechnicalSupportServcieStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    new lambda.Function(this, "mylambda", {
      functionName: 'first-cdk-lambda',
      code: lambda.Code.fromBucket(bucket, `${bucketKey.valueAsString}/lambda.zip`),
      handler: 'dist/index.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 128
    })
  }
}
