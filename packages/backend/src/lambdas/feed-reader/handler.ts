import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.UNIFIED_TABLE_NAME || '';
const INDEX_NAME = 'GSI3-GlobalFeed';

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit) : 50;
    const nextToken = event.queryStringParameters?.nextToken;
    const userId = event.queryStringParameters?.userId;

    let indexName = 'GSI3-GlobalFeed';
    let keyConditionExpression = 'gsi_global_pk = :pk';
    let expressionAttributeValues: Record<string, any> = {
      ':pk': 'GLOBAL',
      ':true': true,
    };

    if (userId) {
      indexName = 'GSI4-User-CreatedAt';
      keyConditionExpression = 'user_id = :userId';
      expressionAttributeValues = {
        ':userId': userId,
        ':true': true,
      };
    }

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: indexName,
      KeyConditionExpression: keyConditionExpression,
      FilterExpression: 'is_archived <> :true AND is_deleted <> :true',
      ExpressionAttributeValues: expressionAttributeValues,
      ScanIndexForward: false, // Newest first
      Limit: limit,
      ExclusiveStartKey: nextToken ? JSON.parse(Buffer.from(nextToken, 'base64').toString()) : undefined,
    });

    const response = await docClient.send(command);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        items: response.Items || [],
        nextToken: response.LastEvaluatedKey ? Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64') : null,
      }),
    };
  } catch (error) {
    console.error('Error fetching feed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};

