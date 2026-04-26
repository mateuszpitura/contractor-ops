---
phase: 33-inpost-courier-integration
plan: 01
subsystem: api
tags: [inpost, shipx, courier, webhook, polling, prisma, zod]

requires:
  - phase: 30-equipment-tracking
    provides: Shipment model, ShipmentEvent, equipment status transitions, workflow task completion

provides:
  - CourierClient interface with 4 methods (createShipment, getLabel, getStatus, cancelShipment)
  - InPostClient ShipX API wrapper with sandbox/production URL support
  - InPost status mapper covering 17 ShipX statuses
  - Webhook handler with deduplication and equipment auto-advancement
  - Polling service for missed webhook events
  - ReturnRequest model with approval workflow states
  - CourierConfig model for per-org courier credentials
  - Preferred Paczkomat fields on Contractor model
  - 7 new Zod validators for InPost/courier domain

affects: [33-02-PLAN, 33-03-PLAN, 35-dpd-ups-integration]

tech-stack:
  added: []
  patterns: [CourierClient interface for multi-carrier abstraction, SHIPMENT_TO_EQUIPMENT_STATUS duplication for decoupled webhook handler]

key-files:
  created:
    - packages/api/src/services/courier/courier-client.ts
    - packages/api/src/services/courier/inpost-client.ts
    - packages/api/src/services/courier/inpost-status-mapper.ts
    - packages/api/src/services/courier/inpost-webhook-handler.ts
    - packages/api/src/services/courier/inpost-polling-service.ts
    - packages/api/src/services/courier/__tests__/inpost-client.test.ts
    - packages/api/src/services/courier/__tests__/inpost-status-mapper.test.ts
    - packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts
    - packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts
  modified:
    - packages/db/prisma/schema/equipment.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/validators/src/equipment.ts
    - packages/validators/src/index.ts

key-decisions:
  - "Duplicated SHIPMENT_TO_EQUIPMENT_STATUS and EQUIPMENT_STATUS_TRANSITIONS in webhook handler to avoid circular imports with equipment router"
  - "Webhook signature uses timingSafeEqual with hex Buffer comparison for constant-time HMAC verification"
  - "Polling service uses class-based mock pattern (vi.mock with class syntax) for InPostClient constructor mocking"

patterns-established:
  - "CourierClient interface: abstract 4-method interface for carrier implementations (createShipment, getLabel, getStatus, cancelShipment)"
  - "ShipX status mapping: Record<string, string> constant with mapInPostStatus returning null for unknown statuses"
  - "Webhook deduplication: check shipmentEvent.findFirst before creating events"
  - "CourierConfig model: per-org carrier credentials stored as JSON, separate from IntegrationConnection"

requirements-completed: [EQUIP-05]

duration: 8min
completed: 2026-04-04
---

# Phase 33 Plan 01: InPost Courier Backend Foundation Summary

**CourierClient interface with InPostClient ShipX wrapper, webhook handler with event deduplication, polling fallback service, and 44 passing tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T15:32:55Z
- **Completed:** 2026-04-04T15:41:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- CourierClient interface with 4 methods establishing the multi-carrier abstraction for Phase 35 (DPD/UPS)
- InPostClient wrapping ShipX REST API v1 with Zod response validation and sandbox/production URL switching
- Webhook handler with HMAC-SHA256 signature verification, event deduplication, and equipment status auto-advancement
- Polling service fetching active InPost shipments and creating missing events as QStash-triggered fallback
- Schema extensions: ReturnRequest model, CourierConfig model, externalId/labelUrl on Shipment, preferredPaczkomat on Contractor
- 44 tests passing across 4 test files covering all courier service modules

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema extensions, CourierClient interface, InPostClient, status mapper, and validators** - `7470c37` (feat)
2. **Task 2: Webhook handler, polling service, and test suite (TDD RED)** - `91af3b5` (test)
3. **Task 2: Webhook handler, polling service, and test suite (TDD GREEN)** - `b44ad52` (feat)

## Files Created/Modified

- `packages/api/src/services/courier/courier-client.ts` - Abstract CourierClient interface and shared types
- `packages/api/src/services/courier/inpost-client.ts` - InPost ShipX API HTTP client with Zod validation
- `packages/api/src/services/courier/inpost-status-mapper.ts` - 17-status mapping from ShipX to ShipmentStatus enum
- `packages/api/src/services/courier/inpost-webhook-handler.ts` - Webhook event processing with dedup and auto-advancement
- `packages/api/src/services/courier/inpost-polling-service.ts` - QStash-triggered polling for missed events
- `packages/api/src/services/courier/__tests__/inpost-client.test.ts` - 6 tests for ShipX API client
- `packages/api/src/services/courier/__tests__/inpost-status-mapper.test.ts` - 22 tests for status mapping
- `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` - 7 tests for webhook handler
- `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` - 5 tests for polling service
- `packages/db/prisma/schema/equipment.prisma` - Added externalId, labelUrl, ReturnRequest, CourierConfig, carrier+status index
- `packages/db/prisma/schema/organization.prisma` - Added returnRequests and courierConfigs relations
- `packages/db/prisma/schema/contractor.prisma` - Added returnRequests relation and preferredPaczkomat fields
- `packages/validators/src/equipment.ts` - Added 7 new Zod schemas for InPost/courier domain
- `packages/validators/src/index.ts` - Re-exported all new schemas and types

## Decisions Made

- Duplicated SHIPMENT_TO_EQUIPMENT_STATUS and EQUIPMENT_STATUS_TRANSITIONS constants in webhook handler instead of importing from equipment router to avoid circular dependency
- Used timingSafeEqual with hex Buffer comparison for HMAC-SHA256 signature verification (constant-time comparison prevents timing attacks)
- Graceful degradation when no webhook secret is configured (returns true with warning log) per research open question 1
- ReturnRequest.shipmentId uses @unique for one-to-one optional relation with Shipment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed validators package export path**
- **Found during:** Task 2 (webhook handler tests)
- **Issue:** Webhook handler imported from `@contractor-ops/validators/equipment` but package.json only exports root path `.`
- **Fix:** Changed import to `@contractor-ops/validators` and added all new schemas/types to `packages/validators/src/index.ts` exports
- **Files modified:** `packages/api/src/services/courier/inpost-webhook-handler.ts`, `packages/validators/src/index.ts`
- **Verification:** All 4 test files pass, validators build succeeds
- **Committed in:** `b44ad52`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for module resolution. No scope creep.

## Issues Encountered

None beyond the export path fix documented above.

## Known Stubs

None - all services are fully implemented with working tests.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Plan 02 can wire tRPC router endpoints using CourierClient, webhook handler, and polling service
- Plan 03 can build UI using the validators and types exported from this plan
- Phase 35 (DPD/UPS) can implement CourierClient interface for additional carriers

---
*Phase: 33-inpost-courier-integration*
*Completed: 2026-04-04*
