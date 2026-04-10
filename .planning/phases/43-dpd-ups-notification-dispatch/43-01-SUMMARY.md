---
phase: 43-dpd-ups-notification-dispatch
plan: 01
subsystem: api
tags: [notifications, courier, polling, dpd, ups, inpost]

requires:
  - phase: 33-inpost-courier-integration
    provides: InPost webhook notification dispatch pattern, NOTIFICATION_STATUSES constant
  - phase: 35-feature-gating-dpd-ups-billing-polish
    provides: DPD and UPS polling services
provides:
  - Shared dispatchShipmentNotification helper for all courier notification dispatch
  - SHIPMENT_STATUS_CHANGE notifications from DPD polling service
  - SHIPMENT_STATUS_CHANGE notifications from UPS polling service
  - SHIPMENT_STATUS_CHANGE notifications from InPost polling service
affects: []

tech-stack:
  added: []
  patterns: [shared courier notification helper]

key-files:
  created:
    - packages/api/src/services/courier/shipment-notification.ts
  modified:
    - packages/api/src/services/courier/dpd-polling-service.ts
    - packages/api/src/services/courier/ups-polling-service.ts
    - packages/api/src/services/courier/inpost-polling-service.ts
    - packages/api/src/services/courier/inpost-webhook-handler.ts
    - packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts
    - packages/api/src/services/courier/__tests__/ups-polling-service.test.ts
    - packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts

key-decisions:
  - "Extracted shared dispatchShipmentNotification helper into new shipment-notification.ts (per D-02)"
  - "Refactored InPost webhook handler to use shared helper instead of inline dispatch (per D-02)"
  - "Used NOTIFICATION_STATUSES from inpost-status-mapper.ts across all carriers (carrier-agnostic)"

patterns-established:
  - "Shared notification helper: all courier notification dispatch goes through dispatchShipmentNotification"
  - "Fire-and-forget pattern: void dispatchShipmentNotification(...) with try/catch in helper"

requirements-completed: [EQUIP-06, EQUIP-07]

duration: 8min
completed: 2026-04-11
---

# Phase 43: DPD/UPS Notification Dispatch Wiring Summary

**Shared dispatchShipmentNotification helper wired into DPD, UPS, and InPost polling services for terminal status notifications**

## Performance

- **Duration:** 8 min
- **Tasks:** 3
- **Files modified:** 8 (1 created, 4 modified, 3 test files updated)

## Accomplishments
- Extracted shared `dispatchShipmentNotification` helper encapsulating admin query, formatting, and dispatch
- Wired SHIPMENT_STATUS_CHANGE notifications into all 3 polling services (DPD, UPS, InPost) on terminal statuses
- Refactored InPost webhook handler to use the shared helper (35 lines of inline code replaced with 6 lines)
- Added notification dispatch tests to all 3 polling service test files (25 tests pass, 106 total courier tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared dispatchShipmentNotification helper** - `222c9e4` (feat)
2. **Task 2: Wire notification dispatch into polling services + refactor webhook handler** - `5c07dbd` (feat)
3. **Task 3: Add notification dispatch tests** - `4516f81` (test)

## Files Created/Modified
- `packages/api/src/services/courier/shipment-notification.ts` - Shared helper for SHIPMENT_STATUS_CHANGE dispatch
- `packages/api/src/services/courier/dpd-polling-service.ts` - Added notification dispatch on terminal statuses
- `packages/api/src/services/courier/ups-polling-service.ts` - Added notification dispatch on terminal statuses
- `packages/api/src/services/courier/inpost-polling-service.ts` - Added notification dispatch on terminal statuses
- `packages/api/src/services/courier/inpost-webhook-handler.ts` - Refactored to use shared helper
- `packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` - Added notification dispatch tests
- `packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` - Added notification dispatch tests
- `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` - Added notification dispatch tests

## Decisions Made
- Used new file `shipment-notification.ts` in the courier directory for the shared helper (per D-02 discretion)
- Refactored InPost webhook handler to also use the shared helper for consistency (per D-02 discretion)
- Terminal status check stays at call sites, not in the helper (per D-03)

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DPD/UPS notification dispatch gap is closed
- All courier test suites pass (106 tests across 11 files)
- Phase 44 (Test Stub Completion) can proceed

---
*Phase: 43-dpd-ups-notification-dispatch*
*Completed: 2026-04-11*
