import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord } from '../../shared/utils';
import { notesTransformer, buildUnifiedRecord } from '../../shared/transformers';

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventType = record.eventName as StreamEventType;
  const eventId = record.eventID || 'unknown';

  logger.setContext({
    correlationId: eventId,
    eventType,
    tableName: notesTransformer.sourceTableName,
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
      );

      // We need to construct a partial record that satisfies what extractId needs
      // notesTransformer.extractId expects { userId, noteId }
      // These should be present in the keys for this table (PK=USER#<userId>, SK=NOTE#<noteId>) but the transformer expects direct props
      // Wait, the notes transformer extractId expects:
      // const userId = record['userId'] as string;
      // const noteId = record['noteId'] as string;
      // BUT the table likely uses PK/SK or GSI keys. 
      // Let's check the original handler's extractId:
      // function extractId(record: NotesSourceRecord): string {
      //   if (!record.userId || !record.noteId) { ... }
      //   return `${record.userId}#${record.noteId}`;
      // }
      // The keys come from DynamoDB. If the table is single-table design, keys are PK/SK.
      // If it's a dedicated table with userId partition key and noteId sort key, then those are the keys.
      // The original interface said: interface NotesSourceRecord { userId: string; noteId: string; ... }
      // So the Keys object will have userId and noteId.

      const originalId = notesTransformer.extractId(keys);
      const pk = `${notesTransformer.sourceTableName}#${originalId}`;
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

      const unifiedRecord = buildUnifiedRecord(notesTransformer, newImage, eventType);

      logger.info('Syncing note to unified table', {
        recordId: unifiedRecord.original_id,
        title: (unifiedRecord.content as Record<string, unknown>).noteTitle,
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

