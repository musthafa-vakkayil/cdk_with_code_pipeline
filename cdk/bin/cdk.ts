#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { HBTechnicalSupportServcieStack } from '../lib/stacks/hb-technical-stack';
import environmentConfig from '../environments/stack-config';
import { CodePipelineStack } from '../lib/stacks/codepipeline-stack';


const app = new cdk.App();
new HBTechnicalSupportServcieStack(app, 'HBTechnicalSupportServcieStack', {});
new CodePipelineStack(app, 'CodePipelineStack', environmentConfig)