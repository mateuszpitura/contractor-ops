---
phase: 35-feature-gating-dpd-ups-billing-polish
plan: 06
subsystem: api
tags: [trpc, courier, dpd, ups, connection-test, carrier-factory]

# Dependency graph
requires:
  - phase: 35-05
    provides: "DPD/UPS carrier clients, carrier-factory, saveCourierConfig procedure"
provides:
  - "testCourierConnection adminProcedure in equipment router"
  - "Credential validation probe via getCourierClient + getStatus"
affects: [carrier-credential-form, settings-integrations]

# Tech tracking
tech-stack:
  added: []
  patterns: ["getStatus probe with dummy shipment ID for credential validation"]

key-files:
  created:
    - "packages/api/src/routers/__tests__/equipment-test-connection.test.ts"
  modified:
    - "packages/api/src/routers/equipment.ts"

key-decisions:
  - "getStatus with TEST_CONNECTION_PROBE as lightweight auth check -- shipment-not-found proves auth succeeded"
  - "Returns structured success/failure instead of throwing TRPCError -- UI shows toast, not error boundary"

patterns-established:
  - "Connection test probe: use getStatus with dummy ID, treat not-found as auth success"

requirements-completed: [EQUIP-06, EQUIP-07, BILL-09, BILL-10]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 35 Plan 06: testCourierConnection Gap Closure Summary

**testCourierConnection tRPC procedure closing CarrierCredentialForm verification gap, with getStatus probe and structured success/failure response**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T11:20:16Z
- **Completed:** 2026-04-05T11:25:24Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Added testCourierConnection adminProcedure to equipment router accepting DPD/UPS credential schemas
- Probes carrier API via getCourierClient + getStatus("TEST_CONNECTION_PROBE") as lightweight auth check
- Returns structured { success: true } or { success: false, error: string } without leaking internal details
- 4 unit tests covering DPD success, UPS success, not-found-as-auth-success, and auth failure cases

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for testCourierConnection** - `f2b478f` (test)
2. **Task 1 GREEN: Implement testCourierConnection procedure** - `9e6ed01` (feat)

## Files Created/Modified
- `packages/api/src/routers/__tests__/equipment-test-connection.test.ts` - 4 unit tests for testCourierConnection (338 lines)
- `packages/api/src/routers/equipment.ts` - Added getCourierClient import and testCourierConnection adminProcedure

## Decisions Made
- Used getStatus with dummy shipment ID as auth probe -- lightweight, no side effects, and not-found response proves auth succeeded
- Returns structured result instead of throwing TRPCError on connection failure -- allows UI to show informative toast without triggering error boundary

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- testCourierConnection procedure is callable from CarrierCredentialForm "Test connection" button
- No further plans in Phase 35 -- phase complete

---
*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Completed: 2026-04-05*
