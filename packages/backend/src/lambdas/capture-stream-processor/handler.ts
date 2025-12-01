import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for Capture table
 */
const SOURCE_TABLE_NAME = 'Capture';
const SOURCE_TYPE = 'external';
const RECORD_TYPE = 'CAPTURE';

/**
 * Source record interface for Capture table
 */
interface CaptureSourceRecord {
  pk: string;
  sk: string;
  id?: string;
  title?: string;
  content?: string;
  source?: string;
  sourceUrl?: string;
  primaryTag?: string;
  capturedAt?: string;
  contentHash?: string;
  tableName?: string;
}

/**
 * Extract the unique identifier from a capture record
 */
function extractId(record: CaptureSourceRecord): string {
  if (!record.pk || !record.sk) {
    throw new Error('Missing pk or sk in capture record');
  }
  return `${record.pk}#${record.sk}`;
}

/**
 * Transform capture record to unified content format
 * Synced fields: title, content, source, sourceUrl
 */
function transformContent(record: CaptureSourceRecord): Record<string, unknown> {
  return {
    title: record.title || '',
    content: record.content || '',
    source: record.source || '',
    sourceUrl: record.sourceUrl || '',
  };
}

/**
 * Build a UnifiedRecord from a capture source record
 */
function buildUnifiedRecord(
  sourceRecord: CaptureSourceRecord,
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
    created_at: existingCreatedAt || sourceRecord.capturedAt || now,
    updated_at: now,
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

  logger.info('Processing capture stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as CaptureSourceRecord;
      
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
      ) as CaptureSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as CaptureSourceRecord;
        existingCreatedAt = oldImage.capturedAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing capture to unified table', {
        recordId: unifiedRecord.original_id,
        title: (unifiedRecord.content as Record<string, unknown>).title,
        source: (unifiedRecord.content as Record<string, unknown>).source,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed capture stream record');
  } catch (error) {
    logger.error('Failed to process capture stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from Capture table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received capture stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all capture stream records', {
    recordCount: event.Records.length,
  });
}

