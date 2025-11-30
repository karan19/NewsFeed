/**
 * Source Tables Configuration
 * 
 * This file defines all DynamoDB tables that should be synced to the unified NewsFeed table.
 * When you add a new table here, the CDK stack will:
 * 1. Enable DynamoDB Streams on the table (if not already enabled)
 * 2. Create a Lambda processor to sync changes to the unified table
 * 
 * To add a new source table:
 * 1. Add an entry to SOURCE_TABLES below
 * 2. Create a corresponding Lambda handler in src/lambdas/{processorId}-stream-processor/
 * 3. Run `cdk deploy`
 */

/**
 * Configuration for a source table
 */
export interface SourceTableConfig {
  /** Unique identifier for this source (used in Lambda naming, e.g., 'notes', 'contacts') */
  processorId: string;
  
  /** Full DynamoDB table name */
  tableName: string;
  
  /** Source type for categorization in unified table ('personal' | 'external') */
  sourceType: 'personal' | 'external';
  
  /** Record type for GSI queries in unified table (e.g., 'NOTE', 'CONTACT') */
  recordType: string;
  
  /** Description for the Lambda function */
  description: string;
  
  /** Fields to sync from source to unified table (for documentation) */
  syncedFields: string[];
  
  /** Whether this table is enabled for syncing */
  enabled: boolean;
}

/**
 * List of all source tables to sync to the unified NewsFeed table
 * 
 * Add new tables here to include them in the newsfeed sync
 */
export const SOURCE_TABLES: SourceTableConfig[] = [
  // ════════════════════════════════════════════════════════════════════
  // NEXUSNOTE TABLES
  // ════════════════════════════════════════════════════════════════════
  {
    processorId: 'notes',
    tableName: 'nexusnote-notes-production',
    sourceType: 'personal',
    recordType: 'NOTE',
    description: 'Syncs notes from NexusNote to unified newsfeed',
    syncedFields: ['title', 'content'],
    enabled: true,
  },
  {
    processorId: 'contacts',
    tableName: 'nexusnote-inno-contacts-production',
    sourceType: 'personal',
    recordType: 'CONTACT',
    description: 'Syncs contacts from NexusNote to unified newsfeed',
    syncedFields: ['contactName', 'role', 'workingStyle'],
    enabled: true,
  },
  {
    processorId: 'thoughts',
    tableName: 'nexusnote-thoughts-production',
    sourceType: 'personal',
    recordType: 'THOUGHT',
    description: 'Syncs thoughts from NexusNote to unified newsfeed',
    syncedFields: ['content', 'tagName'],
    enabled: true,
  },
  {
    processorId: 'projects',
    tableName: 'nexusnote-implementation-projects-production',
    sourceType: 'personal',
    recordType: 'PROJECT',
    description: 'Syncs implementation projects from NexusNote to unified newsfeed',
    syncedFields: ['title', 'description', 'status'],
    enabled: true,
  },
  {
    processorId: 'workboard',
    tableName: 'nexusnote-tracking-workboard-production',
    sourceType: 'personal',
    recordType: 'WORKBOARD',
    description: 'Syncs workboard items from NexusNote to unified newsfeed',
    syncedFields: ['chainId', 'slotIndex', 'archived'],
    enabled: true,
  },

  // ════════════════════════════════════════════════════════════════════
  // CAPTURE TABLE
  // ════════════════════════════════════════════════════════════════════
  {
    processorId: 'capture',
    tableName: 'Capture',
    sourceType: 'external',
    recordType: 'CAPTURE',
    description: 'Syncs captured content from various sources to unified newsfeed',
    syncedFields: ['title', 'content', 'source', 'sourceUrl'],
    enabled: true,
  },

  // ════════════════════════════════════════════════════════════════════
  // CHAT/CONVERSATION TABLES
  // ════════════════════════════════════════════════════════════════════
  {
    processorId: 'llm-council',
    tableName: 'LlmCouncilStack-ConversationsTableCD91EB96-17V5OM4BFKIY8',
    sourceType: 'external',
    recordType: 'LLM_CONVERSATION',
    description: 'Syncs LLM Council conversations to unified newsfeed',
    syncedFields: ['id'],
    enabled: true,
  },
  {
    processorId: 'mcp-chat',
    tableName: 'MCP-chat-conversations',
    sourceType: 'external',
    recordType: 'MCP_CONVERSATION',
    description: 'Syncs MCP chat conversations to unified newsfeed',
    syncedFields: ['sessionId', 'userId'],
    enabled: true,
  },

  // ════════════════════════════════════════════════════════════════════
  // BACKUP/UTILITY TABLES (Not suitable for newsfeed - disabled)
  // ════════════════════════════════════════════════════════════════════
  // {
  //   processorId: 'n8n-backup',
  //   tableName: 'N8N-Optimized-Backup',
  //   sourceType: 'external',
  //   recordType: 'N8N_BACKUP',
  //   description: 'N8N workflow backups - not suitable for newsfeed',
  //   syncedFields: ['pk'],
  //   enabled: false,  // Backup data, not content
  // },

  // ════════════════════════════════════════════════════════════════════
  // TABLES WITH NO DATA YET (Commented out - enable when data exists)
  // ════════════════════════════════════════════════════════════════════
  // {
  //   processorId: 'soliloquies',
  //   tableName: 'nexusnote-soliloquies-production',
  //   sourceType: 'personal',
  //   recordType: 'SOLILOQUY',
  //   description: 'Syncs soliloquies from NexusNote to unified newsfeed',
  //   syncedFields: ['content'],  // Assumed - table is currently empty
  //   enabled: false,  // Enable when table has data
  // },

  // ════════════════════════════════════════════════════════════════════
  // METADATA TABLES (Not suitable for newsfeed - disabled)
  // ════════════════════════════════════════════════════════════════════
  // {
  //   processorId: 'thought-tags',
  //   tableName: 'nexusnote-thought-tags-production',
  //   sourceType: 'personal',
  //   recordType: 'THOUGHT_TAG',
  //   description: 'Tag metadata - not suitable for newsfeed content',
  //   syncedFields: ['name'],
  //   enabled: false,  // Metadata table, not content
  // },
];

/**
 * Get only enabled source tables
 */
export function getEnabledSourceTables(): SourceTableConfig[] {
  return SOURCE_TABLES.filter(table => table.enabled);
}

/**
 * Get a source table config by processor ID
 */
export function getSourceTableByProcessorId(processorId: string): SourceTableConfig | undefined {
  return SOURCE_TABLES.find(table => table.processorId === processorId);
}

/**
 * KMS Key ARN for encrypted DynamoDB tables
 * TODO: Move this to SSM Parameter Store or import from NexusNote stack
 */
export const KMS_KEY_ARN = 'arn:aws:kms:us-west-2:654654148983:key/7e61921e-4255-4ec5-99e5-05efb9850bbb';
