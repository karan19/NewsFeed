# NewsFeed Project - TODO

## Technical Debt

### 🔴 High Priority

- [x] ~~**Move DynamoDB Stream configuration to NexusNote project**~~ 
  - ✅ RESOLVED: Streams are now managed via CDK Custom Resource in NewsFeed project
  - The `StreamEnabler` construct automatically enables streams on source tables during deployment
  - Source tables are configured in `src/config/source-tables.ts`

- [ ] **Move KMS key ARN to configuration instead of hardcoding**
  - Currently: KMS key ARN is hardcoded in `src/config/source-tables.ts`
  - Should be: KMS key ARN should be passed via context, SSM parameter, or exported from NexusNote
  - Why: Hardcoded ARNs are fragile and won't work across accounts/environments
  - KMS Key: `arn:aws:kms:us-west-2:654654148983:key/7e61921e-4255-4ec5-99e5-05efb9850bbb`
  - Action items:
    1. Export KMS key ARN from NexusNote CDK (or store in SSM Parameter Store)
    2. Update NewsFeed CDK to import the KMS key ARN dynamically
    3. Remove hardcoded KMS key ARN from `src/config/source-tables.ts`

### 🟡 Medium Priority

- [ ] **Add Dead Letter Queue (DLQ) for Lambda failures**
  - Stream processors should have DLQs to capture failed events
  
- [ ] **Add CloudWatch alarms for stream processing errors**
  - Monitor for Lambda errors, throttling, iterator age

- [x] ~~**Implement backfill script for existing data**~~
  - ✅ COMPLETED: `scripts/backfill.ts` created
  - Run with: `npx ts-node scripts/backfill.ts --all --profile codex`
  - Supports: dry-run, single table, limit, all tables
  - Backfilled 196 records on 2025-11-30

### 🟢 Low Priority

- [ ] **Add integration tests**
  - Test stream processing end-to-end with localstack or real AWS

- [ ] **Refactor Lambda handlers to use shared transformers**
  - Currently: Each Lambda has its own transformation logic
  - Should be: Import from `src/shared/transformers/index.ts`
  - Why: Single source of truth, easier maintenance

---

## Adding a New Source Table

To add a new source table to the newsfeed:

1. **Add configuration** to `src/config/source-tables.ts`:
   ```typescript
   {
     processorId: 'new-table',
     tableName: 'my-new-table-production',
     sourceType: 'personal',
     recordType: 'NEW_TYPE',
     description: 'Syncs new table to unified newsfeed',
     syncedFields: ['field1', 'field2'],
     enabled: true,
   }
   ```

2. **Add transformer** to `src/shared/transformers/index.ts`:
   ```typescript
   export const newTableTransformer: RecordTransformer = {
     sourceTableName: 'my-new-table-production',
     sourceType: 'personal',
     recordType: 'NEW_TYPE',
     extractId(record) { /* ... */ },
     transformContent(record) { /* ... */ },
     getCreatedAt(record) { /* ... */ },
     getUpdatedAt(record) { /* ... */ },
   };
   ```

3. **Create Lambda handler** at `src/lambdas/{processorId}-stream-processor/handler.ts`

4. **Deploy**: `npx cdk deploy --profile codex`

5. **Backfill existing data**: `npx ts-node scripts/backfill.ts --table {processorId} --profile codex`

The CDK stack will automatically:
- Enable DynamoDB Streams on the source table
- Create the Lambda processor
- Wire up the event source mapping

---

## Changing Synced Fields

To change which fields are synced for an existing table:

1. **Update the transformer** in `src/shared/transformers/index.ts`
2. **Update the Lambda handler** (if not using shared transformer)
3. **Deploy**: `npx cdk deploy --profile codex`
4. **Backfill** to update existing records: `npx ts-node scripts/backfill.ts --table {processorId} --profile codex`

---

## Stream ARNs (auto-managed)

Stream ARNs are now automatically detected and managed by the `StreamEnabler` Custom Resource.
No manual configuration needed!

---

## Current Statistics (as of 2025-11-30)

| Metric | Value |
|--------|-------|
| Source Tables | 8 |
| Total Records in Unified Table | 197 |
| Lambda Processors | 8 |
| Stream Enablers | 8 |
