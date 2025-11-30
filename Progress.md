# NewsFeed Project - Progress

> Last Updated: 2025-11-30

## Project Overview

A newsfeed application that consolidates data from multiple DynamoDB tables into a unified table using AWS Lambda and DynamoDB Streams.

---

## ✅ Completed Milestones

### Phase 1: Project Setup (Completed)

- [x] Created project structure with CDK TypeScript
- [x] Set up Cursor rules (`.cursorrules`) for coding conventions
- [x] Configured TypeScript with strict mode
- [x] Set up Jest for testing
- [x] Created shared utilities (logger, DynamoDB client)
- [x] Defined TypeScript interfaces for unified records

### Phase 2: Infrastructure (Completed)

- [x] Created unified DynamoDB table: `NewsFeed_Unified_Table`
  - Partition Key: `PK` (String)
  - Sort Key: `SK` (String)
  - GSI1: `GSI1_Source_Type_Created_At` (for filtering by source type)
  - GSI2: `GSI2_Record_Type_Created_At` (for filtering by record type)
  - Billing: Pay-per-request
  - Point-in-time recovery: Enabled
  - Streams: Enabled (NEW_AND_OLD_IMAGES)

- [x] Created Lambda stream processors:
  - `NewsFeed_Notes_Processor` - processes notes table stream
  - `NewsFeed_Contacts_Processor` - processes contacts table stream

- [x] Enabled DynamoDB Streams on source tables (via CLI - see TODO for proper fix)
- [x] Added KMS decrypt permissions for encrypted source tables
- [x] Deployed stack to AWS: `NewsFeed-Stack`

### Phase 3: Stream Processing (Completed)

- [x] Notes stream processor syncs: `title`, `content`
- [x] Contacts stream processor syncs: `contactName`, `role`, `workingStyle`
- [x] Verified real-time sync with test records
- [x] Both INSERT and MODIFY events handled
- [x] Soft delete on REMOVE events (sets `is_deleted: true`)

---

## 📊 Current State

### AWS Resources Deployed

| Resource | Name | Region |
|----------|------|--------|
| CloudFormation Stack | `NewsFeed-Stack` | us-west-2 |
| Unified Table | `NewsFeed_Unified_Table` | us-west-2 |
| Notes Lambda | `NewsFeed_Notes_Processor` | us-west-2 |
| Contacts Lambda | `NewsFeed_Contacts_Processor` | us-west-2 |

### Source Tables Connected

| Source Table | Stream Status | Processor |
|--------------|---------------|-----------|
| `nexusnote-notes-production` | ✅ Enabled | `NewsFeed_Notes_Processor` |
| `nexusnote-inno-contacts-production` | ✅ Enabled | `NewsFeed_Contacts_Processor` |

### Unified Table Schema

```
PK: {TABLE_NAME}#{original_composite_key}
SK: RECORD
source_type: "personal" | "external"
table_name: original table name
original_id: original record's key
record_type: "NOTE" | "CONTACT"
content: { synced fields as map }
created_at: ISO 8601 timestamp
updated_at: ISO 8601 timestamp
event_type: "INSERT" | "MODIFY" | "REMOVE"
is_deleted: boolean
```

### Field Mappings

| Source Table | Fields Synced to Unified Table |
|--------------|-------------------------------|
| `nexusnote-notes-production` | `title`, `content` |
| `nexusnote-inno-contacts-production` | `contactName`, `role`, `workingStyle` |

### Tags on All Resources

| Tag | Value |
|-----|-------|
| Project | NewsFeed |
| Environment | Production |

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `cdk.json` | CDK config with stream ARNs in context |
| `.cursorrules` | Coding conventions and naming standards |
| `tsconfig.json` | TypeScript strict configuration |
| `package.json` | Dependencies and scripts |

### Stream ARNs (in cdk.json)

```json
{
  "notesStreamArn": "arn:aws:dynamodb:us-west-2:654654148983:table/nexusnote-notes-production/stream/2025-11-30T03:37:42.793",
  "contactsStreamArn": "arn:aws:dynamodb:us-west-2:654654148983:table/nexusnote-inno-contacts-production/stream/2025-11-30T03:37:44.275"
}
```

---

## 📁 Project Structure

```
NewsFeed/
├── bin/
│   └── app.ts                          # CDK app entry point
├── lib/
│   ├── newsfeed-stack.ts               # Main CDK stack
│   └── constructs/
│       └── source-table-processor.ts   # Reusable processor construct
├── src/
│   ├── lambdas/
│   │   ├── notes-stream-processor/
│   │   │   └── handler.ts              # Notes stream handler
│   │   └── contacts-stream-processor/
│   │       └── handler.ts              # Contacts stream handler
│   └── shared/
│       ├── types/
│       │   └── unified-record.ts       # TypeScript interfaces
│       └── utils/
│           ├── logger.ts               # Structured JSON logger
│           └── dynamodb-client.ts      # DynamoDB helper functions
├── test/
│   └── newsfeed-stack.test.ts          # CDK stack tests
├── .cursorrules                        # Coding conventions
├── .gitignore
├── cdk.json                            # CDK configuration
├── jest.config.js
├── package.json
├── tsconfig.json
├── ProjectDescription.md               # Original project description
├── Progress.md                         # This file
└── TODO.md                             # Technical debt tracker
```

---

## 🚀 How to Resume Development

### Prerequisites
- AWS CLI configured with `codex` profile
- Node.js 20.x
- CDK CLI installed (`npm install -g aws-cdk`)

### Quick Start

```bash
# Navigate to project
cd /Users/karankanchetty/workplace/M1000M/AWS/NewsFeed

# Install dependencies
npm install

# Build
npm run build

# Deploy changes
npx cdk deploy --profile codex

# Run tests
npm test
```

### Useful Commands

```bash
# Check unified table contents
aws dynamodb scan --table-name NewsFeed_Unified_Table --profile codex --region us-west-2

# Check Lambda logs
aws logs tail /aws/lambda/NewsFeed_Notes_Processor --profile codex --region us-west-2 --follow

# Check event source mapping status
aws lambda list-event-source-mappings --function-name NewsFeed_Notes_Processor --profile codex --region us-west-2
```

---

## 🔜 Next Steps (Not Started)

1. **Backfill existing data** - Sync existing records from source tables to unified table
2. **Build newsfeed API** - API Gateway + Lambda to query unified table
3. **Add search indexing** - OpenSearch integration for full-text search
4. **Build newsfeed UI** - Frontend to display the feed

---

## 📝 Notes

- Source tables are KMS encrypted with key: `7e61921e-4255-4ec5-99e5-05efb9850bbb`
- Stream processing uses `TRIM_HORIZON` starting position (processes from beginning)
- Batch size: 10 records, max batching window: 5 seconds
- Retry attempts: 3, with bisect on error enabled
- See `TODO.md` for technical debt items to address

