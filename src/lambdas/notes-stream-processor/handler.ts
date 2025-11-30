import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for nexusnote-notes-production table
 */
const SOURCE_TABLE_NAME = 'nexusnote-notes-production';
const SOURCE_TYPE = 'personal';
const RECORD_TYPE = 'NOTE';

/**
 * Source record interface for notes table
 */
interface NotesSourceRecord {
  userId: string;
  noteId: string;
  title?: string;
  content?: string;
  status?: string;
  statusUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  pinned?: boolean;
  manualTags?: string[];
  aiTags?: string[];
}

/**
 * Extract the unique identifier from a notes record
 * Combines userId and noteId for uniqueness
 */
function extractId(record: NotesSourceRecord): string {
  if (!record.userId || !record.noteId) {
    throw new Error('Missing userId or noteId in notes record');
  }
  return `${record.userId}#${record.noteId}`;
}

/**
 * Transform notes record to unified content format
 * Only includes: title, content
 */
function transformContent(record: NotesSourceRecord): Record<string, unknown> {
  return {
    title: record.title || '',
    content: record.content || '',
  };
}

/**
 * Build a UnifiedRecord from a notes source record
 */
function buildUnifiedRecord(
  sourceRecord: NotesSourceRecord,
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

  logger.info('Processing notes stream record');

  try {
    if (eventType === 'REMOVE') {
      // Handle deletion
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as NotesSourceRecord;
      
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
      ) as NotesSourceRecord;

      // For MODIFY, try to preserve original created_at from unified table
      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as NotesSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing note to unified table', {
        recordId: unifiedRecord.original_id,
        title: (unifiedRecord.content as Record<string, unknown>).title,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed notes stream record');
  } catch (error) {
    logger.error('Failed to process notes stream record', error as Error);
    throw error; // Re-throw to trigger Lambda retry/DLQ
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from notes table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received notes stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all notes stream records', {
    recordCount: event.Records.length,
  });
}

