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

- [x] Created Lambda stream processors (8 total)
- [x] Enabled DynamoDB Streams on source tables
- [x] Added KMS decrypt permissions for encrypted source tables
- [x] Deployed stack to AWS: `NewsFeed-Stack`

### Phase 3: Stream Processing (Completed)

- [x] All 8 stream processors syncing data
- [x] Both INSERT and MODIFY events handled
- [x] Soft delete on REMOVE events (sets `is_deleted: true`)
- [x] Verified real-time sync with test records

### Phase 4: Dynamic Stream Management (Completed)

- [x] Created source tables configuration file (`src/config/source-tables.ts`)
- [x] Created `StreamEnabler` Custom Resource construct
- [x] CDK now automatically enables streams on source tables during deployment
- [x] Removed hardcoded stream ARNs from `cdk.json`
- [x] Adding new source tables is now configuration-driven

### Phase 5: Multi-Table Expansion (Completed)

- [x] Added 6 new source tables (total: 8 tables)
- [x] Created `available-tables.ts` for table discovery
- [x] All Lambda handlers created and deployed

### Phase 6: Backfill Utility (Completed)

- [x] Created shared transformers (`src/shared/transformers/index.ts`)
- [x] Created backfill CLI script (`scripts/backfill.ts`)
- [x] Backfilled all 196 existing records to unified table
- [x] Supports: dry-run, single table, limit, all tables

### Phase 7: Monorepo Restructure (Completed)

- [x] Restructured project as npm workspaces monorepo
- [x] Moved backend code to `packages/backend`
- [x] Created `packages/frontend` placeholder
- [x] Updated all configurations for new structure

### Phase 8: Frontend Scaffold (Completed)

- [x] Initialized Next.js 16 with TypeScript + Tailwind CSS
- [x] Set up shadcn/ui components (button, card, input, label)
- [x] Configured AWS Amplify Auth with Cognito
  - User Pool: `us-west-2_wudnFpd2a`
  - App Client: `1c7psmuc5fguvrubvg2fbdu230`
- [x] Created AuthProvider with login/logout flow
- [x] Created QueryProvider for TanStack Query
- [x] Created login page with dark theme
- [x] Created protected feed page with placeholder data
- [x] Auto-redirect based on auth state

---

## 📊 Current State

### Unified Table Statistics

| Record Type | Count |
|-------------|-------|
| NOTE | 10 |
| CONTACT | 3 |
| THOUGHT | 1 |
| PROJECT | 15 |
| WORKBOARD | 72 |
| CAPTURE | 2 |
| LLM_CONVERSATION | 2 |
| MCP_CONVERSATION | 92 |
| **TOTAL** | **197** |

### AWS Resources Deployed

| Resource | Name | Region |
|----------|------|--------|
| CloudFormation Stack | `NewsFeed-Stack` | us-west-2 |
| Unified Table | `NewsFeed_Unified_Table` | us-west-2 |
| Lambda Processors | 8 functions | us-west-2 |
| Stream Enablers | 8 functions | us-west-2 |

### Source Tables Connected (8 Total)

| Source Table | Record Type | Synced Fields | Status |
|--------------|-------------|---------------|--------|
| `nexusnote-notes-production` | NOTE | title, content | ✅ |
| `nexusnote-inno-contacts-production` | CONTACT | contactName, role, workingStyle | ✅ |
| `nexusnote-thoughts-production` | THOUGHT | content, tagName | ✅ |
| `nexusnote-implementation-projects-production` | PROJECT | title, description, status | ✅ |
| `nexusnote-tracking-workboard-production` | WORKBOARD | chainId, slotIndex, archived | ✅ |
| `Capture` | CAPTURE | title, content, source, sourceUrl | ✅ |
| `LlmCouncilStack-...` | LLM_CONVERSATION | id | ✅ |
| `MCP-chat-conversations` | MCP_CONVERSATION | sessionId, userId | ✅ |

### Unified Table Schema

```
PK: {TABLE_NAME}#{original_composite_key}
SK: RECORD
source_type: "personal" | "external"
table_name: original table name
original_id: original record's key
record_type: NOTE | CONTACT | THOUGHT | PROJECT | WORKBOARD | CAPTURE | LLM_CONVERSATION | MCP_CONVERSATION
content: { synced fields as map }
created_at: ISO 8601 timestamp
updated_at: ISO 8601 timestamp
event_type: "INSERT" | "MODIFY" | "REMOVE"
is_deleted: boolean
```

### Tags on All Resources

| Tag | Value |
|-----|-------|
| Project | NewsFeed |
| Environment | Production |

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `src/config/source-tables.ts` | **Source table definitions** - add new tables here |
| `src/config/available-tables.ts` | Reference of all DynamoDB tables in account |
| `src/shared/transformers/index.ts` | Shared transformation logic |
| `scripts/backfill.ts` | CLI tool for backfilling existing data |
| `cdk.json` | CDK configuration |
| `.cursorrules` | Coding conventions and naming standards |

### Adding a New Source Table

1. Add entry to `src/config/source-tables.ts`
2. Add transformer to `src/shared/transformers/index.ts`
3. Create Lambda handler at `src/lambdas/{processorId}-stream-processor/handler.ts`
4. Run `npx cdk deploy --profile codex`
5. Run `npx ts-node scripts/backfill.ts --table {processorId} --profile codex`

CDK will automatically enable streams and wire everything up!

---

## 📁 Project Structure (Monorepo)

```
NewsFeed/
├── packages/
│   ├── backend/                        # AWS CDK + Lambda
│   │   ├── bin/
│   │   │   └── app.ts                  # CDK app entry point
│   │   ├── lib/
│   │   │   ├── newsfeed-stack.ts       # Main CDK stack
│   │   │   └── constructs/             # Reusable CDK constructs
│   │   ├── scripts/
│   │   │   └── backfill.ts             # Backfill CLI tool
│   │   ├── src/
│   │   │   ├── config/                 # Source table configurations
│   │   │   ├── lambdas/                # Lambda function handlers (8 total)
│   │   │   └── shared/                 # Shared utilities and types
│   │   ├── test/
│   │   ├── cdk.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                       # Next.js web application
│       ├── src/
│       │   ├── app/                    # Next.js App Router pages
│       │   ├── components/             # React components + shadcn/ui
│       │   └── lib/                    # Utilities and config
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                        # Root package.json (npm workspaces)
├── tsconfig.json                       # Root tsconfig
├── .cursorrules                        # Coding conventions
├── .gitignore
├── Progress.md                         # This file
├── TODO.md                             # Technical debt tracker
└── ProjectDescription.md               # Original project description
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

# Install all dependencies (npm workspaces)
npm install

# Build all packages
npm run build

# Build backend only
npm run build:backend

# Deploy backend to AWS
npm run deploy
# Or: cd packages/backend && npx cdk deploy --profile codex

# Start frontend dev server
npm run dev -w @newsfeed/frontend
# Access at http://localhost:3000

# Run tests
npm test
```

### Useful Commands

```bash
# From monorepo root
npm run backfill                         # Run backfill
npm run backfill:dry                     # Dry run backfill

# From packages/backend
npx ts-node scripts/backfill.ts --all --profile codex
npx ts-node scripts/backfill.ts --table notes --profile codex
npx cdk deploy --profile codex
npx cdk diff --profile codex

# AWS CLI
aws dynamodb scan --table-name NewsFeed_Unified_Table --profile codex --region us-west-2 --select COUNT
aws logs tail /aws/lambda/NewsFeed_Notes_Processor --profile codex --region us-west-2 --follow
```

---

## 🔜 Next Steps

1. **Build newsfeed API** - API Gateway + Lambda to query unified table
2. **Connect frontend to API** - Replace placeholder data with real API calls
3. **Add infinite scroll** - Pagination with TanStack Query
4. **Add filtering** - Filter by source_type, record_type
5. **Add search indexing** - OpenSearch integration for full-text search
6. **Deploy to Amplify** - Set up CI/CD for frontend

---

## 📝 Notes

- Source tables are KMS encrypted with key: `7e61921e-4255-4ec5-99e5-05efb9850bbb`
- Stream processing uses `TRIM_HORIZON` starting position (processes from beginning)
- Batch size: 10 records, max batching window: 5 seconds
- Retry attempts: 3, with bisect on error enabled
- Streams are automatically enabled via CDK Custom Resource
- Backfill script uses shared transformers for consistency
- See `TODO.md` for technical debt items to address
