import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { UnifiedRecord, StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, softDeleteUnifiedRecord } from '../../shared/utils';

/**
 * Configuration for nexusnote-implementation-projects-production table
 */
const SOURCE_TABLE_NAME = 'nexusnote-implementation-projects-production';
const SOURCE_TYPE = 'personal';
const RECORD_TYPE = 'PROJECT';

/**
 * Source record interface for projects table
 */
interface ProjectsSourceRecord {
  userId: string;
  projectId: string;
  title?: string;
  description?: string;
  notes?: string;
  status?: string;
  priorityIndex?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Extract the unique identifier from a projects record
 */
function extractId(record: ProjectsSourceRecord): string {
  if (!record.userId || !record.projectId) {
    throw new Error('Missing userId or projectId in projects record');
  }
  return `${record.userId}#${record.projectId}`;
}

/**
 * Transform projects record to unified content format
 * Synced fields: title, description, status
 */
function transformContent(record: ProjectsSourceRecord): Record<string, unknown> {
  return {
    title: record.title || '',
    description: record.description || '',
    status: record.status || '',
  };
}

/**
 * Build a UnifiedRecord from a projects source record
 */
function buildUnifiedRecord(
  sourceRecord: ProjectsSourceRecord,
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

  logger.info('Processing projects stream record');

  try {
    if (eventType === 'REMOVE') {
      if (!record.dynamodb?.Keys) {
        logger.warn('REMOVE event without Keys, skipping');
        return;
      }

      const keys = unmarshall(
        record.dynamodb.Keys as Record<string, AttributeValue>
      ) as ProjectsSourceRecord;
      
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
      ) as ProjectsSourceRecord;

      let existingCreatedAt: string | undefined;
      if (eventType === 'MODIFY' && record.dynamodb?.OldImage) {
        const oldImage = unmarshall(
          record.dynamodb.OldImage as Record<string, AttributeValue>
        ) as ProjectsSourceRecord;
        existingCreatedAt = oldImage.createdAt;
      }

      const unifiedRecord = buildUnifiedRecord(newImage, eventType, existingCreatedAt);
      
      logger.info('Syncing project to unified table', {
        recordId: unifiedRecord.original_id,
        title: (unifiedRecord.content as Record<string, unknown>).title,
      });

      await putUnifiedRecord(unifiedRecord);
    }

    logger.info('Successfully processed projects stream record');
  } catch (error) {
    logger.error('Failed to process projects stream record', error as Error);
    throw error;
  } finally {
    logger.clearContext();
  }
}

/**
 * Lambda handler for DynamoDB Stream events from projects table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
  logger.info('Received projects stream event', {
    recordCount: event.Records.length,
  });

  for (const record of event.Records) {
    await processRecord(record);
  }

  logger.info('Completed processing all projects stream records', {
    recordCount: event.Records.length,
  });
}

