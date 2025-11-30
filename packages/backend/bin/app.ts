#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NewsFeedStack } from '../lib/newsfeed-stack';

const app = new cdk.App();

new NewsFeedStack(app, 'NewsFeed-Stack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  description: 'NewsFeed application - Unified DynamoDB table with Lambda-based synchronization',
  tags: {
    Project: 'NewsFeed',
    Environment: 'Production',
  },
});
