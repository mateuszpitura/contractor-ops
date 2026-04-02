---
phase: 31-google-workspace-directory-import
plan: 03
subsystem: api
tags: [google-workspace, qstash, directory-sync, notifications, zod]

# Dependency graph
requires:
  - phase: 31-google-workspace-directory-import (plan 01)
    provides: Google Workspace adapter with listAllDirectoryUsers, tRPC router with triggerSync and ensureSyncCronSchedule
provides:
  - processDirectorySync orchestrator for periodic and manual directory sync
  - QStash-verified POST endpoint at /api/google-workspace/_sync
  - New hire and departure detection with admin notifications
affects: [31-04-google-workspace-directory-import]

# Tech tracking
tech-stack:
  added: []
  patterns: [directory-diff-with-snapshot pattern for detecting changes without auto-mutation]

key-files:
  created:
    - packages/api/src/services/google-workspace-sync-orchestrator.ts
    - apps/web/src/app/api/google-workspace/_sync/route.ts
  modified:
    - packages/api/package.json

key-decisions:
  - "Case-insensitive email comparison for directory diff (lowercase normalization)"
  - "5-minute buffer on token expiry check to prevent edge-case auth failures"

patterns-established:
  - "Directory snapshot diffing: store syncedEmails in configJson, compare against current directory to detect additions/removals"
  - "Zod-validated QStash endpoint: use safeParse instead of unsafe type assertions for webhook callback bodies"

requirements-completed: [GOOG-05]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 31 Plan 03: Periodic Directory Sync Summary

**Directory sync orchestrator with QStash endpoint that detects Google Workspace new hires and departures via email snapshot diffing, dispatching admin notifications without auto-modifying users**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T15:34:55Z
- **Completed:** 2026-04-02T15:39:55Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- processDirectorySync orchestrator compares Google directory against org members and previous snapshot to detect new hires and departures
- QStash-verified endpoint at /api/google-workspace/_sync with Zod body validation (no unsafe casts)
- Admin notifications dispatched for DIRECTORY_NEW_HIRE and DIRECTORY_DEPARTURE without auto-creating or deleting users
- Token refresh, sync logging, error recovery, and configJson snapshot persistence

## Task Commits

Each task was committed atomically:

1. **Task 1: Directory sync orchestrator service** - `2eb5345` (feat)
2. **Task 2: QStash sync endpoint with Zod-validated request body** - `129a940` (feat)

## Files Created/Modified
- `packages/api/src/services/google-workspace-sync-orchestrator.ts` - Sync orchestrator: loads connection, refreshes token, fetches directory, detects new hires/departures, dispatches notifications, updates sync log
- `apps/web/src/app/api/google-workspace/_sync/route.ts` - QStash callback endpoint with Zod validation and signature verification
- `packages/api/package.json` - Added export for google-workspace-sync-orchestrator

## Decisions Made
- Case-insensitive email comparison (lowercase normalization) to avoid false positives from mixed-case Google directory entries
- 5-minute buffer on token expiry check to prevent edge-case authentication failures during sync
- Zod safeParse for QStash callback body validation per CLAUDE.md directive (no unsafe `as` casts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added package.json export for orchestrator**
- **Found during:** Task 1
- **Issue:** Route in apps/web imports from `@contractor-ops/api/services/google-workspace-sync-orchestrator` but no export entry existed in package.json
- **Fix:** Added export entry following existing pattern (slack-client, billing-webhook, etc.)
- **Files modified:** packages/api/package.json
- **Verification:** TypeScript compilation passes
- **Committed in:** 2eb5345 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for cross-package import resolution. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Google Workspace OAuth credentials and QStash signing keys are already configured from Plan 01.

## Next Phase Readiness
- Sync orchestrator ready for UI integration in Plan 04 (settings page sync controls)
- Manual sync trigger via tRPC googleWorkspace.triggerSync already wired (Plan 01)
- Daily cron schedule creation already handled in Plan 01 router

---
*Phase: 31-google-workspace-directory-import*
*Completed: 2026-04-02*
