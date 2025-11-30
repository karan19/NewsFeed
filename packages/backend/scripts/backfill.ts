#!/usr/bin/env npx ts-node
/**
 * Backfill Script
 * 
 * Syncs existing data from source tables to the unified NewsFeed table.
 * 
 * Usage:
 *   npx ts-node scripts/backfill.ts --table notes              # Backfill single table
 *   npx ts-node scripts/backfill.ts --all                      # Backfill all tables
 *   npx ts-node scripts/backfill.ts --table notes --dry-run    # Preview without writing
 *   npx ts-node scripts/backfill.ts --table notes --limit 10   # Limit records (for testing)
 * 
 * Environment:
 *   AWS_PROFILE=codex (or set via --profile)
 *   AWS_REGION=us-west-2 (or set via --region)
 */

import { DynamoDBClient, ScanCommand, ScanCommandInput } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { getEnabledSourceTables, SourceTableConfig } from '../src/config/source-tables';
import { getTransformer, buildUnifiedRecord, RecordTransformer } from '../src/shared/transformers';
import { UnifiedRecord } from '../src/shared/types';

// ════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════════════

const UNIFIED_TABLE_NAME = 'NewsFeed_Unified_Table';
const BATCH_SIZE = 25; // DynamoDB BatchWrite limit
const DEFAULT_REGION = 'us-west-2';

// ════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING
// ════════════════════════════════════════════════════════════════════

interface CliArgs {
  table?: string;
  all: boolean;
  dryRun: boolean;
  limit?: number;
  profile?: string;
  region: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    all: false,
    dryRun: false,
    region: DEFAULT_REGION,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--table':
      case '-t':
        result.table = args[++i];
        break;
      case '--all':
      case '-a':
        result.all = true;
        break;
      case '--dry-run':
      case '-d':
        result.dryRun = true;
        break;
      case '--limit':
      case '-l':
        result.limit = parseInt(args[++i], 10);
        break;
      case '--profile':
      case '-p':
        result.profile = args[++i];
        break;
      case '--region':
      case '-r':
        result.region = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
📦 NewsFeed Backfill Script

Usage:
  npx ts-node scripts/backfill.ts [options]

Options:
  --table, -t <id>    Backfill a specific table by processor ID
  --all, -a           Backfill all enabled tables
  --dry-run, -d       Preview without writing to unified table
  --limit, -l <n>     Limit number of records to process (for testing)
  --profile, -p <n>   AWS profile to use (default: from environment)
  --region, -r <r>    AWS region (default: us-west-2)
  --help, -h          Show this help message

Available processor IDs:
${getEnabledSourceTables().map(t => `  - ${t.processorId} (${t.tableName})`).join('\n')}

Examples:
  npx ts-node scripts/backfill.ts --table notes
  npx ts-node scripts/backfill.ts --all --dry-run
  npx ts-node scripts/backfill.ts --table capture --limit 10 --profile codex
`);
}

// ════════════════════════════════════════════════════════════════════
// DYNAMODB CLIENT
// ════════════════════════════════════════════════════════════════════

function createDynamoClient(region: string, profile?: string): DynamoDBDocumentClient {
  const clientConfig: { region: string } = { region };
  
  // Note: AWS SDK will use AWS_PROFILE env var or --profile if set
  if (profile) {
    process.env.AWS_PROFILE = profile;
  }

  const client = new DynamoDBClient(clientConfig);
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

// ════════════════════════════════════════════════════════════════════
// BACKFILL LOGIC
// ════════════════════════════════════════════════════════════════════

interface BackfillStats {
  tableName: string;
  scanned: number;
  transformed: number;
  written: number;
  errors: number;
  skipped: number;
  durationMs: number;
}

async function backfillTable(
  docClient: DynamoDBDocumentClient,
  config: SourceTableConfig,
  transformer: RecordTransformer,
  options: { dryRun: boolean; limit?: number }
): Promise<BackfillStats> {
  const startTime = Date.now();
  const stats: BackfillStats = {
    tableName: config.tableName,
    scanned: 0,
    transformed: 0,
    written: 0,
    errors: 0,
    skipped: 0,
    durationMs: 0,
  };

  console.log(`\n📊 Backfilling: ${config.tableName}`);
  console.log(`   Processor: ${config.processorId}`);
  console.log(`   Record Type: ${config.recordType}`);
  console.log(`   Synced Fields: ${config.syncedFields.join(', ')}`);
  if (options.dryRun) console.log(`   🔍 DRY RUN MODE - No writes will be made`);
  if (options.limit) console.log(`   ⚠️  Limited to ${options.limit} records`);
  console.log('');

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const unifiedRecords: UnifiedRecord[] = [];

  // Scan source table
  do {
    const scanParams: ScanCommandInput = {
      TableName: config.tableName,
      ExclusiveStartKey: lastEvaluatedKey as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue> | undefined,
    };

    if (options.limit && stats.scanned >= options.limit) {
      break;
    }

    const response = await docClient.send(new ScanCommand(scanParams));
    lastEvaluatedKey = response.LastEvaluatedKey as Record<string, unknown> | undefined;

    if (!response.Items) continue;

    for (const item of response.Items) {
      if (options.limit && stats.scanned >= options.limit) {
        break;
      }

      stats.scanned++;
      
      try {
        const record = unmarshall(item as Record<string, import('@aws-sdk/client-dynamodb').AttributeValue>);
        const unifiedRecord = buildUnifiedRecord(transformer, record, 'INSERT');
        unifiedRecords.push(unifiedRecord);
        stats.transformed++;
      } catch (error) {
        stats.errors++;
        console.error(`   ❌ Error transforming record: ${(error as Error).message}`);
      }
    }

    // Progress indicator
    process.stdout.write(`\r   Scanned: ${stats.scanned} | Transformed: ${stats.transformed} | Errors: ${stats.errors}`);

  } while (lastEvaluatedKey && (!options.limit || stats.scanned < options.limit));

  console.log(''); // New line after progress

  // Write to unified table in batches
  if (!options.dryRun && unifiedRecords.length > 0) {
    console.log(`   Writing ${unifiedRecords.length} records to unified table...`);
    
    for (let i = 0; i < unifiedRecords.length; i += BATCH_SIZE) {
      const batch = unifiedRecords.slice(i, i + BATCH_SIZE);
      
      try {
        await docClient.send(new BatchWriteCommand({
          RequestItems: {
            [UNIFIED_TABLE_NAME]: batch.map(item => ({
              PutRequest: { Item: item as unknown as Record<string, unknown> },
            })),
          },
        }));
        stats.written += batch.length;
        process.stdout.write(`\r   Written: ${stats.written}/${unifiedRecords.length}`);
      } catch (error) {
        console.error(`\n   ❌ Batch write error: ${(error as Error).message}`);
        stats.errors += batch.length;
      }
    }
    console.log(''); // New line after progress
  } else if (options.dryRun) {
    console.log(`   🔍 Would write ${unifiedRecords.length} records (dry run)`);
    stats.written = unifiedRecords.length; // Count as "would write"
  }

  stats.durationMs = Date.now() - startTime;
  return stats;
}

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log('\n🚀 NewsFeed Backfill Script\n');
  console.log('═'.repeat(60));

  const args = parseArgs();

  if (!args.table && !args.all) {
    console.error('❌ Error: Please specify --table <id> or --all\n');
    printHelp();
    process.exit(1);
  }

  const docClient = createDynamoClient(args.region, args.profile);
  const enabledTables = getEnabledSourceTables();
  const allStats: BackfillStats[] = [];

  // Determine which tables to backfill
  let tablesToBackfill: SourceTableConfig[];
  
  if (args.all) {
    tablesToBackfill = enabledTables;
    console.log(`\n📋 Backfilling ALL ${enabledTables.length} enabled tables`);
  } else {
    const config = enabledTables.find(t => t.processorId === args.table);
    if (!config) {
      console.error(`❌ Error: Unknown processor ID "${args.table}"`);
      console.log('\nAvailable processor IDs:');
      enabledTables.forEach(t => console.log(`  - ${t.processorId}`));
      process.exit(1);
    }
    tablesToBackfill = [config];
  }

  // Backfill each table
  for (const config of tablesToBackfill) {
    const transformer = getTransformer(config.processorId);
    if (!transformer) {
      console.error(`❌ No transformer found for ${config.processorId}`);
      continue;
    }

    try {
      const stats = await backfillTable(docClient, config, transformer, {
        dryRun: args.dryRun,
        limit: args.limit,
      });
      allStats.push(stats);
    } catch (error) {
      console.error(`❌ Failed to backfill ${config.tableName}: ${(error as Error).message}`);
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 BACKFILL SUMMARY\n');
  
  let totalScanned = 0;
  let totalWritten = 0;
  let totalErrors = 0;
  let totalDuration = 0;

  for (const stats of allStats) {
    const status = stats.errors > 0 ? '⚠️' : '✅';
    console.log(`${status} ${stats.tableName}`);
    console.log(`   Scanned: ${stats.scanned} | Written: ${stats.written} | Errors: ${stats.errors} | Time: ${(stats.durationMs / 1000).toFixed(1)}s`);
    
    totalScanned += stats.scanned;
    totalWritten += stats.written;
    totalErrors += stats.errors;
    totalDuration += stats.durationMs;
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`📈 TOTAL: Scanned ${totalScanned} | Written ${totalWritten} | Errors ${totalErrors}`);
  console.log(`⏱️  Total Time: ${(totalDuration / 1000).toFixed(1)}s`);
  
  if (args.dryRun) {
    console.log('\n🔍 This was a DRY RUN - no data was written');
  }
  
  console.log('\n✨ Done!\n');
}

// Run
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

