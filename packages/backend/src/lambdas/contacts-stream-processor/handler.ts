import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for nexusnote-inno-contacts-production table
 */
const SOURCE_TABLE_NAME = 'nexusnote-inno-contacts-production';
const SOURCE_TYPE = 'personal';
const RECORD_TYPE = 'CONTACT';

/**
 * Source record interface for contacts table
 */
interface ContactsSourceRecord {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  userId?: string;
  contactName?: string;
  role?: string;
  workingStyle?: string;
  personalityTraits?: string[];
  nextInteractionPlan?: string;
  supportLearnToggle?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extract the unique identifier from a contacts record
 * Uses PK and SK for uniqueness
 */
function extractId(record: ContactsSourceRecord): string {
  if (!record.PK || !record.SK) {
    throw new Error('Missing PK or SK in contacts record');
  }
  return `${record.PK}#${record.SK}`;
}

/**
 * Transform contacts record to unified content format
 * Only includes: contactName, role, workingStyle
 */
function transformContent(record: ContactsSourceRecord): Record<string, unknown> {
  return {
    contactName: record.contactName || '',
    role: record.role || '',
    workingStyle: record.workingStyle || '',
  };
}

/**
 * Build a UnifiedRecord from a contacts source record
 */
function buildUnifiedRecord(
  sourceRecord: ContactsSourceRecord,
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
    updated_at: sourceRecord.updatedAt || now,
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

  logger.info('Processing contacts stream record');

  try {
    if (eventType === 'REMOVE') {
      // Handle deletion
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as ContactsSourceRecord;
      
      const originalId = extractId(keys);
      const pk = `${SOURCE_TABLE_NAME}#${originalId}`;
      const sk = 'RECORD';

      await softDeleteUnifiedRecord(pk, sk);
    } else {
      // Handle INSERT or MODIFY
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      ) as ContactsSourceRecord;

      // For MODIFY, try to preserve original created_at from unified table
      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as ContactsSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing contact to unified table', {
        recordId: unifiedRecord.original_id,
        contactName: (unifiedRecord.content as Record<string, unknown>).contactName,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed contacts stream record');
  } catch (error) {
    logger.error('Failed to process contacts stream record', error as Error);
    throw error; // Re-throw to trigger Lambda retry/DLQ
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from contacts table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received contacts stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all contacts stream records', {
    recordCount: event.Records.length,
  });
}

