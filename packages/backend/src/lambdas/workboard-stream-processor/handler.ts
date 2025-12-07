import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for nexusnote-tracking-workboard-production table
 */
const SOURCE_TABLE_NAME = 'nexusnote-tracking-workboard-production';
const SOURCE_TYPE = 'personal';
const RECORD_TYPE = 'WORKBOARD';

/**
 * Source record interface for workboard table
 */
interface WorkboardSourceRecord {
  PK: string;
  SK: string;
  chainId?: string;
  rootNodeId?: string;
  slotIndex?: number;
  length?: number;
  archived?: boolean;
  createdAt?: string;
  lastActiveAt?: string;
}

/**
 * Extract the unique identifier from a workboard record
 */
function extractId(record: WorkboardSourceRecord): string {
  if (!record.PK || !record.SK) {
    throw new Error('Missing PK or SK in workboard record');
  }
  return `${record.PK}#${record.SK}`;
}

/**
 * Transform workboard record to unified content format
 * Synced fields: chainId, slotIndex, archived
 */
function transformContent(record: WorkboardSourceRecord): Record<string, unknown> {
  return {
    chainId: record.chainId || '',
    slotIndex: record.slotIndex ?? 0,
    archived: record.archived ?? false,
  };
}

/**
 * Build a UnifiedRecord from a workboard source record
 */
function buildUnifiedRecord(
  sourceRecord: WorkboardSourceRecord,
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
    updated_at: sourceRecord.lastActiveAt || now,
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

  logger.info('Processing workboard stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as WorkboardSourceRecord;

      const originalId = extractId(keys);
      const pk = `${SOURCE_TABLE_NAME}#${originalId}`;
      const sk = 'RECORD';

      await hardDeleteUnifiedRecord(pk, sk);
    } else {
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      ) as WorkboardSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as WorkboardSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);

      logger.info('Syncing workboard item to unified table', {
        recordId: unifiedRecord.original_id,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed workboard stream record');
  } catch (error) {
    logger.error('Failed to process workboard stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from workboard table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received workboard stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all workboard stream records', {
    recordCount: event.Records.length,
  });
}

