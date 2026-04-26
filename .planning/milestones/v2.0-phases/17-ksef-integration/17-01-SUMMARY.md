---
phase: 17-ksef-integration
plan: 01
subsystem: integrations
tags: [ksef, xml-parser, fast-xml-parser, rsa-oaep, zod, e-invoice, fa3]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: BaseAdapter, adapter registry, credential service, health types
provides:
  - KsefApiClient for KSeF REST API v2 authentication and invoice querying
  - parseFa3Xml function for FA(3) XML to typed JSON conversion
  - mapKsefToInvoiceFields for Invoice model mapping
  - KsefAdapter registered in global adapter registry
  - Zod schemas for KSeF connection config, parsed invoice, sync params
affects: [17-02-ksef-sync-orchestrator, 17-03-ksef-ui]

# Tech tracking
tech-stack:
  added: [fast-xml-parser]
  patterns: [RSA-OAEP challenge-response auth, grosze conversion from XML, async query polling]

key-files:
  created:
    - packages/validators/src/ksef.ts
    - packages/integrations/src/services/ksef-api-client.ts
    - packages/integrations/src/services/ksef-xml-parser.ts
    - packages/integrations/src/adapters/ksef-adapter.ts
    - packages/integrations/src/__tests__/ksef-xml-parser.test.ts
    - packages/integrations/src/__tests__/ksef-api-client.test.ts
    - packages/integrations/src/__tests__/fixtures/sample-fa3.xml
  modified:
    - packages/validators/src/index.ts
    - packages/integrations/src/index.ts
    - packages/integrations/src/adapters/register-all.ts
    - packages/integrations/package.json

key-decisions:
  - "Added @contractor-ops/validators as workspace dependency for integrations package"
  - "Used generateKeyPairSync in tests for real RSA key pair instead of fake PEM"
  - "Used integrationConnectionId (not connectionId) for sync log queries matching Prisma schema"

patterns-established:
  - "KSeF XML parsing: fast-xml-parser with isArray for FaWiersz, toGrosze() for PLN-to-grosze conversion"
  - "KSeF auth flow: public-key fetch, challenge, RSA-OAEP encrypt, redeem, poll for READY"

requirements-completed: [KSEF-01, KSEF-02]

# Metrics
duration: 6min
completed: 2026-03-27
---

# Phase 17 Plan 01: KSeF Core Engine Summary

**KSeF API client with RSA-OAEP auth, FA(3) XML parser with Zod-validated grosze conversion, and adapter registered in integration registry**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T17:16:28Z
- **Completed:** 2026-03-27T17:22:47Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- KsefApiClient wraps KSeF REST API v2 with token-based RSA-OAEP authentication, async invoice querying, XML download with AES-256 decryption, and retry logic for rate limits
- parseFa3Xml converts FA(3) XML to Zod-validated typed structure with all monetary amounts in grosze (integer)
- KsefAdapter registered in global adapter registry with health status from sync logs
- All Zod schemas (connection config, parsed invoice, sync params) exported from validators package
- 11 tests passing (4 XML parser + 7 API client)

## Task Commits

Each task was committed atomically:

1. **Task 1: KSeF Zod validators and FA(3) XML parser** - `fbf9153` (feat)
2. **Task 2: KSeF API client, adapter, and registration** - `8b0d2ef` (feat)

## Files Created/Modified
- `packages/validators/src/ksef.ts` - Zod schemas for KSeF connection config, parsed invoice, sync params
- `packages/validators/src/index.ts` - Re-exports KSeF schemas and types
- `packages/integrations/src/services/ksef-xml-parser.ts` - FA(3) XML parser and Invoice model mapper
- `packages/integrations/src/services/ksef-api-client.ts` - KSeF REST API v2 client with RSA-OAEP auth
- `packages/integrations/src/adapters/ksef-adapter.ts` - KSeF adapter with health status
- `packages/integrations/src/adapters/register-all.ts` - Added KsefAdapter registration
- `packages/integrations/src/index.ts` - Added KSeF exports
- `packages/integrations/src/__tests__/fixtures/sample-fa3.xml` - Sample FA(3) XML fixture
- `packages/integrations/src/__tests__/ksef-xml-parser.test.ts` - XML parser and mapper tests
- `packages/integrations/src/__tests__/ksef-api-client.test.ts` - API client tests with mocked fetch
- `packages/integrations/package.json` - Added fast-xml-parser and @contractor-ops/validators deps

## Decisions Made
- Added @contractor-ops/validators as workspace dependency for integrations package (needed for Zod schema imports)
- Used generateKeyPairSync in API client tests for real RSA key pair instead of fake PEM (fake key caused crypto decoder errors)
- Used integrationConnectionId field name for sync log queries matching actual Prisma schema (plan used connectionId)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @contractor-ops/validators workspace dependency**
- **Found during:** Task 1 (XML parser tests)
- **Issue:** integrations package did not have validators as a dependency, causing import resolution failure
- **Fix:** Added @contractor-ops/validators@"workspace:*" via pnpm
- **Files modified:** packages/integrations/package.json, pnpm-lock.yaml
- **Verification:** Tests pass, package builds
- **Committed in:** fbf9153 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed IntegrationSyncLog field name in KsefAdapter**
- **Found during:** Task 2 (integrations package build)
- **Issue:** Plan specified `connectionId` but Prisma schema uses `integrationConnectionId`
- **Fix:** Changed to `integrationConnectionId` in where clauses
- **Files modified:** packages/integrations/src/adapters/ksef-adapter.ts
- **Verification:** TypeScript build passes
- **Committed in:** 8b0d2ef (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations.

## User Setup Required
None - no external service configuration required. KSeF credentials will be configured per-organization during connection setup (Plan 03).

## Next Phase Readiness
- KsefApiClient, parseFa3Xml, and mapKsefToInvoiceFields ready for sync orchestrator (Plan 02)
- KsefAdapter registered and available for connection management UI (Plan 03)
- Certificate auth stub in place (marked TODO) per plan decision D-01

## Self-Check: PASSED

All 7 created files verified on disk. Both commit hashes (fbf9153, 8b0d2ef) verified in git log.

---
*Phase: 17-ksef-integration*
*Completed: 2026-03-27*
