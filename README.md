# NewsFeed

A personalized newsfeed system that aggregates data from multiple DynamoDB tables into a unified feed with AI-powered summaries and insights.

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Source Tables  │────▶│   Lambdas    │────▶│ Unified Table   │
│  (7 DynamoDB)   │     │  (Streams)   │     │   (NewsFeed)    │
└─────────────────┘     └──────┬───────┘     └────────┬────────┘
                               │                      │
                        ┌──────▼───────┐       ┌──────▼───────┐
                        │   Bedrock    │       │   Frontend   │
                        │ (AI Enrich)  │       │   (Next.js)  │
                        └──────────────┘       └──────────────┘
```

### Source Tables

| Table | Record Type | Description |
|-------|-------------|-------------|
| `nexusnote-notes-production` | NOTE | Personal notes |
| `nexusnote-contacts-production` | CONTACT | Contact information |
| `nexusnote-thoughts-production` | THOUGHT | Quick thoughts |
| `nexusnote-implementation-projects-production` | PROJECT | Projects |
| `Capture` | CAPTURE | Web captures, PDFs, YouTube |
| `LLMCouncilConversations` | LLM_CONVERSATION | AI conversations |
| `Soliloquies` | SOLILOQUY | Voice notes |

### AI Enrichment

Each record is automatically enriched with:
- **AI Summary**: Brief overview of the content
- **AI Insight**: Actionable suggestions or reflections

Powered by **AWS Bedrock (Claude 3 Haiku)**.

---

## Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Install dependencies
npm install

# Build backend
cd packages/backend
npm run build

# Deploy infrastructure
cdk deploy
```

### Run Frontend

```bash
cd packages/frontend
npm run dev
```

---

## DLQ Redrive (Manual)

When AI enrichment fails after 3 retries, records are sent to a Dead Letter Queue (DLQ).

### Check DLQ Message Count

**AWS Console:**
1. Go to [SQS Console](https://us-west-2.console.aws.amazon.com/sqs/v2/home?region=us-west-2)
2. Find `NewsFeed-AiEnrichmentDLQ`
3. Check "Messages available"

**CLI:**
```bash
aws sqs get-queue-attributes \
  --queue-url https://sqs.us-west-2.amazonaws.com/225989370718/NewsFeed-AiEnrichmentDLQ \
  --attribute-names ApproximateNumberOfMessages \
  --region us-west-2
```

### Trigger Redrive

**AWS Console:**
1. Go to [Lambda Console → NewsFeed-DlqRedrive](https://us-west-2.console.aws.amazon.com/lambda/home?region=us-west-2#/functions/NewsFeed-DlqRedrive)
2. Click the **Test** tab
3. Create a test event (name: `ManualRedrive`, body: `{}`)
4. Click **Test**
5. View results:
   ```json
   {
     "processed": 5,
     "succeeded": 4,
     "failed": 0,
     "requeued": 1
   }
   ```

**CLI:**
```bash
aws lambda invoke \
  --function-name NewsFeed-DlqRedrive \
  --region us-west-2 \
  output.json && cat output.json
```

> **Note:** The redrive Lambda processes 10 messages at a time. Run multiple times if needed.

### DLQ Error Types

| Error Type | Description |
|------------|-------------|
| `BEDROCK_API_ERROR` | Bedrock API call failed after 3 retries |
| `INVALID_JSON_RESPONSE` | AI response wasn't valid JSON |
| `ENRICHMENT_FAILED` | Top-level enrichment error |

---

## Backfill Existing Data

To backfill all existing records with AI enrichment:

```bash
cd packages/backend
npx ts-node scripts/backfill.ts --all
```

Or for a specific table:

```bash
npx ts-node scripts/backfill.ts notes
```

---

## Project Structure

```
packages/
├── backend/
│   ├── lib/                    # CDK Stack
│   ├── src/
│   │   ├── config/             # Source table config
│   │   ├── lambdas/            # Lambda handlers
│   │   │   ├── notes-stream-processor/
│   │   │   ├── dlq-redrive/
│   │   │   └── ...
│   │   └── shared/
│   │       ├── services/       # AI, DLQ services
│   │       ├── transformers/   # Data transformers
│   │       ├── types/          # TypeScript types
│   │       └── utils/          # Helpers
│   └── scripts/                # Backfill scripts
└── frontend/                   # Next.js app
```
