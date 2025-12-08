import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord, enrichUnifiedRecord } from '../../shared/utils';
import { projectsTransformer, buildUnifiedRecord, extractIdForDelete } from '../../shared/transformers';

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventType = record.eventName as StreamEventType;
  const eventId = record.eventID || 'unknown';

  logger.setContext({
    correlationId: eventId,
    eventType,
    tableName: projectsTransformer.sourceTableName,
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
      );
      const oldImage = record.dynamodb?.OldImage
        ? unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>)
        : undefined;

      const originalId = extractIdForDelete(projectsTransformer, keys, oldImage);
      const pk = `${projectsTransformer.sourceTableName}#${originalId}`;
      const sk = 'RECORD';

      await hardDeleteUnifiedRecord(pk, sk);
      logger.info('Deleted record from unified table', { pk, sk });
    } else {
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      );

      let unifiedRecord = buildUnifiedRecord(projectsTransformer, newImage, eventType);

      // Enrich with AI
      unifiedRecord = await enrichUnifiedRecord(unifiedRecord);

      logger.info('Syncing project to unified table', {
        recordId: unifiedRecord.original_id,
        title: (unifiedRecord.content as Record<string, unknown>).projectTitle,
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
