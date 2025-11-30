import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { NewsFeedStack } from '../lib/newsfeed-stack';

describe('NewsFeedStack', () => {
  let app: cdk.App;
  let stack: NewsFeedStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new NewsFeedStack(app, 'NewsFeed-Stack', {
      env: {
        account: '123456789012',
        region: 'us-west-2',
      },
    });
    template = Template.fromStack(stack);
  });

  test('Creates unified DynamoDB table with correct name', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'NewsFeed_Unified_Table',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('Unified table has point-in-time recovery enabled', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
    });
  });

  test('Unified table has DynamoDB streams enabled', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      StreamSpecification: {
        StreamViewType: 'NEW_AND_OLD_IMAGES',
      },
    });
  });

  test('Creates GSI for source type queries', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: expect.arrayContaining([
        expect.objectContaining({
          IndexName: 'GSI1_Source_Type_Created_At',
          KeySchema: [
            { AttributeName: 'source_type', KeyType: 'HASH' },
            { AttributeName: 'created_at', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  test('Creates GSI for record type queries', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: expect.arrayContaining([
        expect.objectContaining({
          IndexName: 'GSI2_Record_Type_Created_At',
          KeySchema: [
            { AttributeName: 'record_type', KeyType: 'HASH' },
            { AttributeName: 'created_at', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  test('Creates stream processor Lambda functions', () => {
    // Should have at least 2 Lambda functions (notes + contacts processors)
    // Plus the stream enabler function
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    expect(Object.keys(lambdaFunctions).length).toBeGreaterThanOrEqual(2);
  });

  test('Creates Custom Resource for stream enablement', () => {
    // Should have Custom Resources for enabling streams
    const customResources = template.findResources('AWS::CloudFormation::CustomResource');
    expect(Object.keys(customResources).length).toBeGreaterThanOrEqual(2);
  });

  test('Outputs table name and ARN', () => {
    template.hasOutput('UnifiedTableName', {});
    template.hasOutput('UnifiedTableArn', {});
  });

  test('Outputs source tables count', () => {
    template.hasOutput('SourceTablesCount', {});
  });
});
