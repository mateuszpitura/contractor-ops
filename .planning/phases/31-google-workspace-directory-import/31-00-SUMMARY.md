---
phase: 31-google-workspace-directory-import
plan: 00
subsystem: testing
tags: [vitest, google-workspace, test-stubs, tdd]

# Dependency graph
requires: []
provides:
  - Test stubs for GOOG-01 through GOOG-05 covering OAuth, Directory API, sync, bulk import, and validators
affects: [31-01, 31-02, 31-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 test-first pattern: todo stubs before implementation"

key-files:
  created:
    - packages/integrations/src/__tests__/google-workspace-adapter.test.ts
    - packages/integrations/src/__tests__/google-workspace-directory.test.ts
    - packages/api/src/__tests__/google-workspace-sync.test.ts
    - packages/validators/src/__tests__/google-workspace.test.ts
  modified:
    - packages/validators/package.json
    - packages/validators/vitest.config.ts

key-decisions:
  - "Added vitest.config.ts and test script to validators package to enable test execution"

patterns-established:
  - "Google Workspace test stubs follow existing vitest todo pattern from Linear integration"

requirements-completed: [GOOG-01, GOOG-02, GOOG-03, GOOG-04, GOOG-05]

# Metrics
duration: 3min
completed: 2026-04-02
---

# Phase 31 Plan 00: Wave 0 Test Stubs Summary

**49 vitest todo stubs across 4 test files covering all GOOG requirements (OAuth, Directory API, sync detection, bulk import, Zod validators)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-02T15:16:46Z
- **Completed:** 2026-04-02T15:19:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created 19 todo test stubs for GoogleWorkspaceAdapter OAuth and Directory API (GOOG-01, GOOG-02, GOOG-04)
- Created 17 todo test stubs for sync orchestrator and bulk import (GOOG-03, GOOG-05)
- Created 13 todo test stubs for Zod schema validation (directoryImportInputSchema, groupRoleMappingSchema)
- All 3 packages pass tests with stubs showing as todo/skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for integrations package (GOOG-01, GOOG-02, GOOG-04)** - `57804a8` (test)
2. **Task 2: Create test stubs for API package and validators (GOOG-03, GOOG-05)** - `ba1815b` (test)

## Files Created/Modified
- `packages/integrations/src/__tests__/google-workspace-adapter.test.ts` - 9 todo stubs for OAuth config, token exchange, refresh (GOOG-01)
- `packages/integrations/src/__tests__/google-workspace-directory.test.ts` - 10 todo stubs for user listing, group listing, pagination (GOOG-02, GOOG-04)
- `packages/api/src/__tests__/google-workspace-sync.test.ts` - 17 todo stubs for sync detection and bulk import (GOOG-03, GOOG-05)
- `packages/validators/src/__tests__/google-workspace.test.ts` - 13 todo stubs for Zod schema validation
- `packages/validators/vitest.config.ts` - Vitest config to enable test execution
- `packages/validators/package.json` - Added test script

## Decisions Made
- Added vitest.config.ts and test script to validators package -- required for tests to execute in this package (was missing in worktree branch)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest config and test script to validators package**
- **Found during:** Task 2 (validators test stubs)
- **Issue:** validators package had no vitest.config.ts or test script, so tests could not be run
- **Fix:** Created vitest.config.ts matching integrations/api pattern, added "test": "vitest run" to package.json scripts
- **Files modified:** packages/validators/vitest.config.ts, packages/validators/package.json
- **Verification:** pnpm --filter @contractor-ops/validators test passes with 23 todo stubs
- **Committed in:** ba1815b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for validators test execution. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 test files ready for implementation plans 31-01 through 31-03
- Every GOOG requirement (01-05) has at least one describe block with todo stubs
- Implementation tasks can reference these tests in their verify blocks

---
*Phase: 31-google-workspace-directory-import*
*Completed: 2026-04-02*
