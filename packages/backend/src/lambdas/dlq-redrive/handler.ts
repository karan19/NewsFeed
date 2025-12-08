import { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { DlqMessage, dlqService, DlqErrorType } from '../../shared/services/dlq-service';
import { enrichUnifiedRecord } from '../../shared/utils/enrichment';
import { putUnifiedRecord } from '../../shared/utils/dynamodb-client';
import { logger } from '../../shared/utils/logger';

const MAX_RETRY_COUNT = 3;

/**
 * DLQ Redrive Lambda
 * Processes failed AI enrichment records and re-attempts enrichment.
 * 
 * Flow:
 * 1. Read DLQ message containing full UnifiedRecord
 * 2. Re-attempt enrichUnifiedRecord
 * 3. If successful: save to DynamoDB
 * 4. If failed: re-queue with incremented retryCount (up to MAX_RETRY_COUNT)
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
    const batchItemFailures: SQSBatchItemFailure[] = [];

    for (const sqsRecord of event.Records) {
        const messageId = sqsRecord.messageId;

        try {
            const dlqMessage: DlqMessage = JSON.parse(sqsRecord.body);
            const { record, errorType, retryCount } = dlqMessage;

            logger.info('Processing DLQ message', {
                recordId: record.original_id,
                recordType: record.record_type,
                previousErrorType: errorType,
                retryCount,
            });

            // Check if max retries exceeded
            if (retryCount >= MAX_RETRY_COUNT) {
                logger.warn('Max retries exceeded, abandoning record', {
                    recordId: record.original_id,
                    retryCount,
                });
                // Don't re-queue, let it be deleted from DLQ
                continue;
            }

            // Clear any previous AI fields so enrichment runs fresh
            const cleanRecord = {
                ...record,
                ai_summary: undefined,
                ai_insight: undefined,
            };

            // Re-attempt enrichment
            const enrichedRecord = await enrichUnifiedRecord(cleanRecord);

            // Check if enrichment succeeded (not just fallback messages)
            const enrichmentSucceeded =
                enrichedRecord.ai_summary !== 'Unable to generate summary.' &&
                enrichedRecord.ai_insight !== 'Unable to generate insight.';

            if (enrichmentSucceeded) {
                // Save the enriched record to DynamoDB
                await putUnifiedRecord(enrichedRecord);

                logger.info('Successfully redrived DLQ record', {
                    recordId: record.original_id,
                    retryCount,
                });
            } else {
                // Enrichment still failed, re-queue with incremented retry count
                logger.warn('Enrichment still failed on redrive', {
                    recordId: record.original_id,
                    retryCount: retryCount + 1,
                });

                await dlqService.sendToQueue(
                    record,
                    'ENRICHMENT_FAILED' as DlqErrorType,
                    'Redrive enrichment failed',
                    retryCount + 1
                );
            }

        } catch (error) {
            logger.error('Error processing DLQ message', error as Error, { messageId });

            // Add to batch failures so SQS will retry
            batchItemFailures.push({ itemIdentifier: messageId });
        }
    }

    return { batchItemFailures };
};
