# NewsFeed Project - TODO

## Technical Debt

### 🔴 High Priority

- [ ] **Move DynamoDB Stream configuration to NexusNote project**
  - Currently: Streams were enabled manually via CLI on source tables
  - Should be: NexusNote CDK should own stream configuration and export ARNs
  - Why: Prevents drift if NexusNote is redeployed, maintains proper ownership
  - Action items:
    1. Update NexusNote CDK to add `stream: StreamViewType.NEW_AND_OLD_IMAGES` to table definitions
    2. Export stream ARNs as CloudFormation outputs or SSM parameters
    3. Update NewsFeed CDK to import ARNs via `Fn.importValue()` or SSM lookup
    4. Remove hardcoded stream ARNs from `cdk.json`

- [ ] **Move KMS key ARN to configuration instead of hardcoding**
  - Currently: KMS key ARN is hardcoded in `newsfeed-stack.ts`
  - Should be: KMS key ARN should be passed via context, SSM parameter, or exported from NexusNote
  - Why: Hardcoded ARNs are fragile and won't work across accounts/environments
  - KMS Key: `arn:aws:kms:us-west-2:654654148983:key/7e61921e-4255-4ec5-99e5-05efb9850bbb`
  - Action items:
    1. Export KMS key ARN from NexusNote CDK (or store in SSM Parameter Store)
    2. Update NewsFeed CDK to import the KMS key ARN dynamically
    3. Remove hardcoded KMS key ARN from `newsfeed-stack.ts`

### 🟡 Medium Priority

- [ ] **Add Dead Letter Queue (DLQ) for Lambda failures**
  - Stream processors should have DLQs to capture failed events
  
- [ ] **Add CloudWatch alarms for stream processing errors**
  - Monitor for Lambda errors, throttling, iterator age

- [ ] **Implement backfill script for existing data**
  - Current setup only captures new changes
  - Need one-time sync of existing records to unified table

### 🟢 Low Priority

- [ ] **Add integration tests**
  - Test stream processing end-to-end with localstack or real AWS

---

## Stream ARNs (for reference)

These were enabled via CLI on 2025-11-30:

| Table | Stream ARN |
|-------|------------|
| `nexusnote-notes-production` | `arn:aws:dynamodb:us-west-2:654654148983:table/nexusnote-notes-production/stream/2025-11-30T03:37:42.793` |
| `nexusnote-inno-contacts-production` | `arn:aws:dynamodb:us-west-2:654654148983:table/nexusnote-inno-contacts-production/stream/2025-11-30T03:37:44.275` |

