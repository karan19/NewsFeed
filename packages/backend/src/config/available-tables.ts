/**
 * Available DynamoDB Tables
 * 
 * This file contains all DynamoDB tables available in the AWS account (us-west-2).
 * Use this as a reference when adding new source tables to the newsfeed.
 * 
 * Last Updated: 2025-11-30
 * AWS Profile: codex
 * Region: us-west-2
 */

export interface AvailableTable {
  /** Table name in DynamoDB */
  tableName: string;
  
  /** Category/Application the table belongs to */
  category: string;
  
  /** Primary key structure */
  keys: {
    partitionKey: string;
    sortKey?: string;
  };
  
  /** All known attributes (from sample records) */
  attributes: string[];
  
  /** Whether this table is already configured for NewsFeed sync */
  configuredForNewsFeed: boolean;
  
  /** Notes about the table */
  notes?: string;
}

/**
 * All available DynamoDB tables in the account
 */
export const AVAILABLE_TABLES: AvailableTable[] = [
  // ═══════════════════════════════════════════════════════════════════
  // ALREADY CONFIGURED FOR NEWSFEED
  // ═══════════════════════════════════════════════════════════════════
  {
    tableName: 'nexusnote-notes-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'noteId',
    },
    attributes: [
      'userId',
      'noteId',
      'title',          // ✅ Synced
      'content',        // ✅ Synced
      'status',
      'statusUpdatedAt',
      'createdAt',
      'updatedAt',
      'pinned',
      'manualTags',
      'aiTags',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: title, content',
  },
  {
    tableName: 'nexusnote-inno-contacts-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'PK',
      sortKey: 'SK',
    },
    attributes: [
      'PK',
      'SK',
      'GSI1PK',
      'GSI1SK',
      'userId',
      'contactName',    // ✅ Synced
      'role',           // ✅ Synced
      'workingStyle',   // ✅ Synced
      'personalityTraits',
      'nextInteractionPlan',
      'supportLearnToggle',
      'notes',
      'createdAt',
      'updatedAt',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: contactName, role, workingStyle',
  },

  // ═══════════════════════════════════════════════════════════════════
  // NEXUSNOTE TABLES (Not yet configured)
  // ═══════════════════════════════════════════════════════════════════
  {
    tableName: 'nexusnote-thoughts-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'thoughtId',
    },
    attributes: [
      'userId',
      'thoughtId',
      'content',        // ✅ Synced
      'tagName',        // ✅ Synced
      'userTag',
      'createdAt',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: content, tagName',
  },
  {
    tableName: 'nexusnote-before-i-forget-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'itemId',
    },
    attributes: [
      'userId',
      'itemId',
      'content',
      'createdAt',
      'expiresAt',
    ],
    configuredForNewsFeed: false,
    notes: 'Quick capture items with expiration',
  },
  {
    tableName: 'nexusnote-implementation-projects-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'projectId',
    },
    attributes: [
      'userId',
      'projectId',
      'title',           // ✅ Synced
      'description',     // ✅ Synced
      'notes',
      'status',          // ✅ Synced
      'priorityIndex',
      'createdAt',
      'updatedAt',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: title, description, status',
  },
  {
    tableName: 'nexusnote-soliloquies-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'sortKey',
    },
    attributes: [
      'userId',
      'sortKey',
      // Table appears to be empty - attributes unknown
    ],
    configuredForNewsFeed: false,
    notes: 'Table is empty - no sample data available',
  },
  {
    tableName: 'nexusnote-shared-data-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'dataId',
    },
    attributes: [
      'userId',
      'dataId',
      'title',
      'mapId',
      'color',
      'createdAt',
      'updatedAt',
    ],
    configuredForNewsFeed: false,
  },
  {
    tableName: 'nexusnote-thought-tags-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'userId',
      sortKey: 'name',
    },
    attributes: [
      'userId',
      'name',
      // Likely metadata table for tags
    ],
    configuredForNewsFeed: false,
    notes: 'Tag metadata - may not be suitable for newsfeed',
  },
  {
    tableName: 'nexusnote-tracking-workboard-production',
    category: 'NexusNote',
    keys: {
      partitionKey: 'PK',
      sortKey: 'SK',
    },
    attributes: [
      'PK',
      'SK',
      'chainId',         // ✅ Synced
      'rootNodeId',
      'slotIndex',       // ✅ Synced
      'length',
      'archived',        // ✅ Synced
      'createdAt',
      'lastActiveAt',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: chainId, slotIndex, archived',
  },

  // ═══════════════════════════════════════════════════════════════════
  // CAPTURE TABLE
  // ═══════════════════════════════════════════════════════════════════
  {
    tableName: 'Capture',
    category: 'Capture',
    keys: {
      partitionKey: 'pk',
      sortKey: 'sk',
    },
    attributes: [
      'pk',
      'sk',
      'id',
      'title',           // ✅ Synced
      'content',         // ✅ Synced
      'source',          // ✅ Synced
      'sourceUrl',       // ✅ Synced
      'primaryTag',
      'capturedAt',
      'contentHash',
      'tableName',
      'allPk',
      'idLookupPk',
      'idLookupSk',
      'sourceTagKey',
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: title, content, source, sourceUrl',
  },

  // ═══════════════════════════════════════════════════════════════════
  // OTHER APPLICATIONS
  // ═══════════════════════════════════════════════════════════════════
  {
    tableName: 'LlmCouncilStack-ConversationsTableCD91EB96-17V5OM4BFKIY8',
    category: 'LLM Council',
    keys: {
      partitionKey: 'id',
    },
    attributes: [
      'id',              // ✅ Synced
      // Conversation data - structure unknown
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: id (expand as schema is discovered)',
  },
  {
    tableName: 'MCP-chat-conversations',
    category: 'MCP Chat',
    keys: {
      partitionKey: 'sessionId',
      sortKey: 'createdAt',
    },
    attributes: [
      'sessionId',       // ✅ Synced
      'createdAt',
      'lastMessageAt',
      'userId',          // ✅ Synced
      // Message content likely present
    ],
    configuredForNewsFeed: true,
    notes: 'Syncing: sessionId, userId',
  },
  {
    tableName: 'N8N-Optimized-Backup',
    category: 'N8N',
    keys: {
      partitionKey: 'pk',
    },
    attributes: [
      'pk',
      // Backup data - structure unknown
    ],
    configuredForNewsFeed: false,
    notes: 'N8N workflow backups - likely not suitable for newsfeed',
  },

  // ═══════════════════════════════════════════════════════════════════
  // NEWSFEED INTERNAL (Do not sync)
  // ═══════════════════════════════════════════════════════════════════
  {
    tableName: 'NewsFeed_Unified_Table',
    category: 'NewsFeed',
    keys: {
      partitionKey: 'PK',
      sortKey: 'SK',
    },
    attributes: [
      'PK',
      'SK',
      'source_type',
      'table_name',
      'original_id',
      'record_type',
      'content',
      'created_at',
      'updated_at',
      'event_type',
      'is_deleted',
    ],
    configuredForNewsFeed: false,
    notes: '⚠️ This is the NewsFeed unified table - DO NOT SYNC',
  },
];

/**
 * Get tables that are not yet configured for NewsFeed
 */
export function getUnconfiguredTables(): AvailableTable[] {
  return AVAILABLE_TABLES.filter(
    t => !t.configuredForNewsFeed && t.tableName !== 'NewsFeed_Unified_Table'
  );
}

/**
 * Get tables by category
 */
export function getTablesByCategory(category: string): AvailableTable[] {
  return AVAILABLE_TABLES.filter(t => t.category === category);
}

/**
 * Get a specific table by name
 */
export function getTableByName(tableName: string): AvailableTable | undefined {
  return AVAILABLE_TABLES.find(t => t.tableName === tableName);
}

/**
 * Print a summary of available tables (for CLI usage)
 */
export function printTableSummary(): void {
  console.log('\n📊 Available DynamoDB Tables\n');
  console.log('═'.repeat(80));
  
  const categories = [...new Set(AVAILABLE_TABLES.map(t => t.category))];
  
  for (const category of categories) {
    console.log(`\n📁 ${category}`);
    console.log('─'.repeat(40));
    
    const tables = getTablesByCategory(category);
    for (const table of tables) {
      const status = table.configuredForNewsFeed ? '✅' : '⬜';
      const warning = table.tableName === 'NewsFeed_Unified_Table' ? ' ⚠️' : '';
      console.log(`  ${status} ${table.tableName}${warning}`);
      if (table.notes) {
        console.log(`     └─ ${table.notes}`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ = Configured for NewsFeed | ⬜ = Not configured | ⚠️ = Do not sync\n');
}

