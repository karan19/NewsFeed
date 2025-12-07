import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';
import { buildUnifiedRecord } from '../../shared/transformers';
import { soliloquiesTransformer } from '../../shared/transformers';
import { putUnifiedRecord, hardDeleteUnifiedRecord, logger } from '../../shared/utils';

const SOURCE_TABLE_NAME = 'nexusnote-soliloquies-production';

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
    logger.info('Processing stream event', { recordCount: event.Records.length });

    for (const record of event.Records) {
        try {
            if (record.eventName === 'INSERT' || record.eventName === 'MODIFY') {
                if (!record.dynamodb?.NewImage) continue;

                const sourceRecord = unmarshall(record.dynamodb.NewImage as any);
                const unifiedRecord = buildUnifiedRecord(
                    soliloquiesTransformer,
                    sourceRecord,
                    record.eventName
                );

                await putUnifiedRecord(unifiedRecord);
                logger.info('Processed record', {
                    id: unifiedRecord.original_id,
                    type: record.eventName
                });

            } else if (record.eventName === 'REMOVE') {
                if (!record.dynamodb?.Keys) continue;

                const keys = unmarshall(record.dynamodb.Keys as any);
                // Extract ID using the transformer's logic (or manually if keys are minimal)
                // For Soliloquies, PK is typically the ID or we need to look at specific key structure.
                // The transformer expects full record to extract ID usually, but extractId only typically needs the ID field.
                // Let's assume Keys has the ID field 'soliloquyId' or partition key.
                // If not, we might need to rely on what Keys provides.
                // Based on scan, Key is: sortKey, userId. Wait, that's not soliloquyId as PK.
                // The scan showed: sortKey, userId. Let's check scan result again.
                // Scan item: 
                // "sortKey": { "S": "2025...#UUID" }, "userId": "..."
                // It seems this table uses Composite Key: PK=userId, SK=sortKey ? Or global table?
                // Wait, I need to know the Key Schema to handle REMOVE correctly.
                // I will assume for now we can extract ID from the Keys if 'soliloquyId' is part of it, 
                // OR we construct the Unified PK using the transformer's table name + ID.

                // Use a safe fallback if we can't fully rebuild the record.
                // For hardDelete, we need the Unified Table PK/SK.
                // Unified PK: "nexusnote-soliloquies-production#<soliloquyId>"

                // If 'soliloquyId' is NOT in the Keys (e.g. if it's just a non-key attribute), 
                // we might have trouble processing REMOVE unless we have OldImage.

                const oldImage = record.dynamodb.OldImage ? unmarshall(record.dynamodb.OldImage as any) : null;
                const id = oldImage ? soliloquiesTransformer.extractId(oldImage) : null;

                if (id) {
                    await hardDeleteUnifiedRecord(SOURCE_TABLE_NAME, id);
                    logger.info('Hard deleted record', { id });
                } else {
                    logger.warn('Could not extract ID for REMOVE event', { keys });
                }
            }
        } catch (error) {
            logger.error('Error processing record', error as Error, { record });
        }
    }
};
