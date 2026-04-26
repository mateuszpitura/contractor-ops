---
phase: 33-inpost-courier-integration
plan: 02
subsystem: api
tags: [trpc, inpost, shipx, webhook, qstash, courier, equipment, return-request, portal]

requires:
  - phase: 33-inpost-courier-integration/plan-01
    provides: InPostClient, webhook handler, polling service, status mapper, courier validators
provides:
  - InPost webhook endpoint at /api/webhooks/inpost
  - QStash polling cron at /api/cron/inpost-status-poll
  - Equipment router InPost shipment creation, return approval/rejection, label retrieval
  - Portal router equipment listing, return request flow, label download
  - Offboarding auto-shipment with InPost when org has courier config (D-10)
affects: [33-inpost-courier-integration/plan-03, equipment-ui, portal-ui]

tech-stack:
  added: []
  patterns: [offboarding-auto-shipment, portal-return-flow, dedicated-webhook-endpoint]

key-files:
  created:
    - apps/web/src/app/api/webhooks/inpost/route.ts
    - apps/web/src/app/api/cron/inpost-status-poll/route.ts
    - packages/api/src/routers/__tests__/portal-equipment.test.ts
    - packages/api/src/routers/__tests__/equipment-return.test.ts
  modified:
    - packages/api/src/routers/equipment.ts
    - packages/api/src/routers/portal.ts
    - packages/api/src/services/equipment-workflow.ts
    - packages/api/src/services/courier/inpost-client.ts
    - packages/api/src/services/courier/inpost-polling-service.ts
    - packages/api/src/services/courier/inpost-webhook-handler.ts

key-decisions:
  - "Webhook endpoint matches org by signature first, falls back to shipment externalId/trackingNumber lookup"
  - "Offboarding auto-shipment uses 'system' as createdByUserId since no user context in workflow service"
  - "getReturnLabel fetches fresh label from ShipX API rather than caching, ensuring latest version"

patterns-established:
  - "Dedicated webhook endpoint pattern (not through [provider] route) for courier integrations"
  - "Offboarding auto-shipment with try/catch — API failures do not block task start"
  - "Portal return flow: PENDING_APPROVAL for self-initiated, SHIPMENT_CREATED for offboarding (D-09/D-10)"

requirements-completed: [EQUIP-05, EQUIP-11]

duration: 14min
completed: 2026-04-04
---

# Phase 33 Plan 02: InPost Router Integration Summary

**tRPC equipment/portal router extensions with InPost shipment creation, return approval workflow, webhook/cron endpoints, and offboarding auto-shipment**

## Performance

- **Duration:** 14 min
- **Started:** 2026-04-04T15:46:08Z
- **Completed:** 2026-04-04T16:00:57Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Equipment router extended with 5 new endpoints: createInPostShipment, approveReturnRequest, rejectReturnRequest, listReturnRequests, getShipmentLabel
- Portal router extended with 5 new endpoints: listEquipment, getReturnStatus, requestReturn, cancelReturn, getReturnLabel
- Webhook endpoint at /api/webhooks/inpost processes ShipX status pushes with signature verification and org matching
- QStash cron endpoint at /api/cron/inpost-status-poll polls active InPost shipments
- Offboarding auto-shipment in equipment-workflow.ts creates InPost return shipment and ReturnRequest with SHIPMENT_CREATED status when org has InPost config and contractor has preferred Paczkomat (D-10)
- 11 tests passing across 2 test files (3 portal-equipment + 8 equipment-return)

## Task Commits

Each task was committed atomically:

1. **Task 1: Webhook route, cron route, equipment router InPost extensions, and offboarding auto-shipment** - `1f62502` (feat)
2. **Task 2: Portal router equipment extensions and return flow with tests** - `75e43a5` (feat)

## Files Created/Modified
- `apps/web/src/app/api/webhooks/inpost/route.ts` - Dedicated InPost webhook endpoint with signature verification
- `apps/web/src/app/api/cron/inpost-status-poll/route.ts` - QStash-scheduled polling for InPost shipment statuses
- `packages/api/src/routers/equipment.ts` - Extended with createInPostShipment, approveReturnRequest, rejectReturnRequest, listReturnRequests, getShipmentLabel
- `packages/api/src/routers/portal.ts` - Extended with listEquipment, getReturnStatus, requestReturn, cancelReturn, getReturnLabel
- `packages/api/src/services/equipment-workflow.ts` - Added autoCreateInPostReturnShipment for offboarding D-10
- `packages/api/src/routers/__tests__/portal-equipment.test.ts` - 3 tests for portal equipment listing and return status
- `packages/api/src/routers/__tests__/equipment-return.test.ts` - 8 tests for return flow and offboarding auto-shipment

## Decisions Made
- Webhook endpoint matches org by signature first, then falls back to shipment externalId/trackingNumber lookup for orgs without webhook secrets
- Offboarding auto-shipment uses "system" as createdByUserId since there is no user context in the workflow service
- getReturnLabel fetches fresh labels from ShipX API rather than caching to ensure the latest version
- Auto-shipment wrapped in try/catch so ShipX API failures do not block the workflow task start

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed missing .js extensions in courier module imports**
- **Found during:** Task 1 (build verification)
- **Issue:** Plan 01 courier files used extensionless imports (e.g., `./courier-client`) which fail with nodenext module resolution
- **Fix:** Added `.js` extensions to all relative imports in inpost-client.ts, inpost-polling-service.ts, inpost-webhook-handler.ts
- **Files modified:** packages/api/src/services/courier/inpost-client.ts, inpost-polling-service.ts, inpost-webhook-handler.ts
- **Verification:** Build passes without import errors
- **Committed in:** 1f62502 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for build correctness. No scope creep.

## Issues Encountered
- Worktree does not have node_modules installed; tests required copying files to main repo for execution. This is a known limitation of parallel worktree execution.
- Pre-existing Teams integration build errors (missing @microsoft/microsoft-graph-client) required mocking in test files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All server-side endpoints ready for Plan 03 UI implementation
- Equipment router has full InPost shipment CRUD and return approval workflow
- Portal router has complete contractor return flow
- Offboarding auto-shipment path tested and verified

---
*Phase: 33-inpost-courier-integration*
*Completed: 2026-04-04*
