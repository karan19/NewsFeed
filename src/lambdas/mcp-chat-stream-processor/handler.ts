import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for MCP-chat-conversations table
 */
const SOURCE_TABLE_NAME = 'MCP-chat-conversations';
const SOURCE_TYPE = 'external';
const RECORD_TYPE = 'MCP_CONVERSATION';

/**
 * Source record interface for MCP chat conversations table
 */
interface McpChatSourceRecord {
  sessionId: string;
  createdAt: string;
  userId?: string;
  lastMessageAt?: string;
  // Additional fields may exist - add as discovered
  [key: string]: unknown;
}

/**
 * Extract the unique identifier from an MCP chat record
 */
function extractId(record: McpChatSourceRecord): string {
  if (!record.sessionId || !record.createdAt) {
    throw new Error('Missing sessionId or createdAt in MCP chat record');
  }
  return `${record.sessionId}#${record.createdAt}`;
}

/**
 * Transform MCP chat record to unified content format
 * Synced fields: sessionId, userId
 */
function transformContent(record: McpChatSourceRecord): Record<string, unknown> {
  return {
    sessionId: record.sessionId || '',
    userId: record.userId || '',
  };
}

/**
 * Build a UnifiedRecord from an MCP chat source record
 */
function buildUnifiedRecord(
  sourceRecord: McpChatSourceRecord,
  eventType: StreamEventType,
  existingCreatedAt?: string
): UnifiedRecord {
  const originalId = extractId(sourceRecord);
  const now = new Date().toISOString();

  return {
    PK: `${SOURCE_TABLE_NAME}#${originalId}`,
    SK: 'RECORD',
    source_type: SOURCE_TYPE,
    table_name: SOURCE_TABLE_NAME,
    original_id: originalId,
    record_type: RECORD_TYPE,
    content: transformContent(sourceRecord),
    created_at: existingCreatedAt || sourceRecord.createdAt || now,
    updated_at: sourceRecord.lastMessageAt || now,
    event_type: eventType,
    is_deleted: eventType === 'REMOVE',
  };
}

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventType = record.eventName as StreamEventType;
  const eventId = record.eventID || 'unknown';

  logger.setContext({
    correlationId: eventId,
    eventType,
    tableName: SOURCE_TABLE_NAME,
  });

  logger.info('Processing MCP chat stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as McpChatSourceRecord;
      
      const originalId = extractId(keys);
      const pk = `${SOURCE_TABLE_NAME}#${originalId}`;
      const sk = 'RECORD';

      await softDeleteUnifiedRecord(pk, sk);
    } else {
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      ) as McpChatSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as McpChatSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing MCP chat conversation to unified table', {
        recordId: unifiedRecord.original_id,
        sessionId: (unifiedRecord.content as Record<string, unknown>).sessionId,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed MCP chat stream record');
  } catch (error) {
    logger.error('Failed to process MCP chat stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from MCP chat table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received MCP chat stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all MCP chat stream records', {
    recordCount: event.Records.length,
  });
}

