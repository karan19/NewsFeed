/**
 * Shared Transformers
 * 
 * These transformers are used by both:
 * 1. Lambda stream processors (real-time sync)
 * 2. Backfill script (batch sync)
 * 
 * This ensures consistent transformation logic across both paths.
 */

import { UnifiedRecord, StreamEventType } from '../types';

/**
 * Base transformer interface
 */
export interface RecordTransformer {
  sourceTableName: string;
  sourceType: 'personal' | 'external';
  recordType: string;

  /** Extract unique ID from source record (for INSERT/MODIFY events) */
  extractId(record: Record<string, unknown>): string;

  /**
   * Extract unique ID from DynamoDB Keys (for REMOVE events).
   * Keys may have different structure than full records.
   * Defaults to calling extractId() if not implemented.
   */
  extractIdFromKeys?(keys: Record<string, unknown>): string;

  /** Transform source record to unified content */
  transformContent(record: Record<string, unknown>): Record<string, unknown>;

  /** Get created_at from source record */
  getCreatedAt(record: Record<string, unknown>): string | undefined;

  /** Get updated_at from source record */
  getUpdatedAt(record: Record<string, unknown>): string | undefined;

  /** Extract user ID from source record (optional) */
  extractUserId?(record: Record<string, unknown>): string | undefined;
}

/**
 * Build a UnifiedRecord using a transformer
 */
export function buildUnifiedRecord(
  transformer: RecordTransformer,
  sourceRecord: Record<string, unknown>,
  eventType: StreamEventType = 'INSERT'
): UnifiedRecord {
  const originalId = transformer.extractId(sourceRecord);
  const now = new Date().toISOString();

  return {
    PK: `${transformer.sourceTableName}#${originalId}`,
    SK: 'RECORD',
    source_type: transformer.sourceType,
    table_name: transformer.sourceTableName,
    original_id: originalId,
    record_type: transformer.recordType,
    content: transformer.transformContent(sourceRecord),
    created_at: transformer.getCreatedAt(sourceRecord) || now,
    updated_at: transformer.getUpdatedAt(sourceRecord) || now,
    user_id: transformer.extractUserId ? transformer.extractUserId(sourceRecord) : undefined,
    event_type: eventType,
    is_deleted: false,
    gsi_global_pk: 'GLOBAL',
    is_archived: false,
  };
}

/**
 * Extract ID for delete operations (REMOVE events).
 * Uses extractIdFromKeys if available, otherwise tries extractId.
 * Falls back to OldImage if Keys don't have expected fields.
 */
export function extractIdForDelete(
  transformer: RecordTransformer,
  keys: Record<string, unknown>,
  oldImage?: Record<string, unknown>
): string {
  // Try extractIdFromKeys first if implemented
  if (transformer.extractIdFromKeys) {
    try {
      return transformer.extractIdFromKeys(keys);
    } catch {
      // Fall through to other methods
    }
  }

  // Try extractId with keys
  try {
    return transformer.extractId(keys);
  } catch {
    // Keys don't have expected fields
  }

  // Try extractId with OldImage (contains full record)
  if (oldImage) {
    try {
      return transformer.extractId(oldImage);
    } catch {
      // OldImage doesn't have expected fields either
    }
  }

  throw new Error('Cannot extract ID for delete: no valid keys or oldImage');
}

// ════════════════════════════════════════════════════════════════════
// NOTES TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const notesTransformer: RecordTransformer = {
  sourceTableName: 'nexusnote-notes-production',
  sourceType: 'personal',
  recordType: 'NOTE',

  extractId(record) {
    const userId = record['userId'] as string;
    const noteId = record['noteId'] as string;
    if (!userId || !noteId) throw new Error('Missing userId or noteId');
    return `${userId}#${noteId}`;
  },

  transformContent(record) {
    return {
      noteTitle: record['title'] || '',
      noteContent: record['content'] || '',
      noteAiTags: record['aiTags'] || '',
    };
  },

  getCreatedAt(record) { return record['createdAt'] as string | undefined; },
  getUpdatedAt(record) { return record['updatedAt'] as string | undefined; },
  extractUserId(record) { return record['userId'] as string | undefined; },
};

// ════════════════════════════════════════════════════════════════════
// CONTACTS TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const contactsTransformer: RecordTransformer = {
  sourceTableName: 'nexusnote-inno-contacts-production',
  sourceType: 'personal',
  recordType: 'CONTACT',

  extractId(record) {
    const pk = record['PK'] as string;
    const sk = record['SK'] as string;
    if (!pk || !sk) throw new Error('Missing PK or SK');
    return `${pk}#${sk}`;
  },

  transformContent(record) {
    return {
      contactName: record['contactName'] || '',
      contactRole: record['role'] || '',
      contactWorkingStyle: record['workingStyle'] || '',
      contactNextInteraction: record['nextInteraction'] || '',
    };
  },

  getCreatedAt(record) { return record['createdAt'] as string | undefined; },
  getUpdatedAt(record) { return record['updatedAt'] as string | undefined; },
  extractUserId(record) {
    // PK is typically USER#<userId>
    const pk = record['PK'] as string;
    if (pk && pk.startsWith('USER#')) {
      return pk.replace('USER#', '');
    }
    return undefined;
  },
};

// ════════════════════════════════════════════════════════════════════
// THOUGHTS TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const thoughtsTransformer: RecordTransformer = {
  sourceTableName: 'nexusnote-thoughts-production',
  sourceType: 'personal',
  recordType: 'THOUGHT',

  extractId(record) {
    const userId = record['userId'] as string;
    const thoughtId = record['thoughtId'] as string;
    if (!userId || !thoughtId) throw new Error('Missing userId or thoughtId');
    return `${userId}#${thoughtId}`;
  },

  transformContent(record) {
    return {
      thoughtContent: record['content'] || '',
      thoughtTag: record['tagName'] || '',
    };
  },

  getCreatedAt(record) { return record['createdAt'] as string | undefined; },
  getUpdatedAt(record) { return record['createdAt'] as string | undefined; }, // No updatedAt
  extractUserId(record) { return record['userId'] as string | undefined; },
};

// ════════════════════════════════════════════════════════════════════
// PROJECTS TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const projectsTransformer: RecordTransformer = {
  sourceTableName: 'nexusnote-implementation-projects-production',
  sourceType: 'personal',
  recordType: 'PROJECT',

  extractId(record) {
    const userId = record['userId'] as string;
    const projectId = record['projectId'] as string;
    if (!userId || !projectId) throw new Error('Missing userId or projectId');
    return `${userId}#${projectId}`;
  },

  transformContent(record) {
    return {
      projectTitle: record['title'] || '',
      projectDescription: record['description'] || '',
      projectStatus: record['status'] || '',
      projectNotes: record['notes'] || '',
    };
  },

  getCreatedAt(record) { return record['createdAt'] as string | undefined; },
  getUpdatedAt(record) { return record['updatedAt'] as string | undefined; },
  extractUserId(record) { return record['userId'] as string | undefined; },
};


// ════════════════════════════════════════════════════════════════════
// CAPTURE TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const captureTransformer: RecordTransformer = {
  sourceTableName: 'Capture',
  sourceType: 'external',
  recordType: 'CAPTURE',

  extractId(record) {
    const pk = record['pk'] as string;
    const sk = record['sk'] as string;
    if (!pk || !sk) throw new Error('Missing pk or sk');
    return `${pk}#${sk}`;
  },

  transformContent(record) {
    return {
      captureTitle: record['title'] || '',
      captureContent: record['content'] || '',
      captureSource: record['source'] || '',
      captureSourceUrl: record['sourceUrl'] || '',
      captureUrl: record['url'] || '',
    };
  },

  getCreatedAt(record) { return record['capturedAt'] as string | undefined; },
  getUpdatedAt(record) { return record['capturedAt'] as string | undefined; },
};

// ════════════════════════════════════════════════════════════════════
// LLM COUNCIL TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const llmCouncilTransformer: RecordTransformer = {
  sourceTableName: 'LLMCouncilConversations',
  sourceType: 'external',
  recordType: 'LLM_CONVERSATION',

  extractId(record) {
    const id = record['id'] as string;
    if (!id) throw new Error('Missing id');
    if (id.startsWith('user_council')) {
      throw new Error('SKIPPING_RECORD: Internal user_council record');
    }
    return id;
  },

  transformContent(record) {
    const messages = record['messages'] as any[];
    let userQuery = '';
    let councilResponse = '';

    if (Array.isArray(messages) && messages.length > 0) {
      // 1. Extract User Query (usually first message)
      const firstMsg = messages[0];
      userQuery = firstMsg?.content || '';

      // 2. Extract Stage 3 Response (usually second message)
      if (messages.length > 1) {
        const secondMsg = messages[1];
        councilResponse = secondMsg?.stage3?.response || '';
      }
    }

    return {
      conversationId: record['id'] || '',
      conversationTitle: record['title'] || '', // Keep title if useful
      userQuery,
      councilResponse,
    };
  },

  getCreatedAt(record) { return record['created_at'] as string | undefined; },
  getUpdatedAt(record) { return record['created_at'] as string | undefined; },
  extractUserId(record) { return record['user_id'] as string | undefined; },
};

// ════════════════════════════════════════════════════════════════════
// SOLILOQUIES TRANSFORMER
// ════════════════════════════════════════════════════════════════════
export const soliloquiesTransformer: RecordTransformer = {
  sourceTableName: 'nexusnote-soliloquies-production',
  sourceType: 'personal',
  recordType: 'SOLILOQUY',

  extractId(record) {
    const id = record['soliloquyId'] as string;
    if (!id) throw new Error('Missing soliloquyId');
    return id;
  },

  // For REMOVE events, Keys may have 'soliloquyId' as partition key
  extractIdFromKeys(keys) {
    const id = keys['soliloquyId'] as string || keys['PK'] as string || keys['id'] as string;
    if (!id) throw new Error('Cannot extract ID from keys for REMOVE event');
    return id;
  },

  transformContent(record) {
    return {
      voiceNoteTranscript: record['normalizedContent'] || '',
      voiceNoteDurationSeconds: record['durationSeconds'] || 0,
    };
  },

  getCreatedAt(record) { return record['createdAt'] as string | undefined; },
  getUpdatedAt(record) { return record['processedAt'] as string | undefined; }, // Using processedAt as verified update time
  extractUserId(record) { return record['userId'] as string | undefined; },
};

// ════════════════════════════════════════════════════════════════════
// TRANSFORMER REGISTRY
// ════════════════════════════════════════════════════════════════════

/**
 * Map of processorId to transformer
 */
export const TRANSFORMERS: Record<string, RecordTransformer> = {
  'notes': notesTransformer,
  'contacts': contactsTransformer,
  'thoughts': thoughtsTransformer,
  'projects': projectsTransformer,
  'capture': captureTransformer,
  'llm-council': llmCouncilTransformer,
  'soliloquies': soliloquiesTransformer,
};

/**
 * Get transformer by processor ID
 */
export function getTransformer(processorId: string): RecordTransformer | undefined {
  return TRANSFORMERS[processorId];
}

/**
 * Get transformer by table name
 */
export function getTransformerByTableName(tableName: string): RecordTransformer | undefined {
  return Object.values(TRANSFORMERS).find(t => t.sourceTableName === tableName);
}

