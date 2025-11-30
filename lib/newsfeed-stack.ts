import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';

export class NewsFeedStack extends cdk.Stack {
  public readonly unifiedTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get stream ARNs from context
    const notesStreamArn = this.node.tryGetContext('notesStreamArn');
    const contactsStreamArn = this.node.tryGetContext('contactsStreamArn');

    // Create the unified DynamoDB table
    this.unifiedTable = new dynamodb.Table(this, 'Unified_Table', {
      tableName: 'NewsFeed_Unified_Table',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying by source type and time (for newsfeed)
    this.unifiedTable.addGlobalSecondaryIndex({
      indexName: 'GSI1_Source_Type_Created_At',
      partitionKey: {
        name: 'source_type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying all items by time (global newsfeed)
    this.unifiedTable.addGlobalSecondaryIndex({
      indexName: 'GSI2_Record_Type_Created_At',
      partitionKey: {
        name: 'record_type',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create Lambda for notes stream processing
    const notesProcessor = new lambdaNodejs.NodejsFunction(this, 'Notes_Stream_Processor', {
      functionName: 'NewsFeed_Notes_Processor',
      description: 'Processes DynamoDB stream events from nexusnote-notes-production table',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/lambdas/notes-stream-processor/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        UNIFIED_TABLE_NAME: this.unifiedTable.tableName,
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Create Lambda for contacts stream processing
    const contactsProcessor = new lambdaNodejs.NodejsFunction(this, 'Contacts_Stream_Processor', {
      functionName: 'NewsFeed_Contacts_Processor',
      description: 'Processes DynamoDB stream events from nexusnote-inno-contacts-production table',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/lambdas/contacts-stream-processor/handler.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        UNIFIED_TABLE_NAME: this.unifiedTable.tableName,
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant write permissions to unified table
    this.unifiedTable.grantReadWriteData(notesProcessor);
    this.unifiedTable.grantReadWriteData(contactsProcessor);

    // Grant read permissions on source table streams
    notesProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeStream',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:ListStreams',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/nexusnote-notes-production/stream/*`,
      ],
    }));

    contactsProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeStream',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:ListStreams',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/nexusnote-inno-contacts-production/stream/*`,
      ],
    }));

    // Grant KMS decrypt permissions for encrypted source tables
    const kmsKeyArn = `arn:aws:kms:${this.region}:${this.account}:key/7e61921e-4255-4ec5-99e5-05efb9850bbb`;
    
    notesProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: ['kms:Decrypt', 'kms:DescribeKey'],
      resources: [kmsKeyArn],
    }));

    contactsProcessor.addToRolePolicy(new iam.PolicyStatement({
      actions: ['kms:Decrypt', 'kms:DescribeKey'],
      resources: [kmsKeyArn],
    }));

    // Add DynamoDB Stream event sources if stream ARNs are provided
    if (notesStreamArn) {
      const notesSourceTable = dynamodb.Table.fromTableAttributes(this, 'Notes_Source_Table', {
        tableArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/nexusnote-notes-production`,
        tableStreamArn: notesStreamArn,
      });

      notesProcessor.addEventSource(
        new lambdaEventSources.DynamoEventSource(notesSourceTable, {
          startingPosition: lambda.StartingPosition.TRIM_HORIZON,
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.seconds(5),
          retryAttempts: 3,
          bisectBatchOnError: true,
          reportBatchItemFailures: true,
        })
      );
    }

    if (contactsStreamArn) {
      const contactsSourceTable = dynamodb.Table.fromTableAttributes(this, 'Contacts_Source_Table', {
        tableArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/nexusnote-inno-contacts-production`,
        tableStreamArn: contactsStreamArn,
      });

      contactsProcessor.addEventSource(
        new lambdaEventSources.DynamoEventSource(contactsSourceTable, {
          startingPosition: lambda.StartingPosition.TRIM_HORIZON,
          batchSize: 10,
          maxBatchingWindow: cdk.Duration.seconds(5),
          retryAttempts: 3,
          bisectBatchOnError: true,
          reportBatchItemFailures: true,
        })
      );
    }

    // Outputs
    new cdk.CfnOutput(this, 'Unified_Table_Name', {
      value: this.unifiedTable.tableName,
      description: 'Name of the unified DynamoDB table',
      exportName: 'NewsFeed-Unified-Table-Name',
    });

    new cdk.CfnOutput(this, 'Unified_Table_Arn', {
      value: this.unifiedTable.tableArn,
      description: 'ARN of the unified DynamoDB table',
      exportName: 'NewsFeed-Unified-Table-Arn',
    });

    new cdk.CfnOutput(this, 'Notes_Processor_Arn', {
      value: notesProcessor.functionArn,
      description: 'ARN of the notes stream processor Lambda',
    });

    new cdk.CfnOutput(this, 'Contacts_Processor_Arn', {
      value: contactsProcessor.functionArn,
      description: 'ARN of the contacts stream processor Lambda',
    });

    // Reminder output if streams not configured
    if (!notesStreamArn || !contactsStreamArn) {
      new cdk.CfnOutput(this, 'Streams_Reminder', {
        value: 'Enable DynamoDB Streams on source tables, then redeploy with stream ARNs',
        description: 'Action required to complete stream processing setup',
      });
    }
  }
}
