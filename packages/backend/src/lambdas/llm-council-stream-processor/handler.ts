import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord } from '../../shared/utils';
import { llmCouncilTransformer, buildUnifiedRecord } from '../../shared/transformers';

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventType = record.eventName as StreamEventType;
  const eventId = record.eventID || 'unknown';

  logger.setContext({
    correlationId: eventId,
    eventType,
    tableName: llmCouncilTransformer.sourceTableName,
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
      );

      // Extract ID via transformer
      // Note: LLM Council table uses simple primary key 'id' usually.
      // If there are skips (internal records), extractId might throw or we handle it here.
      try {
        const originalId = llmCouncilTransformer.extractId(keys);
        const pk = `${llmCouncilTransformer.sourceTableName}#${originalId}`;
        const sk = 'RECORD';
        await hardDeleteUnifiedRecord(pk, sk);
      } catch (err: unknown) {
        if ((err as Error).message.includes('SKIPPING_RECORD')) {
          logger.info('Skipping delete for internal record', { keys });
          return;
        }
        throw err;
      }
    } else {
      if (!record.dynamodb?.NewImage) {
        logger.warn(`${eventType} event without NewImage, skipping`);
        return;
      }

      const newImage = unmarshall(
        record.dynamodb.NewImage as Record<string, AttributeValue>
      );

      try {
        const unifiedRecord = buildUnifiedRecord(llmCouncilTransformer, newImage, eventType);

        logger.info('Syncing LLM Council conversation to unified table', {
          recordId: unifiedRecord.original_id,
        });

        await putUnifiedRecord(unifiedRecord);
      } catch (err: unknown) {
        if ((err as Error).message.includes('SKIPPING_RECORD')) {
          logger.info('Skipping internal record', { id: newImage.id });
          return;
        }
        throw err;
      }
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

