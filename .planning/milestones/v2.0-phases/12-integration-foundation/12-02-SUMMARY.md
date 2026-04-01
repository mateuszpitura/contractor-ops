---
phase: 12-integration-foundation
plan: 02
subsystem: integrations
tags: [webhook, qstash, slack, resend, hmac, svix, adapter-pattern]

# Dependency graph
requires:
  - phase: 12-integration-foundation plan 01
    provides: IntegrationProviderAdapter interface, provider registry, credential service, WebhookDelivery model
provides:
  - Unified webhook ingestion route /api/webhooks/[provider]
  - QStash async processing endpoint /api/webhooks/_process
  - Slack adapter with HMAC-SHA256 webhook verification and OAuth config
  - Resend adapter with Svix webhook verification
  - Webhook dispatcher service (verify-log-queue pipeline)
  - QStash client singleton
  - Base adapter abstract class
  - Adapter registration module
affects: [12-03, 12-04, 12-05, slack-integration, resend-integration, webhook-processing]

# Tech tracking
tech-stack:
  added: [resend ^6.9.4 (integrations package)]
  patterns: [adapter pattern for webhook verification, QStash async processing, verify-log-queue pipeline, registerAllAdapters idempotent init]

key-files:
  created:
    - packages/integrations/src/adapters/base-adapter.ts
    - packages/integrations/src/adapters/slack-adapter.ts
    - packages/integrations/src/adapters/resend-adapter.ts
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/src/services/qstash-client.ts
    - packages/integrations/src/services/webhook-dispatcher.ts
    - packages/integrations/src/__tests__/registry.test.ts
    - packages/integrations/src/__tests__/webhook-dispatcher.test.ts
    - apps/web/src/app/api/webhooks/[provider]/route.ts
    - apps/web/src/app/api/webhooks/_process/route.ts
  modified:
    - packages/integrations/src/index.ts
    - packages/integrations/package.json

key-decisions:
  - "Resend dependency updated to ^6.9.4 to match web app version (plan specified ^4.8.0 which lacked webhooks.verify)"
  - "handleWebhook left as logging stubs in both adapters — full wiring deferred to Plan 03 per plan specification"
  - "registerAllAdapters uses idempotent flag to prevent double-registration when called from multiple route files"

patterns-established:
  - "Adapter pattern: BaseAdapter abstract class with slug-based registry lookup for webhook dispatch"
  - "Verify-log-queue pipeline: verify signature -> log WebhookDelivery -> queue via QStash -> process async"
  - "QStash process endpoint: verifySignatureAppRouter wrapper for signature verification on public endpoint"

requirements-completed: [INTG-02]

# Metrics
duration: 6min
completed: 2026-03-23
---

# Phase 12 Plan 02: Webhook Pipeline Summary

**Unified webhook ingestion pipeline with Slack HMAC-SHA256 and Resend Svix adapters, QStash async processing, and WebhookDelivery audit logging**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T13:08:35Z
- **Completed:** 2026-03-23T13:15:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Unified webhook route at /api/webhooks/[provider] dispatches to correct adapter by slug
- Slack adapter verifies webhook signatures using HMAC-SHA256 with timing-safe comparison (identical logic to existing interactivity route)
- Resend adapter verifies webhook signatures using Svix headers via Resend SDK v6
- WebhookDelivery records created for all verified webhooks with full audit trail
- QStash queues webhooks for async processing with 3 retries
- QStash process endpoint verifies its own signature and dispatches to adapter handleWebhook
- 21 tests pass across 3 test files (registry: 6, dispatcher: 6, credential-service: 9)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Slack + Resend adapters, base adapter, QStash client, and webhook dispatcher** - `abef77a` (feat)
2. **Task 2: Create unified webhook route and QStash process endpoint** - `3dce4eb` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/base-adapter.ts` - Abstract base class with default no-op implementations
- `packages/integrations/src/adapters/slack-adapter.ts` - Slack adapter: OAuth config, HMAC-SHA256 verification, token exchange
- `packages/integrations/src/adapters/resend-adapter.ts` - Resend adapter: Svix webhook verification, org slug parsing
- `packages/integrations/src/adapters/register-all.ts` - Idempotent adapter registration for both providers
- `packages/integrations/src/services/qstash-client.ts` - QStash client singleton with env validation
- `packages/integrations/src/services/webhook-dispatcher.ts` - Verify-log-queue pipeline service
- `packages/integrations/src/__tests__/registry.test.ts` - 6 registry tests (CRUD, case-insensitive, overwrite)
- `packages/integrations/src/__tests__/webhook-dispatcher.test.ts` - 6 dispatcher tests (dispatch, error cases, logging, queuing)
- `apps/web/src/app/api/webhooks/[provider]/route.ts` - Unified webhook ingestion route
- `apps/web/src/app/api/webhooks/_process/route.ts` - QStash async processing endpoint
- `packages/integrations/src/index.ts` - Added exports for all new modules
- `packages/integrations/package.json` - Added resend ^6.9.4, new package exports

## Decisions Made
- Updated Resend dependency from ^4.8.0 (plan spec) to ^6.9.4 to match the web app version — v4 lacked the `webhooks.verify` API on the Resend class
- handleWebhook methods are logging stubs in both adapters — full handler wiring (processBlockAction, processViewSubmission, email processing) deferred to Plan 03 per plan specification
- registerAllAdapters uses an idempotent flag to prevent double-registration when called from both webhook routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Resend dependency version mismatch**
- **Found during:** Task 1 (Resend adapter implementation)
- **Issue:** Plan specified `resend: ^4.8.0` but v4 Resend class lacks `webhooks.verify` method. Web app already uses v6.9.4.
- **Fix:** Updated dependency to `^6.9.4` to match web app and get proper TypeScript types
- **Files modified:** packages/integrations/package.json, pnpm-lock.yaml
- **Verification:** TypeScript compiles without `webhooks` property errors
- **Committed in:** 3dce4eb (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Version correction necessary for correct typings. No scope creep.

## Known Stubs

- `packages/integrations/src/adapters/slack-adapter.ts:170` - handleWebhook logs and returns (Plan 03 will wire processBlockAction/processViewSubmission)
- `packages/integrations/src/adapters/resend-adapter.ts:118` - handleWebhook logs and returns (Plan 03 will wire email processing logic)

These stubs are intentional per plan specification. The adapters verify signatures and the pipeline works end-to-end (verify -> log -> queue -> dispatch), but the actual business logic processing is deferred to Plan 03.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Existing env vars (SLACK_SIGNING_SECRET, RESEND_WEBHOOK_SECRET, RESEND_API_KEY, QSTASH_TOKEN) are already configured.

## Next Phase Readiness
- Webhook ingestion pipeline is complete and ready for Plan 03 migration of existing routes
- Adapter pattern validated with two real providers (Slack, Resend)
- QStash async processing pattern established for all future webhook handling
- Plan 03 can wire handleWebhook stubs to actual business logic

---
*Phase: 12-integration-foundation*
*Completed: 2026-03-23*
