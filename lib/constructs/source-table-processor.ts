import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export interface SourceTableProcessorProps {
  /** Name of the source DynamoDB table */
  sourceTableName: string;
  
  /** Stream ARN of the source table (must have streams enabled) */
  sourceTableStreamArn: string;
  
  /** The unified table to write to */
  unifiedTable: dynamodb.ITable;
  
  /** Path to the Lambda handler file */
  handlerEntry: string;
  
  /** Environment name (dev, staging, prod) */
  environment: string;
  
  /** Short identifier for the processor (e.g., 'notes', 'contacts') */
  processorId: string;
  
  /** Description for the Lambda function */
  description: string;
}

/**
 * Construct that creates a Lambda function to process DynamoDB Stream events
 * from a source table and sync to the unified table.
 */
export class SourceTableProcessor extends Construct {
  public readonly processorFunction: lambdaNodejs.NodejsFunction;

  constructor(scope: Construct, id: string, props: SourceTableProcessorProps) {
    super(scope, id);

    const {
      sourceTableName,
      sourceTableStreamArn,
      unifiedTable,
      handlerEntry,
      environment,
      processorId,
      description,
    } = props;

    // Create the Lambda function
    this.processorFunction = new lambdaNodejs.NodejsFunction(this, 'ProcessorFunction', {
      functionName: `newsfeed-${processorId}-processor-${environment}`,
      description,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: handlerEntry,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        UNIFIED_TABLE_NAME: unifiedTable.tableName,
        SOURCE_TABLE_NAME: sourceTableName,
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant write permissions to unified table
    unifiedTable.grantReadWriteData(this.processorFunction);

    // Grant read permissions on source table stream
    this.processorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeStream',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:ListStreams',
      ],
      resources: [sourceTableStreamArn],
    }));

    // Add DynamoDB Stream as event source
    this.processorFunction.addEventSource(
      new lambdaEventSources.DynamoEventSource(
        dynamodb.Table.fromTableAttributes(this, 'SourceTable', {
          tableArn: `arn:aws:dynamodb:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:table/${sourceTableName}`,
          tableStreamArn: sourceTableStreamArn,
        }),
        {
          startingPosition: lambda.StartingPosition.TRIM_HORIZON,
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.seconds(5),
          retryAttempts: 3,
          bisectBatchOnError: true,
          reportBatchItemFailures: true,
        }
      )
    );

    // Output the function ARN
    new cdk.CfnOutput(this, `${processorId}ProcessorArn`, {
      value: this.processorFunction.functionArn,
      description: `ARN of the ${processorId} stream processor Lambda`,
    });
  }
}

