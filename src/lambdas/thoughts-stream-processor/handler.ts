import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for nexusnote-thoughts-production table
 */
const SOURCE_TABLE_NAME = 'nexusnote-thoughts-production';
const SOURCE_TYPE = 'personal';
const RECORD_TYPE = 'THOUGHT';

/**
 * Source record interface for thoughts table
 */
interface ThoughtsSourceRecord {
  userId: string;
  thoughtId: string;
  content?: string;
  tagName?: string;
  userTag?: string;
  createdAt?: string;
}

/**
 * Extract the unique identifier from a thoughts record
 */
function extractId(record: ThoughtsSourceRecord): string {
  if (!record.userId || !record.thoughtId) {
    throw new Error('Missing userId or thoughtId in thoughts record');
  }
  return `${record.userId}#${record.thoughtId}`;
}

/**
 * Transform thoughts record to unified content format
 * Synced fields: content, tagName
 */
function transformContent(record: ThoughtsSourceRecord): Record<string, unknown> {
  return {
    content: record.content || '',
    tagName: record.tagName || '',
  };
}

/**
 * Build a UnifiedRecord from a thoughts source record
 */
function buildUnifiedRecord(
  sourceRecord: ThoughtsSourceRecord,
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
    updated_at: now,
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

  logger.info('Processing thoughts stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as ThoughtsSourceRecord;
      
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
      ) as ThoughtsSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as ThoughtsSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing thought to unified table', {
        recordId: unifiedRecord.original_id,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed thoughts stream record');
  } catch (error) {
    logger.error('Failed to process thoughts stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from thoughts table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received thoughts stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all thoughts stream records', {
    recordCount: event.Records.length,
  });
}

