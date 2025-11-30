import { 
  DynamoDBClient, 
  DescribeTableCommand, 
  UpdateTableCommand,
  StreamViewType 
} from '@aws-sdk/client-dynamodb';
import { 
  CloudFormationCustomResourceEvent, 
  CloudFormationCustomResourceSuccessResponse,
  CloudFormationCustomResourceFailedResponse,
} from 'aws-lambda';

const dynamoClient = new DynamoDBClient({});

interface ResourceProperties {
  ServiceToken: string;
  TableName: string;
}

type CustomResourceResponse = CloudFormationCustomResourceSuccessResponse | CloudFormationCustomResourceFailedResponse;

/**
 * Custom Resource handler to enable DynamoDB Streams on a table
 * 
 * This Lambda is invoked by CloudFormation during stack deployment.
 * It checks if streams are enabled on the target table, and enables them if not.
 */
export async function handler(
  event: CloudFormationCustomResourceEvent
): Promise<CustomResourceResponse> {
  console.log('Event:', JSON.stringify(event, null, 2));

  const properties = event.ResourceProperties as ResourceProperties;
  const tableName = properties.TableName;
  const physicalResourceId = `stream-enabler-${tableName}`;

  try {
    if (event.RequestType === 'Delete') {
      // On delete, we don't disable streams (they might be used by other consumers)
      console.log(`Delete requested for ${tableName} - streams will remain enabled`);
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {},
      };
    }

    // Create or Update - enable streams if not already enabled
    const streamArn = await enableStreamIfNeeded(tableName);

    console.log(`Successfully processed ${tableName}, StreamArn: ${streamArn}`);

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        StreamArn: streamArn,
        TableName: tableName,
      },
    };
  } catch (error) {
    console.error(`Error processing ${tableName}:`, error);
    return {
      Status: 'FAILED',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enable DynamoDB Streams on a table if not already enabled
 * Returns the stream ARN
 */
async function enableStreamIfNeeded(tableName: string): Promise<string> {
  // First, describe the table to check current stream status
  const describeResponse = await dynamoClient.send(
    new DescribeTableCommand({ TableName: tableName })
  );

  const table = describeResponse.Table;
  if (!table) {
    throw new Error(`Table ${tableName} not found`);
  }

  // Check if streams are already enabled
  if (table.StreamSpecification?.StreamEnabled && table.LatestStreamArn) {
    console.log(`Streams already enabled on ${tableName}: ${table.LatestStreamArn}`);
    return table.LatestStreamArn;
  }

  // Enable streams
  console.log(`Enabling streams on ${tableName}...`);
  
  const updateResponse = await dynamoClient.send(
    new UpdateTableCommand({
      TableName: tableName,
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: StreamViewType.NEW_AND_OLD_IMAGES,
      },
    })
  );

  const streamArn = updateResponse.TableDescription?.LatestStreamArn;
  if (!streamArn) {
    // Wait a moment and re-fetch - sometimes the ARN isn't immediately available
    await sleep(2000);
    
    const recheckResponse = await dynamoClient.send(
      new DescribeTableCommand({ TableName: tableName })
    );
    
    const recheckArn = recheckResponse.Table?.LatestStreamArn;
    if (!recheckArn) {
      throw new Error(`Failed to get stream ARN for ${tableName} after enabling`);
    }
    
    console.log(`Streams enabled on ${tableName}: ${recheckArn}`);
    return recheckArn;
  }

  console.log(`Streams enabled on ${tableName}: ${streamArn}`);
  return streamArn;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

