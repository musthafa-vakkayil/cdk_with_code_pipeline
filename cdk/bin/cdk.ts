#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { HBTechnicalSupportServcieStack } from '../lib/hb-technical-stack';
import environmentConfig from '../config/stack-config';
import { CodePipelineStack } from '../lib/codepipeline-stack';


const app = new cdk.App();
new HBTechnicalSupportServcieStack(app, 'HBTechnicalSupportServcieStack', {});
new CodePipelineStack(app, 'CodePipelineStack', environmentConfig)