---
phase: 40-integration-cleanup-featuregate-type-safety
plan: 02
subsystem: api
tags: [trpc, typescript, type-safety, proxy-removal]

# Dependency graph
requires:
  - phase: 40-integration-cleanup-featuregate-type-safety
    provides: Rebuilt API dist types with all router procedures typed
provides:
  - Zero (trpc as any) proxy workarounds in codebase
  - Full type safety for all 13 tRPC call sites
  - Fixed defaultReturnCarrier settings persistence (was broken behind proxy)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct trpc.router.procedure calls replace all proxy workarounds"
    - "as unknown as intermediate casts for tRPC data where local interfaces differ from API types"
    - "Remove explicit useMutation generics to let tRPC types flow through"

key-files:
  created: []
  modified:
    - apps/web/src/components/billing/usage-dashboard.tsx
    - apps/web/src/components/integrations/teams-channel-mapping-card.tsx
    - apps/web/src/components/equipment/carrier-shipment-form.tsx
    - apps/web/src/components/equipment/inpost-shipment-form.tsx
    - apps/web/src/components/equipment/shipment-label-view.tsx
    - apps/web/src/components/equipment/return-approval-banner.tsx
    - apps/web/src/components/portal/portal-equipment-tab.tsx
    - apps/web/src/components/portal/portal-return-flow.tsx
    - apps/web/src/components/settings/carrier-credential-form.tsx
    - apps/web/src/components/settings/default-return-carrier-select.tsx
    - apps/web/src/components/settings/dpd-provider-section.tsx
    - apps/web/src/components/settings/ups-provider-section.tsx
    - apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx
    - packages/validators/src/organization.ts
    - packages/api/src/routers/settings.ts

key-decisions:
  - "Removed explicit useMutation<any, Error, Record<string, unknown>> generics -- let tRPC types flow through for proper type safety"
  - "Used as unknown as for intermediate type casts where local interfaces differ from tRPC return types"
  - "Fixed settings.getOrgSettings/updateOrgSettings to settings.get/update (correct procedure names hidden by proxy)"
  - "Added defaultReturnCarrier to updateOrganizationSettingsSchema -- was silently broken behind (trpc as any) proxy"
  - "Used as const for carrier literal types in carrier-credential-form to satisfy discriminated union input"

patterns-established:
  - "Direct tRPC calls: all components use trpc.router.procedure pattern, no intermediate proxy variables"

requirements-completed: [EQUIP-05, EQUIP-06, EQUIP-07, TEAM-02, BILL-10]

# Metrics
duration: 25min
completed: 2026-04-06
---

# Phase 40 Plan 02: Remove tRPC Proxy Workarounds Summary

**Removed all 13 (trpc as any) proxy workarounds, restoring full type safety across billing, teams, equipment, portal, and settings components**

## Performance

- **Duration:** 25 min
- **Started:** 2026-04-06T09:19:20Z
- **Completed:** 2026-04-06T09:44:25Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Eliminated all 13 (trpc as any) proxy workarounds across the web app
- Restored proper TypeScript type inference for all tRPC mutation and query calls
- Fixed broken defaultReturnCarrier settings persistence that was silently failing behind proxy
- All 362 test files pass (3464 tests), zero TypeScript errors in modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove proxy workarounds from equipment and portal files** - `e932b61` (fix)
2. **Task 2: Remove proxy workarounds from billing, teams, and settings files + verify tests** - `6b78368` (fix)

## Files Created/Modified
- `apps/web/src/components/billing/usage-dashboard.tsx` - Replaced billingProxy with trpc.billing
- `apps/web/src/components/integrations/teams-channel-mapping-card.tsx` - Replaced teamsProxy with trpc.teams
- `apps/web/src/components/equipment/carrier-shipment-form.tsx` - Replaced equipmentProxy with trpc.equipment, removed explicit mutation generics
- `apps/web/src/components/equipment/inpost-shipment-form.tsx` - Replaced equipmentProxy with trpc.equipment
- `apps/web/src/components/equipment/shipment-label-view.tsx` - Replaced equipmentProxy with trpc.equipment
- `apps/web/src/components/equipment/return-approval-banner.tsx` - Replaced equipmentProxy with trpc.equipment
- `apps/web/src/components/portal/portal-equipment-tab.tsx` - Replaced portalProxy with trpc.portal
- `apps/web/src/components/portal/portal-return-flow.tsx` - Replaced portalProxy with trpc.portal
- `apps/web/src/components/settings/carrier-credential-form.tsx` - Replaced equipmentProxy with trpc.equipment, added as const for carrier literals
- `apps/web/src/components/settings/default-return-carrier-select.tsx` - Replaced settingsProxy/equipmentProxy with trpc.settings/trpc.equipment, fixed procedure names
- `apps/web/src/components/settings/dpd-provider-section.tsx` - Replaced equipmentProxy with trpc.equipment
- `apps/web/src/components/settings/ups-provider-section.tsx` - Replaced equipmentProxy with trpc.equipment
- `apps/web/src/app/[locale]/(dashboard)/equipment/[id]/page.tsx` - Replaced both equipmentProxy and courierConfigProxy with trpc.equipment
- `packages/validators/src/organization.ts` - Added defaultReturnCarrier field to settings schema
- `packages/api/src/routers/settings.ts` - Added defaultReturnCarrier handling in update mutation

## Decisions Made
- Removed explicit `useMutation<any, Error, Record<string, unknown>>` generics to let tRPC types flow through properly
- Fixed `settings.getOrgSettings`/`updateOrgSettings` to actual router procedure names `settings.get`/`settings.update`
- Added `defaultReturnCarrier` to settings schema because the feature was silently broken behind the `as any` proxy
- Used `as const` for carrier literal types in credential form to satisfy discriminated union input types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed settings procedure names (getOrgSettings/updateOrgSettings did not exist)**
- **Found during:** Task 2 (default-return-carrier-select.tsx)
- **Issue:** The proxy declared `settingsProxy.getOrgSettings` and `settingsProxy.updateOrgSettings` but the settings router procedures are named `get` and `update`
- **Fix:** Changed to `trpc.settings.get` and `trpc.settings.update`
- **Files modified:** apps/web/src/components/settings/default-return-carrier-select.tsx
- **Verification:** TypeScript compilation passes, tests pass
- **Committed in:** 6b78368

**2. [Rule 1 - Bug] Fixed useMutation type conflicts revealed by removing proxy**
- **Found during:** Task 2 (all mutation files)
- **Issue:** Explicit `useMutation<any, Error, Record<string, unknown>>` generics conflicted with typed tRPC mutation options
- **Fix:** Removed explicit generics, letting tRPC types flow through
- **Files modified:** carrier-shipment-form, inpost-shipment-form, return-approval-banner, portal-equipment-tab, portal-return-flow, carrier-credential-form, default-return-carrier-select
- **Verification:** TypeScript compilation passes
- **Committed in:** 6b78368

**3. [Rule 2 - Missing Critical] Added defaultReturnCarrier to settings schema**
- **Found during:** Task 2 (default-return-carrier-select.tsx)
- **Issue:** The `settingsJson` property was never accepted by the settings update mutation -- `defaultReturnCarrier` was silently lost on every save
- **Fix:** Added `defaultReturnCarrier` field to `updateOrganizationSettingsSchema` and handled it in the settings router
- **Files modified:** packages/validators/src/organization.ts, packages/api/src/routers/settings.ts
- **Verification:** TypeScript compilation passes, tests pass
- **Committed in:** 6b78368

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All auto-fixes were necessary to achieve type safety. The bugs were hidden by the (trpc as any) proxy and only became visible when type checking was restored. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## Known Stubs
None - all components use real data sources with properly typed tRPC calls.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 40 complete: all API dist types rebuilt and all proxy workarounds removed
- Zero (trpc as any) remaining in the codebase
- Full type safety restored across all tRPC call sites

---
*Phase: 40-integration-cleanup-featuregate-type-safety*
*Completed: 2026-04-06*

## Self-Check: PASSED
