---
phase: 19-jira-integration
plan: 01
subsystem: api
tags: [jira, oauth, webhooks, zod, hmac, bidirectional-sync]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: BaseAdapter, credential encryption, webhook pipeline, sync log infrastructure
  - phase: 18-time-tracking
    provides: JiraAdapter with OAuth 2.0 3LO, worklog sync patterns
provides:
  - Extended JiraAdapter with write scopes, webhook verification, and scope expansion detection
  - Jira issue creation service with ADF descriptions
  - Outbound transition service with per-project status mapping
  - Inbound webhook handler with loop prevention and deduplication
  - Per-project bidirectional status mapping CRUD
  - Comprehensive Zod validators for all Jira data shapes
affects: [19-02-tRPC-router, 19-03-ui-components, 19-04-ui-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [bidirectional-sync-with-loop-prevention, per-project-status-mapping, adf-document-format]

key-files:
  created:
    - packages/validators/src/jira.ts
    - packages/api/src/services/jira-issue-sync.ts
    - packages/api/src/services/jira-webhook-handler.ts
    - packages/api/src/services/jira-status-mapping.ts
  modified:
    - packages/integrations/src/adapters/jira-adapter.ts
    - packages/validators/src/index.ts

key-decisions:
  - "Loop prevention uses lastSyncOrigin marker on ExternalLink.metadataJson with 30s window"
  - "Webhook verification allows passthrough when no secret configured (3LO dynamic webhooks may not support custom secrets)"
  - "Single webhook registration with combined JQL filter to respect 5-per-app limit"

patterns-established:
  - "Bidirectional sync: mark origin before outbound call, check origin on inbound webhook"
  - "Per-project status mapping stored in IntegrationConnection.configJson.statusMappings"
  - "Deduplication via IntegrationSyncLog query within 5s window"

requirements-completed: [JIRA-01, JIRA-02, JIRA-03, JIRA-04]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 19 Plan 01: Jira Backend Services Summary

**Extended JiraAdapter with write/webhook scopes, built issue sync with ADF descriptions, inbound webhook handler with loop prevention and deduplication, and per-project bidirectional status mapping**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T06:37:28Z
- **Completed:** 2026-03-28T06:42:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- JiraAdapter expanded from read-only worklog import to full issue lifecycle with write:jira-work, manage:jira-webhook scopes and HMAC-SHA256 webhook verification
- Complete outbound sync: issue creation (ADF format) and transition execution via per-project status mapping lookup
- Complete inbound sync: webhook processing with 30s loop prevention window and 5s deduplication for rapid-fire events
- Comprehensive Zod validators covering webhook payloads, task config, status mapping, issue metadata, and API response types

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend JiraAdapter and create Zod validators** - `6fb3ef0` (feat)
2. **Task 2: Create Jira issue sync, webhook handler, and status mapping services** - `c4a6269` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/jira-adapter.ts` - Extended with webhook verification, write scopes, getRequiredScopes helper
- `packages/validators/src/jira.ts` - Zod schemas for all Jira data shapes (webhook payload, task config, status mapping, issue metadata, API responses)
- `packages/validators/src/index.ts` - Added Jira validator exports
- `packages/api/src/services/jira-issue-sync.ts` - createJiraIssue (ADF), transitionJiraIssue (mapping lookup), detectScopeExpansionNeeded
- `packages/api/src/services/jira-webhook-handler.ts` - processJiraWebhook (loop prevention + dedup), registerJiraWebhooks, deregisterJiraWebhooks, refreshJiraWebhooks
- `packages/api/src/services/jira-status-mapping.ts` - saveStatusMapping, getStatusMapping, lookupJiraTransitionId, lookupWorkflowStatus

## Decisions Made
- Webhook verification allows passthrough when no secret configured, since 3LO dynamic webhook secret support is ambiguous in Atlassian docs (RESEARCH.md open question #2). Pipeline falls back to ExternalLink matching.
- Loop prevention uses 30s time window on lastSyncOrigin marker rather than transaction IDs, matching the last-write-wins approach from D-08.
- Single webhook registration with combined JQL `project IN (...)` filter to stay within Atlassian's 5-per-app-per-user limit (Pitfall 5).
- Loosely typed PrismaClient for parallel execution compatibility, following Phase 18 precedent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing comma in health status return object**
- **Found during:** Task 1 (JiraAdapter extension)
- **Issue:** Removing the old comment from `recentWebhooks: []` left a missing comma before `errorCountLast24h`
- **Fix:** Added the trailing comma
- **Files modified:** packages/integrations/src/adapters/jira-adapter.ts
- **Verification:** TypeScript build passes
- **Committed in:** 6fb3ef0

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial syntax fix. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in `packages/api/src/services/time-entry.ts` (from parallel agent work) prevent full API package build, but all new Jira service files compile without errors when checked independently.

## User Setup Required
None - no external service configuration required. Jira OAuth credentials (JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, JIRA_ENCRYPTION_KEY) are already configured from Phase 18.

## Next Phase Readiness
- All backend services ready for Plan 02 (tRPC router) to expose as API endpoints
- Status mapping service provides the CRUD that the mapping configuration UI (Plans 03-04) will need
- Webhook handler is ready to be wired into the existing /api/webhooks/jira endpoint

---
*Phase: 19-jira-integration*
*Completed: 2026-03-28*
