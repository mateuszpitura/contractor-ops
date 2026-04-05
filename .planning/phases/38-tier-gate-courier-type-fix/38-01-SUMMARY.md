---
phase: 38-tier-gate-courier-type-fix
plan: 01
subsystem: api
tags: [trpc, middleware, tier-gating, billing, subscription]

# Dependency graph
requires:
  - phase: 35-feature-gating-dpd-ups-billing
    provides: requireTier middleware factory in packages/api/src/middleware/tier.ts
provides:
  - Tier-gated Teams saveChannelMapping mutation
  - Tier-gated GWS listUserGroups, bulkImport, triggerSync mutations
  - Tier-gated all 6 onboarding import procedures
affects: [billing, upgrade-prompts, feature-gating]

# Tech tracking
tech-stack:
  added: []
  patterns: [requireTier("PRO") middleware chaining after requirePermission]

key-files:
  created: []
  modified:
    - packages/api/src/routers/teams.ts
    - packages/api/src/routers/google-workspace.ts
    - packages/api/src/routers/onboarding-import.ts
    - packages/api/src/routers/__tests__/teams.test.ts
    - packages/api/src/routers/__tests__/google-workspace.test.ts
    - packages/api/src/routers/__tests__/onboarding-import.test.ts

key-decisions:
  - "Gate mutations only -- read queries remain ungated for STARTER upgrade prompts (consistent with Phase 36 D-06)"
  - "Teams test uses structural source verification since mocked tRPC init bypasses middleware"
  - "GWS and onboarding-import tests use real callerFactory with billing-service mock for STARTER rejection"

patterns-established:
  - "Tier gate testing: use mockGetSubscription in vi.hoisted() with billing-service mock for callerFactory-based tests"

requirements-completed: [BILL-09]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 38 Plan 01: Tier Gate Expansion Summary

**requireTier("PRO") added to 10 ungated procedures across Teams, GWS, and Onboarding Import routers with STARTER-rejection tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T20:58:29Z
- **Completed:** 2026-04-05T21:04:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Gated 10 procedures across 3 routers with requireTier("PRO") in correct middleware chain order
- STARTER-tier orgs now blocked from Teams channel mapping, GWS directory operations, and all onboarding import procedures
- 9 new tier-rejection tests (2 structural for Teams, 3 behavioral for GWS, 4 behavioral for onboarding import)
- Zero regressions in existing test suites (37 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add requireTier("PRO") to Teams, GWS, and Onboarding Import routers** - `dc059b3` (feat)
2. **Task 2: Add tier-rejection tests to Teams, GWS, and Onboarding Import test files** - `5995adc` (test)

## Files Created/Modified
- `packages/api/src/routers/teams.ts` - Added requireTier("PRO") to saveChannelMapping
- `packages/api/src/routers/google-workspace.ts` - Added requireTier("PRO") to listUserGroups, bulkImport, triggerSync
- `packages/api/src/routers/onboarding-import.ts` - Added requireTier("PRO") to all 6 procedures
- `packages/api/src/routers/__tests__/teams.test.ts` - Structural tier gate verification tests
- `packages/api/src/routers/__tests__/google-workspace.test.ts` - Behavioral STARTER rejection tests + billing-service mock
- `packages/api/src/routers/__tests__/onboarding-import.test.ts` - Behavioral STARTER rejection tests + billing-service mock

## Decisions Made
- Gate mutations only -- read queries (connectionStatus, getTeams, getChannels, getChannelMapping, listDirectory, syncStatus) remain ungated consistent with Phase 36 D-06 pattern
- Teams test uses structural source file verification because mocked tRPC init bypasses middleware entirely
- GWS and onboarding-import tests use real callerFactory with mockGetSubscription in vi.hoisted() for behavioral tier rejection verification

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All MISSING-01 tier gate gaps from v3.0 audit closed
- Ready for Plan 02 (CourierClient type fix) and Plan 03 (remaining audit items)

---
*Phase: 38-tier-gate-courier-type-fix*
*Completed: 2026-04-05*
