import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { StreamEnabler } from './constructs/stream-enabler';
import { getEnabledSourceTables, KMS_KEY_ARN, SourceTableConfig } from '../src/config/source-tables';

export class NewsFeedStack extends cdk.Stack {
  public readonly unifiedTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get enabled source tables from configuration
    const sourceTables = getEnabledSourceTables();

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

    // GSI for true Global Feed (across all types)
    this.unifiedTable.addGlobalSecondaryIndex({
      indexName: 'GSI3_Global_Feed',
      partitionKey: {
        name: 'gsi_global_pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create Feed Reader Lambda
    const feedReader = new lambdaNodejs.NodejsFunction(this, 'Feed_Reader', {
      functionName: 'NewsFeed_Reader',
      description: 'Reads the global newsfeed',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/lambdas/feed-reader/handler.ts'),
      timeout: cdk.Duration.seconds(10),
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

    this.unifiedTable.grantReadData(feedReader);

    // Create API Gateway
    const api = new apigateway.LambdaRestApi(this, 'NewsFeed_API', {
      handler: feedReader,
      proxy: false,
      restApiName: 'NewsFeed API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const feedResource = api.root.addResource('feed');
    feedResource.addMethod('GET'); // GET /feed

    // Outputs
    new cdk.CfnOutput(this, 'Api_Url', {
      value: api.url,
      description: 'API Gateway URL',
      exportName: 'NewsFeed-Api-Url',
    });


    // Create stream enabler and processor for each source table
    for (const tableConfig of sourceTables) {
      this.createStreamProcessor(tableConfig);
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

    new cdk.CfnOutput(this, 'Source_Tables_Count', {
      value: sourceTables.length.toString(),
      description: 'Number of source tables configured',
    });
  }

  /**
   * Create a stream enabler and Lambda processor for a source table
   */
  private createStreamProcessor(config: SourceTableConfig): void {
    const { processorId, tableName, description } = config;
    const constructId = this.toPascalCase(processorId);

    // Enable streams on the source table using Custom Resource
    const streamEnabler = new StreamEnabler(this, `${constructId}_Stream_Enabler`, {
      tableName: tableName,
      processorId: processorId,
      kmsKeyArn: KMS_KEY_ARN,
    });

    // Create Lambda processor for this source table
    const processor = new lambdaNodejs.NodejsFunction(this, `${constructId}_Stream_Processor`, {
      functionName: `NewsFeed_${constructId}_Processor`,
      description: description,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, `../src/lambdas/${processorId}-stream-processor/handler.ts`),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        UNIFIED_TABLE_NAME: this.unifiedTable.tableName,
        SOURCE_TABLE_NAME: tableName,
        LOG_LEVEL: 'INFO',
      },
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant write permissions to unified table
    this.unifiedTable.grantReadWriteData(processor);

    // Grant read permissions on source table stream
    processor.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'dynamodb:DescribeStream',
        'dynamodb:GetRecords',
        'dynamodb:GetShardIterator',
        'dynamodb:ListStreams',
      ],
      resources: [
        `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}/stream/*`,
      ],
    }));

    // Grant KMS decrypt permissions for encrypted source tables
    processor.addToRolePolicy(new iam.PolicyStatement({
      actions: ['kms:Decrypt', 'kms:DescribeKey'],
      resources: [KMS_KEY_ARN],
    }));

    // Import the source table with the stream ARN from the enabler
    const sourceTable = dynamodb.Table.fromTableAttributes(this, `${constructId}_Source_Table`, {
      tableArn: `arn:aws:dynamodb:${this.region}:${this.account}:table/${tableName}`,
      tableStreamArn: streamEnabler.streamArn,
    });

    // Add DynamoDB Stream event source
    processor.addEventSource(
      new lambdaEventSources.DynamoEventSource(sourceTable, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(5),
        retryAttempts: 3,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,
      })
    );

    // Output the processor ARN
    new cdk.CfnOutput(this, `${constructId}_Processor_Arn`, {
      value: processor.functionArn,
      description: `ARN of the ${processorId} stream processor Lambda`,
    });

    // Output the stream ARN
    new cdk.CfnOutput(this, `${constructId}_Stream_Arn`, {
      value: streamEnabler.streamArn,
      description: `Stream ARN for ${tableName}`,
    });
  }

  /**
   * Convert kebab-case or snake_case to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
