/**
 * Represents a record in the unified DynamoDB table
 */
export interface UnifiedRecord {
  /** Primary key: {TABLE_NAME}#{original_id} */
  PK: string;
  
  /** Sort key: Can be used for versioning or additional sorting */
  SK: string;
  
  /** Source type: 'personal' | 'external' | etc. */
  source_type: string;
  
  /** Original table name */
  table_name: string;
  
  /** Original record's primary key */
  original_id: string;
  
  /** Record type for GSI queries (e.g., 'FEED_ITEM') */
  record_type: string;
  
  /** The actual content/data from the source record */
  content: Record<string, unknown>;
  
  /** ISO 8601 timestamp when record was created */
  created_at: string;
  
  /** ISO 8601 timestamp when record was last updated */
  updated_at: string;
  
  /** Last event type that triggered this record update */
  event_type: 'INSERT' | 'MODIFY' | 'REMOVE';
  
  /** Soft delete flag */
  is_deleted: boolean;

  /** Global Feed Partition Key (Always 'GLOBAL') */
  gsi_global_pk: string;
}

/**
 * DynamoDB Stream event types
 */
export type StreamEventType = 'INSERT' | 'MODIFY' | 'REMOVE';

/**
 * Configuration for a source table
 */
export interface SourceTableConfig {
  /** Name of the source DynamoDB table */
  tableName: string;
  
  /** Source type identifier */
  sourceType: string;
  
  /** Function to extract the primary key from a source record */
  extractId: (record: Record<string, unknown>) => string;
  
  /** Function to transform source record to unified content */
  transformContent: (record: Record<string, unknown>) => Record<string, unknown>;
}

