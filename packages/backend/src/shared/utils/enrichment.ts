import { UnifiedRecord } from '../types/unified-record';
import { aiService } from '../services/ai-service';
import { dlqService } from '../services/dlq-service';
import { logger } from './logger';

/**
 * Enriches a unified record with AI-generated summary and insight.
 * Mutates the record or returns a new one? Let's return the modified record object.
 * Note: This operation adds latency due to the LLM call.
 */
export async function enrichUnifiedRecord(record: UnifiedRecord): Promise<UnifiedRecord> {
    // Skip enrichment if already present (idempotency check)
    if (record.ai_summary && record.ai_insight) {
        return record;
    }

    // Skip enrichment for removals
    if (record.event_type === 'REMOVE' || record.is_deleted) {
        return record;
    }

    try {
        const enrichment = await aiService.generateEnrichment(record);

        // Create specific log context for this enrichment
        logger.info('Enriched record with AI', {
            recordId: record.original_id,
            recordType: record.record_type
        });

        return {
            ...record,
            ai_summary: enrichment.summary,
            ai_insight: enrichment.insight
        };
    } catch (error) {
        logger.error('Failed to enrich record', error as Error);

        // Send to DLQ for unexpected enrichment failures
        await dlqService.sendToQueue(
            record,
            'ENRICHMENT_FAILED',
            (error as Error).message
        );

        // Return record with fallback AI messages to ensure data durability
        return {
            ...record,
            ai_summary: 'Unable to generate summary.',
            ai_insight: 'Unable to generate insight.'
        };
    }
}

