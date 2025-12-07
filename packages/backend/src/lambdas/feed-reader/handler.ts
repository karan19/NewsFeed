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

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: INDEX_NAME,
      KeyConditionExpression: 'gsi_global_pk = :pk',
      FilterExpression: 'is_archived <> :true AND is_deleted <> :true',
      ExpressionAttributeValues: {
        ':pk': 'GLOBAL',
        ':true': true,
      },
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

