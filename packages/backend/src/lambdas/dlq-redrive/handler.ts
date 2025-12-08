import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { DlqMessage, dlqService, DlqErrorType } from '../../shared/services/dlq-service';
import { enrichUnifiedRecord } from '../../shared/utils/enrichment';
import { putUnifiedRecord } from '../../shared/utils/dynamodb-client';
import { logger } from '../../shared/utils/logger';

const MAX_RETRY_COUNT = 3;
const BATCH_SIZE = 10;

interface RedriveResult {
    processed: number;
    succeeded: number;
    failed: number;
    requeued: number;
}

/**
 * DLQ Redrive Lambda - MANUAL INVOCATION ONLY
 * 
 * Pulls failed AI enrichment records from DLQ and re-attempts enrichment.
 * Invoke manually via AWS Console or CLI:
 *   aws lambda invoke --function-name NewsFeed-DlqRedrive output.json
 * 
 * Flow:
 * 1. Pull messages from DLQ
 * 2. Re-attempt enrichUnifiedRecord for each
 * 3. If successful: save to DynamoDB, delete from queue
 * 4. If failed: re-queue with incremented retryCount (up to MAX_RETRY_COUNT)
 */
export const handler = async (): Promise<RedriveResult> => {
    const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-west-2' });
    const queueUrl = process.env.AI_ENRICHMENT_DLQ_URL;

    if (!queueUrl) {
        throw new Error('AI_ENRICHMENT_DLQ_URL environment variable not set');
    }

    const result: RedriveResult = {
        processed: 0,
        succeeded: 0,
        failed: 0,
        requeued: 0,
    };

    // Pull messages from queue
    const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: BATCH_SIZE,
        WaitTimeSeconds: 5,
        MessageAttributeNames: ['All'],
    });

    const response = await sqsClient.send(receiveCommand);
    const messages = response.Messages || [];

    logger.info('Received messages from DLQ', { count: messages.length });

    for (const sqsMessage of messages) {
        if (!sqsMessage.Body || !sqsMessage.ReceiptHandle) continue;

        result.processed++;

        try {
            const dlqMessage: DlqMessage = JSON.parse(sqsMessage.Body);
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
                result.failed++;

                // Delete from queue - no more retries
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: sqsMessage.ReceiptHandle,
                }));
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
                result.succeeded++;

                // Delete from queue
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: sqsMessage.ReceiptHandle,
                }));
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
                result.requeued++;

                // Delete original message (new one was queued with incremented retry)
                await sqsClient.send(new DeleteMessageCommand({
                    QueueUrl: queueUrl,
                    ReceiptHandle: sqsMessage.ReceiptHandle,
                }));
            }

        } catch (error) {
            logger.error('Error processing DLQ message', error as Error);
            result.failed++;
            // Don't delete - let it become visible again for retry
        }
    }

    logger.info('Redrive complete', { ...result });
    return result;
};
