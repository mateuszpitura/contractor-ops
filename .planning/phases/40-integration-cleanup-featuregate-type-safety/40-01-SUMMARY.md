---
phase: 40-integration-cleanup-featuregate-type-safety
plan: 01
subsystem: ui, api
tags: [feature-gate, billing, typescript, courier, tRPC]

# Dependency graph
requires:
  - phase: 35-billing-courier-dpd-ups
    provides: FeatureGate component and courier client interfaces
  - phase: 38-tier-gate-expansion
    provides: FeatureGate wrapping pattern for OAuth provider sections
provides:
  - FeatureGate-wrapped Jira provider section (PRO tier)
  - FeatureGate-wrapped org calendar section (PRO tier)
  - FeatureGate-wrapped personal calendar section (PRO tier)
  - ShipmentParams union type for CourierClient interface
  - Clean API dist build (tsc exits 0)
affects: [40-02-proxy-removal]

# Tech tracking
tech-stack:
  added: []
  patterns: [ShipmentParams union type for polymorphic courier dispatch]

key-files:
  created: []
  modified:
    - apps/web/src/components/integrations/jira-provider-section.tsx
    - apps/web/src/components/settings/org-calendar-section.tsx
    - apps/web/src/components/settings/my-calendar-section.tsx
    - packages/api/src/services/courier/courier-client.ts
    - packages/api/src/services/courier/dpd-client.ts
    - packages/api/src/services/courier/inpost-client.ts
    - packages/api/src/services/courier/ups-client.ts

key-decisions:
  - "ShipmentParams union type (Base | InPost | Address | DPD | UPS) instead of widening BaseShipmentParams -- preserves type narrowing in individual clients"

patterns-established:
  - "ShipmentParams union: CourierClient.createShipment accepts union, individual clients narrow with runtime type guards"

requirements-completed: [BILL-09]

# Metrics
duration: 6min
completed: 2026-04-06
---

# Phase 40 Plan 01: FeatureGate + API Type Safety Summary

**FeatureGate PRO-tier wrappers on Jira/Calendar sections + ShipmentParams union type fix enabling clean API dist build**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-06T09:09:47Z
- **Completed:** 2026-04-06T09:16:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Wrapped Jira provider section, org calendar section, and personal calendar section with FeatureGate requiring PRO tier -- consistent with Linear/GWS/Teams pattern
- Fixed ShipmentParams type system: introduced union type so CourierClient.createShipment accepts InPost (targetPoint), DPD/UPS (deliveryAddress) params without type errors
- API package builds cleanly with tsc, producing fresh dist types with all routers (billing, teams, equipment, portal)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap Jira and Calendar provider sections with FeatureGate** - `0d94b8d` (feat)
2. **Task 2: Rebuild API dist types** - `9a0a377` (fix)

## Files Created/Modified
- `apps/web/src/components/integrations/jira-provider-section.tsx` - Added FeatureGate PRO wrapper
- `apps/web/src/components/settings/org-calendar-section.tsx` - Added FeatureGate PRO wrapper
- `apps/web/src/components/settings/my-calendar-section.tsx` - Added FeatureGate PRO wrapper
- `packages/api/src/services/courier/courier-client.ts` - Added ShipmentParams union type, updated CourierClient interface
- `packages/api/src/services/courier/dpd-client.ts` - Updated createShipment param type to ShipmentParams
- `packages/api/src/services/courier/inpost-client.ts` - Updated createShipment param type to ShipmentParams
- `packages/api/src/services/courier/ups-client.ts` - Updated createShipment param type to ShipmentParams

## Decisions Made
- ShipmentParams union type (Base | InPost | Address | DPD | UPS) instead of widening BaseShipmentParams -- preserves type narrowing in individual clients while allowing polymorphic dispatch through CourierClient interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed ShipmentParams type errors preventing API build**
- **Found during:** Task 2 (Rebuild API dist types)
- **Issue:** `tsc` failed with 5 type errors -- `createShipment` accepted `BaseShipmentParams` but callers passed InPost/DPD/UPS-specific fields (targetPoint, deliveryAddress, street)
- **Fix:** Introduced `ShipmentParams` union type, updated CourierClient interface and all 3 client implementations
- **Files modified:** courier-client.ts, dpd-client.ts, inpost-client.ts, ups-client.ts
- **Verification:** `pnpm --filter @contractor-ops/api build` exits 0
- **Committed in:** 9a0a377

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type fix was necessary for the build to succeed. No scope creep.

## Issues Encountered
None beyond the type error fixed above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None.

## Next Phase Readiness
- All OAuth provider sections now consistently gated with FeatureGate PRO tier
- API dist types build cleanly, unblocking Plan 02 proxy removal

---
*Phase: 40-integration-cleanup-featuregate-type-safety*
*Completed: 2026-04-06*
