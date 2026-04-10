---
phase: 35-feature-gating-dpd-ups-billing-polish
plan: 03
subsystem: api
tags: [trpc, dpd, ups, courier, tier-gating, equipment, polling]

# Dependency graph
requires:
  - phase: 35-01
    provides: requireTier middleware, proProcedure, TIER_RANK comparison
  - phase: 35-02
    provides: DPDClient, UPSClient, dpd-polling-service, ups-polling-service, validator schemas
provides:
  - createDpdShipment tRPC procedure with PRO tier gating
  - createUpsShipment tRPC procedure with PRO tier gating
  - saveCourierConfig admin procedure for DPD/UPS credential management
  - getCourierConfigs admin procedure for listing configured carriers
  - Multi-carrier polling cron (InPost + DPD + UPS)
affects: [35-05-carrier-config-ui, equipment-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [carrier-specific shipment procedures with shared DB pattern, write-only credential storage]

key-files:
  created: []
  modified:
    - packages/api/src/routers/equipment.ts
    - apps/web/src/app/api/cron/inpost-status-poll/route.ts
    - packages/validators/src/index.ts

key-decisions:
  - "Credentials are write-only -- getCourierConfigs omits configJson for security"
  - "saveCourierConfig uses z.union([dpdConfigSchema, upsConfigSchema]) for type-safe carrier discrimination"
  - "Polling cron queries distinct organizationIds across all carrier configs, not just InPost"

patterns-established:
  - "Address-based carrier shipment procedure: load config, create client, load equipment+contractor, call API, create DB records in transaction"
  - "Write-only credential pattern: admin can save configs but never read back secrets"

requirements-completed: [EQUIP-06, EQUIP-07, BILL-09]

# Metrics
duration: 5min
completed: 2026-04-05
---

# Phase 35 Plan 03: DPD/UPS Router Wiring Summary

**DPD and UPS shipment creation procedures with PRO tier gating, courier config CRUD, and multi-carrier polling cron**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-05T10:47:40Z
- **Completed:** 2026-04-05T10:52:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added createDpdShipment and createUpsShipment to equipment router with PRO tier gating via requireTier middleware
- Added saveCourierConfig (upsert) and getCourierConfigs (read-only) admin procedures for carrier credential management
- Extended courier polling cron to poll all three carriers (InPost, DPD, UPS) with independent error isolation per carrier

## Task Commits

Each task was committed atomically:

1. **Task 1: Add createDpdShipment, createUpsShipment, saveCourierConfig, and getCourierConfigs to equipment router** - `df8945a` (feat)
2. **Task 2: Extend courier polling cron to cover DPD and UPS carriers** - `b1ba0bc` (feat)

## Files Created/Modified
- `packages/api/src/routers/equipment.ts` - Added 4 new tRPC procedures: createDpdShipment, createUpsShipment, saveCourierConfig, getCourierConfigs
- `apps/web/src/app/api/cron/inpost-status-poll/route.ts` - Extended to poll DPD and UPS alongside InPost with per-carrier error isolation
- `packages/validators/src/index.ts` - Exported DPD/UPS schemas and types from validators package

## Decisions Made
- Credentials are write-only: getCourierConfigs deliberately omits configJson from select, so secrets are never sent back to the client
- saveCourierConfig uses z.union([dpdConfigSchema, upsConfigSchema]) for type-safe carrier discrimination via the carrier literal field
- Polling cron queries distinct organizationIds across all carrier configs (not just InPost) to ensure all orgs with any courier config are polled
- Both DPD and UPS procedures follow the exact same DB pattern as InPost: Shipment + ShipmentEvent + equipment status update + audit log, all in a transaction

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added DPD/UPS schema exports to validators index**
- **Found during:** Task 1
- **Issue:** dpdShipmentCreateSchema, upsShipmentCreateSchema, dpdConfigSchema, upsConfigSchema were defined in equipment.ts but not exported from the validators package index
- **Fix:** Added all 4 schemas and their type exports to packages/validators/src/index.ts
- **Files modified:** packages/validators/src/index.ts
- **Verification:** Import resolves correctly in equipment router
- **Committed in:** df8945a (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for imports to work. No scope creep.

## Issues Encountered
- TypeScript compilation shows pre-existing errors unrelated to this plan (missing module declarations in worktree environment). All equipment.ts-specific patterns verified via grep.
- Vitest suite has pre-existing failures (missing xlsx module in worktree). No new test failures introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Equipment router now has full DPD/UPS shipment creation capability, ready for Plan 05 carrier config UI
- Polling cron covers all three carriers, ready for production deployment
- saveCourierConfig and getCourierConfigs provide the backend for the carrier credential management UI

---
*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Completed: 2026-04-05*
