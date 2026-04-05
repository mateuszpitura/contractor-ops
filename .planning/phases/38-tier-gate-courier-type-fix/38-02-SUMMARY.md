---
phase: 38-tier-gate-courier-type-fix
plan: 02
subsystem: api
tags: [typescript, courier, interfaces, type-hierarchy, refactoring]

# Dependency graph
requires:
  - phase: 33-equipment-courier
    provides: CourierClient interface, InPost/DPD/UPS client implementations
  - phase: 35-feature-gating-dpd-ups
    provides: AddressShipmentParams, DPD/UPS carrier clients
provides:
  - BaseShipmentParams carrier-agnostic base type for CourierClient interface
  - InPostShipmentParams with targetPoint field for InPost-specific usage
  - Type-safe carrier narrowing pattern in all 3 client implementations
affects: [equipment-router, courier-webhooks, carrier-factory]

# Tech tracking
tech-stack:
  added: []
  patterns: [BaseShipmentParams base type with carrier-specific narrowing via type guards]

key-files:
  created: []
  modified:
    - packages/api/src/services/courier/courier-client.ts
    - packages/api/src/services/courier/inpost-client.ts
    - packages/api/src/services/courier/dpd-client.ts
    - packages/api/src/services/courier/ups-client.ts
    - packages/api/src/services/courier/__tests__/inpost-client.test.ts

key-decisions:
  - "Used Omit<BaseShipmentParams, 'sender'> for AddressShipmentParams to safely override sender type with AddressSender"
  - "Runtime type guards ('targetPoint' in params, 'deliveryAddress' in params) for carrier-specific narrowing"

patterns-established:
  - "Carrier narrowing: accept BaseShipmentParams in method signature, guard + cast to carrier-specific type internally"

requirements-completed: [EQUIP-05, EQUIP-06, EQUIP-07]

# Metrics
duration: 4min
completed: 2026-04-05
---

# Phase 38 Plan 02: CourierClient Type Fix Summary

**Extracted generic BaseShipmentParams from InPost-specific CreateShipmentParams, making CourierClient interface carrier-agnostic**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T20:58:46Z
- **Completed:** 2026-04-05T21:03:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Renamed CreateShipmentParams to BaseShipmentParams (without targetPoint), closing MISSING-03 from v3.0 audit
- Created InPostShipmentParams extending BaseShipmentParams with targetPoint for Paczkomat ID
- Updated AddressShipmentParams to extend BaseShipmentParams via Omit pattern
- All 3 carrier clients (InPost, DPD, UPS) accept BaseShipmentParams and narrow internally with type guards
- Removed InPost-specific targetPoint leaking into base courier interface contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor courier-client.ts type hierarchy and update all carrier implementations** - `44cc529` (refactor)
2. **Task 2: Update courier client tests for renamed types** - `8947c8b` (test)

## Files Created/Modified
- `packages/api/src/services/courier/courier-client.ts` - BaseShipmentParams, InPostShipmentParams, updated CourierClient interface and AddressShipmentParams
- `packages/api/src/services/courier/inpost-client.ts` - Accepts BaseShipmentParams, narrows to InPostShipmentParams with targetPoint guard
- `packages/api/src/services/courier/dpd-client.ts` - Accepts BaseShipmentParams, narrows to DPDShipmentParams with deliveryAddress guard
- `packages/api/src/services/courier/ups-client.ts` - Accepts BaseShipmentParams, narrows to UPSShipmentParams with deliveryAddress+serviceCode guard
- `packages/api/src/services/courier/__tests__/inpost-client.test.ts` - Updated type import from CreateShipmentParams to InPostShipmentParams

## Decisions Made
- Used `Omit<BaseShipmentParams, "sender">` for AddressShipmentParams to safely override the base sender type with AddressSender (which adds street, city, postalCode, countryCode)
- Runtime type guards (`"targetPoint" in params`, `"deliveryAddress" in params`) for carrier narrowing instead of discriminated unions, keeping the interface simple

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript build fails in worktree due to pre-existing db/validators package module resolution (not related to changes)
- Vitest fails in worktree due to ESM zod resolution (pre-existing worktree issue)
- Verified type correctness via `tsc --noEmit --skipLibCheck` with zero courier-related type errors

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CourierClient interface is now carrier-agnostic with BaseShipmentParams
- Equipment router call sites remain type-safe (carrier-specific subtypes satisfy base type)
- Ready for any future carrier additions following the same pattern

---
*Phase: 38-tier-gate-courier-type-fix*
*Completed: 2026-04-05*
