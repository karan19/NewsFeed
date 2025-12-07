import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface StreamEnablerProps {
  /** Name of the DynamoDB table to enable streams on */
  tableName: string;

  /** Unique identifier for this enabler (used in Lambda naming) */
  processorId: string;

  /** KMS Key ARN if the table is encrypted (optional) */
  kmsKeyArn?: string;
}

/**
 * Custom construct that enables DynamoDB Streams on an existing table
 * 
 * This uses a CloudFormation Custom Resource to:
 * 1. Check if streams are already enabled
 * 2. Enable streams if not (with NEW_AND_OLD_IMAGES view type)
 * 3. Return the stream ARN for use by other resources
 */
export class StreamEnabler extends Construct {
  /** The stream ARN of the table (available after streams are enabled) */
  public readonly streamArn: string;

  /** The table name */
  public readonly tableName: string;

  constructor(scope: Construct, id: string, props: StreamEnablerProps) {
    super(scope, id);

    this.tableName = props.tableName;

    // Create the Lambda function that will enable streams
    // Use processorId to ensure unique function names per table
    const pascalCaseId = props.processorId
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    const enablerFunction = new lambdaNodejs.NodejsFunction(this, 'EnablerFunction', {
      functionName: `NewsFeed-${pascalCaseId}-StreamEnabler`,
      description: `Enables DynamoDB Streams on ${props.tableName} for NewsFeed`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../../src/lambdas/enable-stream-handler/handler.ts'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant permissions to describe and update DynamoDB tables
    enablerFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeTable',
        'dynamodb:UpdateTable',
      ],
      resources: [
        `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${props.tableName}`,
      ],
    }));

    // Grant KMS permissions if table is encrypted
    if (props.kmsKeyArn) {
      enablerFunction.addToRolePolicy(new iam.PolicyStatement({
        actions: ['kms:Decrypt', 'kms:DescribeKey'],
        resources: [props.kmsKeyArn],
      }));
    }

    // Create the Custom Resource provider
    const provider = new cr.Provider(this, 'Provider', {
      onEventHandler: enablerFunction,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Create the Custom Resource that triggers the Lambda
    const customResource = new cdk.CustomResource(this, 'EnableStream', {
      serviceToken: provider.serviceToken,
      properties: {
        TableName: props.tableName,
        // Add a timestamp to force update on each deploy (optional)
        // Timestamp: Date.now().toString(),
      },
    });

    // Get the stream ARN from the Custom Resource response
    this.streamArn = customResource.getAttString('StreamArn');
  }
}
