import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { UnifiedRecord } from '../types';
import { logger } from './logger';

// Create DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

/**
 * Get the unified table name from environment
 */
export function getUnifiedTableName(): string {
  const tableName = process.env.UNIFIED_TABLE_NAME;
  if (!tableName) {
    throw new Error('UNIFIED_TABLE_NAME environment variable is not set');
  }
  return tableName;
}

/**
 * Put a record into the unified table (idempotent upsert)
 */
export async function putUnifiedRecord(record: UnifiedRecord): Promise<void> {
  const tableName = getUnifiedTableName();
  
  logger.debug('Putting record to unified table', {
    PK: record.PK,
    SK: record.SK,
    eventType: record.event_type,
  });

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: record,
    })
  );

  logger.info('Successfully put record to unified table', {
    PK: record.PK,
    SK: record.SK,
  });
}

/**
 * Soft delete a record in the unified table
 */
export async function softDeleteUnifiedRecord(
  pk: string,
  sk: string
): Promise<void> {
  const tableName = getUnifiedTableName();
  
  logger.debug('Soft deleting record in unified table', { PK: pk, SK: sk });

  // First, get the existing record
  const existingRecord = await docClient.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: pk, SK: sk },
    })
  );

  if (!existingRecord.Item) {
    logger.warn('Record not found for soft delete', { PK: pk, SK: sk });
    return;
  }

  // Update with soft delete
  const updatedRecord: UnifiedRecord = {
    ...(existingRecord.Item as UnifiedRecord),
    is_deleted: true,
    event_type: 'REMOVE',
    updated_at: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: tableName,
      Item: updatedRecord,
    })
  );

  logger.info('Successfully soft deleted record in unified table', {
    PK: pk,
    SK: sk,
  });
}

/**
 * Hard delete a record from the unified table (use with caution)
 */
export async function hardDeleteUnifiedRecord(
  pk: string,
  sk: string
): Promise<void> {
  const tableName = getUnifiedTableName();
  
  logger.debug('Hard deleting record from unified table', { PK: pk, SK: sk });

  await docClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK: pk, SK: sk },
    })
  );

  logger.info('Successfully hard deleted record from unified table', {
    PK: pk,
    SK: sk,
  });
}

export { docClient };

