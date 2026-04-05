---
phase: 35-feature-gating-dpd-ups-billing-polish
plan: 02
subsystem: api
tags: [dpd, ups, courier, oauth, polling, zod, tdd]

# Dependency graph
requires:
  - phase: 33-inpost-courier-integration
    provides: CourierClient interface, InPost reference implementation, polling service pattern
provides:
  - DPDClient implementing CourierClient with SOAP-like REST API
  - UPSClient implementing CourierClient with OAuth 2.0 token caching
  - DPD and UPS status mappers with comprehensive status coverage
  - DPD and UPS polling services replicating InPost pattern
  - Carrier factory dispatching to InPost/DPD/UPS by carrier string
  - DPD and UPS Zod validators (shipment create + config schemas)
  - Extended courier-client.ts with AddressShipmentParams, DPDShipmentParams, UPSShipmentParams
affects: [35-03, 35-04, equipment-router, courier-webhooks]

# Tech tracking
tech-stack:
  added: []
  patterns: [address-based carrier params extending CourierClient, OAuth 2.0 token caching with pre-expiry refresh, carrier factory pattern]

key-files:
  created:
    - packages/api/src/services/courier/dpd-client.ts
    - packages/api/src/services/courier/dpd-status-mapper.ts
    - packages/api/src/services/courier/dpd-polling-service.ts
    - packages/api/src/services/courier/ups-client.ts
    - packages/api/src/services/courier/ups-status-mapper.ts
    - packages/api/src/services/courier/ups-polling-service.ts
    - packages/api/src/services/courier/carrier-factory.ts
    - packages/api/src/services/courier/__tests__/dpd-client.test.ts
    - packages/api/src/services/courier/__tests__/dpd-status-mapper.test.ts
    - packages/api/src/services/courier/__tests__/ups-client.test.ts
    - packages/api/src/services/courier/__tests__/ups-status-mapper.test.ts
    - packages/validators/src/__tests__/dpd-ups-equipment.test.ts
  modified:
    - packages/api/src/services/courier/courier-client.ts
    - packages/validators/src/equipment.ts

key-decisions:
  - "DPD uses SOAP-like REST with auth credentials in request body (not headers)"
  - "UPS OAuth 2.0 token caching with 5-minute pre-expiry refresh buffer"
  - "Address-based carriers share AddressShipmentParams base interface"
  - "Carrier factory uses case-insensitive switch for carrier string dispatch"

patterns-established:
  - "AddressShipmentParams: base interface for address-based carriers extending CourierClient"
  - "OAuth token caching: private tokenCache with expiresAt and pre-expiry buffer check"
  - "Carrier factory: getCourierClient dispatches to correct client by carrier string"

requirements-completed: [EQUIP-06, EQUIP-07]

# Metrics
duration: 6min
completed: 2026-04-05
---

# Phase 35 Plan 02: DPD & UPS Courier Clients Summary

**DPD and UPS courier clients with OAuth token caching, status mappers, polling services, carrier factory, and Zod validators -- all following InPost's CourierClient pattern**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T10:38:03Z
- **Completed:** 2026-04-05T10:44:35Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- DPDClient implements all 4 CourierClient methods with SOAP-like REST, size mapping, and Zod response validation
- UPSClient implements CourierClient with OAuth 2.0 client_credentials flow and 5-minute pre-expiry token refresh
- DPD (9 statuses) and UPS (7 type codes) status mappers with comprehensive coverage
- DPD and UPS polling services replicate InPost's proven pattern (load config, find active shipments, check status, create events, auto-advance equipment)
- Carrier factory getCourierClient dispatches to InPost/DPD/UPS by case-insensitive carrier string
- Zod schemas: deliveryAddressSchema, dpdShipmentCreateSchema, dpdConfigSchema, upsShipmentCreateSchema (with serviceCode enum), upsConfigSchema
- Extended courier-client.ts with AddressShipmentParams, DPDShipmentParams, UPSShipmentParams interfaces
- TDD approach: 4 commits (2 RED + 2 GREEN), all 80 courier tests + 24 validator tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: DPD client + status mapper + validators (RED)** - `1913448` (test)
2. **Task 1: DPD client + status mapper + validators (GREEN)** - `e5b0853` (feat)
3. **Task 2: UPS client + polling + factory + validators (RED)** - `61e79ed` (test)
4. **Task 2: UPS client + polling + factory + validators (GREEN)** - `6762f72` (feat)

## Files Created/Modified
- `packages/api/src/services/courier/courier-client.ts` - Extended with AddressShipmentParams, DPDShipmentParams, UPSShipmentParams
- `packages/api/src/services/courier/dpd-client.ts` - DPDClient implementing CourierClient with SOAP-like REST
- `packages/api/src/services/courier/dpd-status-mapper.ts` - DPD status mapping (9 statuses)
- `packages/api/src/services/courier/dpd-polling-service.ts` - QStash-triggered DPD shipment polling
- `packages/api/src/services/courier/ups-client.ts` - UPSClient with OAuth 2.0 token caching
- `packages/api/src/services/courier/ups-status-mapper.ts` - UPS type code mapping (7 codes)
- `packages/api/src/services/courier/ups-polling-service.ts` - QStash-triggered UPS shipment polling
- `packages/api/src/services/courier/carrier-factory.ts` - getCourierClient factory dispatching to correct client
- `packages/validators/src/equipment.ts` - Added DPD and UPS Zod schemas
- `packages/api/src/services/courier/__tests__/dpd-client.test.ts` - DPD client tests (10 tests)
- `packages/api/src/services/courier/__tests__/dpd-status-mapper.test.ts` - DPD status mapper tests (11 tests)
- `packages/api/src/services/courier/__tests__/ups-client.test.ts` - UPS client tests (7 tests)
- `packages/api/src/services/courier/__tests__/ups-status-mapper.test.ts` - UPS status mapper tests (9 tests)
- `packages/validators/src/__tests__/dpd-ups-equipment.test.ts` - DPD and UPS validator tests (24 tests)

## Decisions Made
- DPD uses SOAP-like REST with auth credentials embedded in request body (authData object) rather than HTTP headers
- UPS OAuth 2.0 token caching uses 5-minute (300,000ms) pre-expiry buffer to avoid mid-request expiration
- AddressShipmentParams base interface separates address-based carriers from point-based (InPost) carriers
- Carrier factory uses case-insensitive switch (`carrier.toLowerCase()`) for flexible carrier string matching

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all implementations are fully wired with real API endpoints and Zod validation.

## Next Phase Readiness
- DPD and UPS clients ready for equipment router integration
- Carrier factory enables carrier-agnostic shipment creation
- Polling services ready for QStash cron job registration

---
*Phase: 35-feature-gating-dpd-ups-billing-polish*
*Completed: 2026-04-05*

## Self-Check: PASSED
