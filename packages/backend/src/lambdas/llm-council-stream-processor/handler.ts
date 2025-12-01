import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for LlmCouncilStack-ConversationsTable
 */
const SOURCE_TABLE_NAME = 'LlmCouncilStack-ConversationsTableCD91EB96-17V5OM4BFKIY8';
const SOURCE_TYPE = 'external';
const RECORD_TYPE = 'LLM_CONVERSATION';

/**
 * Source record interface for LLM Council conversations table
 */
interface LlmCouncilSourceRecord {
  id: string;
  // Additional fields may exist - add as discovered
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Extract the unique identifier from an LLM Council record
 */
function extractId(record: LlmCouncilSourceRecord): string {
  if (!record.id) {
    throw new Error('Missing id in LLM Council record');
  }
  return record.id;
}

/**
 * Transform LLM Council record to unified content format
 * Synced fields: id (and any other relevant fields discovered)
 */
function transformContent(record: LlmCouncilSourceRecord): Record<string, unknown> {
  return {
    id: record.id || '',
    // Add more fields as the schema becomes clearer
  };
}

/**
 * Build a UnifiedRecord from an LLM Council source record
 */
function buildUnifiedRecord(
  sourceRecord: LlmCouncilSourceRecord,
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
    created_at: existingCreatedAt || (sourceRecord.createdAt as string) || now,
    updated_at: (sourceRecord.updatedAt as string) || now,
    event_type: eventType,
    is_deleted: eventType === 'REMOVE',
    gsi_global_pk: 'GLOBAL',
    is_archived: false,
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

  logger.info('Processing LLM Council stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as LlmCouncilSourceRecord;
      
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
      ) as LlmCouncilSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as LlmCouncilSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing LLM Council conversation to unified table', {
        recordId: unifiedRecord.original_id,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed LLM Council stream record');
  } catch (error) {
    logger.error('Failed to process LLM Council stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from LLM Council table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received LLM Council stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all LLM Council stream records', {
    recordCount: event.Records.length,
  });
}

