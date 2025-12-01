import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.UNIFIED_TABLE_NAME || '';

export const handler = async (event: any) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const { id } = event.pathParameters;
    const { is_archived } = JSON.parse(event.body || '{}');

    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing item ID' }),
      };
    }

    // We need to reconstruct the PK and SK since the API only receives the PK part (which is {TABLE}#{ID})
    // Actually, in our UnifiedRecord:
    // PK: {TABLE_NAME}#{original_id}
    // SK: 'RECORD'
    // The 'id' passed from frontend IS the PK.

    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: id,
        SK: 'RECORD',
      },
      UpdateExpression: 'set is_archived = :archived',
      ExpressionAttributeValues: {
        ':archived': is_archived === undefined ? true : is_archived,
      },
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Item updated successfully' }),
    };
  } catch (error) {
    console.error('Error archiving item:', error);
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

