---
phase: 18-time-tracking
plan: 02
subsystem: integrations
tags: [clockify, jira, oauth, api-key, time-tracking, sync, polling]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: "Adapter pattern, credential encryption, registry, OAuth flow"
  - phase: 18-time-tracking/01
    provides: "TimeEntry/Timesheet Prisma models, time-entry service"
provides:
  - "Clockify adapter with regional URL support and API key auth"
  - "Jira adapter with OAuth 2.0 3LO and cloud ID discovery"
  - "Clockify sync service with pagination and deduplication"
  - "Jira worklog sync service with two-step JQL+worklog fetch"
  - "CLOCKIFY added to IntegrationProvider enum"
affects: [18-time-tracking/03, 18-time-tracking/04, 18-time-tracking/05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["on-demand polling sync (no webhooks/cron)", "two-step Jira API fetch (JQL search + per-issue worklog)", "regional base URL configuration for Clockify"]

key-files:
  created:
    - packages/integrations/src/adapters/clockify-adapter.ts
    - packages/integrations/src/adapters/jira-adapter.ts
    - packages/api/src/services/clockify-sync.ts
    - packages/api/src/services/jira-worklog-sync.ts
  modified:
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/package.json
    - packages/db/prisma/schema/integration.prisma

key-decisions:
  - "Loosely typed PrismaClient in sync services since TimeEntry/Timesheet models created by parallel plan 18-01"
  - "Added package.json exports for clockify-adapter and jira-adapter to enable cross-package imports"

patterns-established:
  - "On-demand sync pattern: fetch, upsert with externalId dedup, recalculate totals, log via IntegrationSyncLog"
  - "Two-step Jira worklog fetch: JQL search for issues, then per-issue worklog endpoint with author filtering"

requirements-completed: [TIME-03, TIME-04]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 18 Plan 02: External Integrations Summary

**Clockify and Jira adapters with on-demand sync services for external time entry import via API key and OAuth 2.0 3LO**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-27T23:19:03Z
- **Completed:** 2026-03-27T23:23:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Clockify adapter registered with 5 regional base URLs (global, EU, US, UK, AU) and API key auth via X-Api-Key header
- Jira adapter registered with OAuth 2.0 3LO (auth.atlassian.com), token exchange, refresh, and cloud ID discovery via accessible-resources endpoint
- Clockify sync service fetches time entries with pagination (page-size=100), ISO 8601 duration parsing, and upsert deduplication
- Jira worklog sync service does two-step fetch (JQL search + per-issue worklog) with author accountId filtering and worklog-to-TimeEntry mapping
- Both sync services log operations via IntegrationSyncLog, handle 401/429 API errors, and recalculate timesheet totalMinutes

## Task Commits

Each task was committed atomically:

1. **Task 1: Clockify and Jira integration adapters** - `a8258d4` (feat)
2. **Task 2: Clockify sync and Jira worklog sync services** - `af81f24` (feat)

## Files Created/Modified
- `packages/integrations/src/adapters/clockify-adapter.ts` - Clockify adapter with regional URLs, API key auth, health status
- `packages/integrations/src/adapters/jira-adapter.ts` - Jira adapter with OAuth 2.0 3LO, token exchange/refresh, cloud ID discovery
- `packages/integrations/src/adapters/register-all.ts` - Added Clockify and Jira adapter registration
- `packages/integrations/package.json` - Added package exports for new adapter modules
- `packages/db/prisma/schema/integration.prisma` - Added CLOCKIFY to IntegrationProvider enum
- `packages/api/src/services/clockify-sync.ts` - Clockify sync with pagination, duration parsing, dedup
- `packages/api/src/services/jira-worklog-sync.ts` - Jira worklog sync with two-step fetch, author filtering, ADF comment extraction

## Decisions Made
- Used loosely typed PrismaClient (`any`) in sync services since TimeEntry/Timesheet models are created by parallel plan 18-01 and not yet in the Prisma client types
- Added explicit package.json exports for clockify-adapter and jira-adapter modules to support cross-package imports from API package
- Jira accountId resolution falls back to ExternalLink lookup (entityType=CONTRACTOR, externalType=JIRA_USER) when not in connection config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added package.json exports for adapter modules**
- **Found during:** Task 2 (sync service imports)
- **Issue:** Clockify sync service imports CLOCKIFY_REGIONS from clockify-adapter, but the integrations package didn't export that subpath
- **Fix:** Added `./adapters/clockify-adapter` and `./adapters/jira-adapter` exports to package.json
- **Files modified:** packages/integrations/package.json
- **Verification:** API package build succeeds
- **Committed in:** af81f24 (Task 2 commit)

**2. [Rule 3 - Blocking] Used loosely typed PrismaClient for parallel execution**
- **Found during:** Task 2 (API build)
- **Issue:** TimeEntry/Timesheet models not yet generated (created by parallel plan 18-01), causing TypeScript errors
- **Fix:** Used `type PrismaClient = any` pattern (same as Phase 16 precedent)
- **Files modified:** packages/api/src/services/clockify-sync.ts, packages/api/src/services/jira-worklog-sync.ts
- **Verification:** API package build succeeds
- **Committed in:** af81f24 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for parallel execution. No scope creep. Types will resolve when plan 18-01 merges with schema generation.

## Issues Encountered
None beyond the parallel execution type resolution handled as deviations above.

## User Setup Required
None - no external service configuration required. Clockify API keys and Jira OAuth credentials are configured per-organization at runtime through the integration settings UI.

## Next Phase Readiness
- Clockify and Jira adapters ready for portal sync UI (plan 18-03/04)
- Sync services ready to be called from tRPC router endpoints
- Cloud ID discovery method available for Jira OAuth callback handler

---
*Phase: 18-time-tracking*
*Completed: 2026-03-28*
