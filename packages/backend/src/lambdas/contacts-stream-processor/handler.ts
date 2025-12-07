import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord } from '../../shared/utils';
import { contactsTransformer, buildUnifiedRecord } from '../../shared/transformers';

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventType = record.eventName as StreamEventType;
  const eventId = record.eventID || 'unknown';

  logger.setContext({
    correlationId: eventId,
    eventType,
    tableName: contactsTransformer.sourceTableName,
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
      );

      const originalId = contactsTransformer.extractId(keys);
      const pk = `${contactsTransformer.sourceTableName}#${originalId}`;
      const sk = 'RECORD';

      await hardDeleteUnifiedRecord(pk, sk);
    } else {
      // Handle INSERT or MODIFY
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      );

      const unifiedRecord = buildUnifiedRecord(contactsTransformer, newImage, eventType);

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

