---
phase: 21-api-build-fixes-permission-registration
plan: 01
subsystem: api
tags: [typescript, permissions, integrations, validators, auth, subpath-exports]

requires:
  - phase: 20-documentation-calendar
    provides: adapter source files for notion, confluence, google-calendar, outlook-calendar
provides:
  - 4 new adapter subpath exports in integrations package.json
  - time resource registered in permission statement with read and approve actions
  - time permissions assigned to admin, finance_admin, ops_manager, team_manager roles
  - validators dist with calendar and docs modules
  - restored helpers.ts utility (optionalString, optionalFk, optionalPositiveInt)
affects: [21-02, api-compilation, time-tracking]

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - packages/validators/src/helpers.ts
  modified:
    - packages/integrations/package.json
    - packages/auth/src/permissions.ts
    - packages/auth/src/roles.ts

key-decisions:
  - "Restored missing helpers.ts in validators package that was untracked in worktree (Rule 3 - blocking)"
  - "Built db package with Prisma generate (dummy DATABASE_URL) to unblock integrations build"

patterns-established: []

requirements-completed: [DOCS-01, DOCS-02, CAL-01, CAL-02, TIME-02]

duration: 3min
completed: 2026-03-30
---

# Phase 21 Plan 01: API Build Fixes & Permission Registration Summary

**Added 4 adapter subpath exports to integrations, registered time permission resource, and restored validators helpers for clean package compilation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T09:14:53Z
- **Completed:** 2026-03-30T09:18:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added notion-adapter, confluence-adapter, google-calendar-adapter, outlook-calendar-adapter subpath exports to integrations package.json
- Registered time resource with read and approve actions in permissions.ts and assigned to 4 roles in roles.ts
- Restored missing helpers.ts in validators package, enabling validators and all downstream packages to build
- All three foundation packages (validators, integrations, auth) compile cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 4 adapter subpath exports and rebuild validators + integrations** - `48bac66` (feat)
2. **Task 2: Register time resource in permissions.ts and assign to roles** - `7170745` (feat)

## Files Created/Modified
- `packages/validators/src/helpers.ts` - Restored utility schemas (optionalString, optionalFk, optionalPositiveInt)
- `packages/integrations/package.json` - Added 4 new adapter subpath exports for notion, confluence, google-calendar, outlook-calendar
- `packages/auth/src/permissions.ts` - Added time: ["read", "approve"] to permission statement
- `packages/auth/src/roles.ts` - Added time permissions to allPermissions, admin, finance_admin, ops_manager, team_manager

## Decisions Made
- Restored missing helpers.ts that was present in main worktree but absent in agent worktree (deviation Rule 3)
- Built db package with Prisma generate using dummy DATABASE_URL to unblock integrations compilation chain

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored missing helpers.ts in validators package**
- **Found during:** Task 1 (validators build)
- **Issue:** packages/validators/src/helpers.ts was missing in agent worktree (untracked file not carried over), causing validators build to fail with "Cannot find module './helpers.js'"
- **Fix:** Copied helpers.ts content from main worktree, creating the file with optionalString, optionalFk, optionalPositiveInt exports
- **Files modified:** packages/validators/src/helpers.ts
- **Verification:** pnpm --filter @contractor-ops/validators build exits 0
- **Committed in:** 48bac66 (Task 1 commit)

**2. [Rule 3 - Blocking] Generated Prisma client and built db package for integrations dependency**
- **Found during:** Task 1 (integrations build)
- **Issue:** integrations package depends on @contractor-ops/db which requires Prisma client generation; without it, tsc fails with "Cannot find module '@contractor-ops/db'"
- **Fix:** Ran prisma generate with dummy DATABASE_URL, then built db package before integrations
- **Files modified:** None (generated artifacts only)
- **Verification:** pnpm --filter @contractor-ops/integrations build exits 0
- **Committed in:** No additional files committed (generated/dist artifacts)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary to unblock the build chain. No scope creep.

## Issues Encountered
None beyond the auto-fixed blocking issues above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - this plan only adds configuration and permission registrations.

## Next Phase Readiness
- All three foundation packages compile cleanly
- Plan 02 can now proceed to fix individual file-level API compilation errors
- The 44+ downstream compilation errors should now be reduced to individual file bugs

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 21-api-build-fixes-permission-registration*
*Completed: 2026-03-30*
