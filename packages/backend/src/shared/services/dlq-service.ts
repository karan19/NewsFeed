import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { logger } from "../utils/logger";
import { UnifiedRecord } from "../types/unified-record";

export type DlqErrorType =
    | "BEDROCK_API_ERROR"
    | "INVALID_JSON_RESPONSE"
    | "EMPTY_AI_FIELDS"
    | "ENRICHMENT_FAILED";

/**
 * DLQ Message schema - designed for redrive support.
 * Contains the full UnifiedRecord so redrive Lambda can re-attempt enrichment.
 */
export interface DlqMessage {
    record: UnifiedRecord;  // Full record for redrive
    errorType: DlqErrorType;
    errorMessage: string;
    timestamp: string;
    retryCount: number;  // Track retry attempts
}

export class DlqService {
    private client: SQSClient;
    private queueUrl: string;

    constructor() {
        this.client = new SQSClient({ region: process.env.AWS_REGION || "us-west-2" });
        this.queueUrl = process.env.AI_ENRICHMENT_DLQ_URL || "";
    }

    async sendToQueue(
        record: UnifiedRecord,
        errorType: DlqErrorType,
        errorMessage: string,
        retryCount: number = 0
    ): Promise<void> {
        if (!this.queueUrl) {
            logger.warn("DLQ URL not configured, skipping DLQ send", { recordId: record.original_id });
            return;
        }

        const message: DlqMessage = {
            record,  // Store full record for redrive
            errorType,
            errorMessage,
            timestamp: new Date().toISOString(),
            retryCount,
        };

        try {
            const command = new SendMessageCommand({
                QueueUrl: this.queueUrl,
                MessageBody: JSON.stringify(message),
                MessageAttributes: {
                    ErrorType: {
                        DataType: "String",
                        StringValue: errorType,
                    },
                    RecordType: {
                        DataType: "String",
                        StringValue: record.record_type,
                    },
                    RetryCount: {
                        DataType: "Number",
                        StringValue: retryCount.toString(),
                    },
                },
            });

            await this.client.send(command);

            logger.info("Sent record to DLQ", {
                recordId: record.original_id,
                errorType,
                retryCount,
            });
        } catch (error) {
            logger.error("Failed to send to DLQ", error as Error, {
                recordId: record.original_id,
                errorType,
            });
            // Don't throw - we don't want DLQ failures to break the main flow
        }
    }
}

export const dlqService = new DlqService();

