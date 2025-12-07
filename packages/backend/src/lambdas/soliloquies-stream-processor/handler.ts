import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { StreamEventType } from '../../shared/types';
import { logger, putUnifiedRecord, hardDeleteUnifiedRecord } from '../../shared/utils';
import { soliloquiesTransformer, buildUnifiedRecord } from '../../shared/transformers';

/**
 * Process a single DynamoDB Stream record
 */
async function processRecord(record: DynamoDBRecord): Promise<void> {
    const eventType = record.eventName as StreamEventType;
    const eventId = record.eventID || 'unknown';

    logger.setContext({
        correlationId: eventId,
        eventType,
        tableName: soliloquiesTransformer.sourceTableName,
    });

    logger.info('Processing soliloquies stream record');

    try {
        if (eventType === 'REMOVE') {
            if (!record.dynamodb?.Keys) {
                logger.warn('REMOVE event without Keys, skipping');
                return;
            }

            const keys = unmarshall(
                record.dynamodb.Keys as Record<string, AttributeValue>
            );

            // Soliloquies transformer ID extraction
            const originalId = soliloquiesTransformer.extractId(keys);
            const pk = `${soliloquiesTransformer.sourceTableName}#${originalId}`;
            const sk = 'RECORD';

            await hardDeleteUnifiedRecord(pk, sk);
        } else {
            if (!record.dynamodb?.NewImage) {
                logger.warn(`${eventType} event without NewImage, skipping`);
                return;
            }

            const newImage = unmarshall(
                record.dynamodb.NewImage as Record<string, AttributeValue>
            );

            const unifiedRecord = buildUnifiedRecord(soliloquiesTransformer, newImage, eventType);

            logger.info('Syncing soliloquy to unified table', {
                recordId: unifiedRecord.original_id,
            });

            await putUnifiedRecord(unifiedRecord);
        }

        logger.info('Successfully processed soliloquies stream record');
    } catch (error) {
        logger.error('Failed to process soliloquies stream record', error as Error);
        throw error;
    } finally {
        logger.clearContext();
    }
}

/**
 * Lambda handler for DynamoDB Stream events from Soliloquies table
 */
export async function handler(event: DynamoDBStreamEvent): Promise<void> {
    logger.info('Received soliloquies stream event', {
        recordCount: event.Records.length,
    });

    for (const record of event.Records) {
        await processRecord(record);
    }

    logger.info('Completed processing all soliloquies stream records', {
        recordCount: event.Records.length,
    });
}
