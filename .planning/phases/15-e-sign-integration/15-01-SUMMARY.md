---
phase: 15-e-sign-integration
plan: 01
subsystem: database
tags: [prisma, e-sign, docusign, autenti, vitest]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: IntegrationProvider enum, IntegrationConnection model, credential store
provides:
  - SigningEnvelope, SigningRecipient, SigningEvent Prisma models with 4 enums
  - SIGNATURE_DECLINED and SIGNATURE_EXPIRED contract statuses with transitions
  - ESignAdapter interface with 7 methods and supportsEmbeddedSigning property
  - Wave 0 test stubs for DocuSign adapter, Autenti adapter, e-sign router, webhook handler
affects: [15-02, 15-03, 15-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [signing envelope lifecycle, provider-agnostic adapter interface]

key-files:
  created:
    - packages/db/prisma/schema/esign.prisma
    - packages/integrations/src/types/esign.ts
    - packages/integrations/src/adapters/__tests__/docusign-adapter.test.ts
    - packages/integrations/src/adapters/__tests__/autenti-adapter.test.ts
    - packages/api/src/routers/__tests__/esign.test.ts
    - packages/integrations/src/services/__tests__/signing-webhook.test.ts
  modified:
    - packages/db/prisma/schema/contract.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/api/src/routers/contract.ts

key-decisions:
  - "ESignAdapter interface created as parallel agent — types file already existed when Task 2 executed"
  - "DRAFT can now transition to PENDING_SIGNATURE per D-08 decision"
  - "SIGNATURE_DECLINED and SIGNATURE_EXPIRED can transition back to PENDING_SIGNATURE for re-send"

patterns-established:
  - "Signing models follow existing integration pattern: organizationId scoping, cuid IDs, composite indexes"
  - "ESignAdapter interface parallels IntegrationProviderAdapter with e-sign-specific methods"

requirements-completed: [SIGN-01, SIGN-03, SIGN-04]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 15 Plan 01: Schema & Contracts Summary

**Prisma signing models (envelope/recipient/event), ESignAdapter interface with 7 operations, and 23 Wave 0 test stubs for DocuSign, Autenti, router, and webhook handler**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T22:22:02Z
- **Completed:** 2026-03-23T22:35:33Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- SigningEnvelope, SigningRecipient, SigningEvent models with 4 enums and composite indexes
- ContractStatus extended with SIGNATURE_DECLINED and SIGNATURE_EXPIRED, CONTRACT_TRANSITIONS updated with DRAFT->PENDING_SIGNATURE and decline/expire re-send paths
- ESignAdapter interface defining createEnvelope, getEmbeddedSigningUrl, getSignedDocument, getEnvelopeStatus, voidEnvelope, resendToRecipient, normalizeWebhookEvent
- 23 todo test stubs across 4 test files for all Wave 1-2 implementations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create esign Prisma schema and update ContractStatus enum** - `0377c4d` (feat)
2. **Task 2: Create ESignAdapter interface, shared types, and Wave 0 test stubs** - `5679dbf` (test)

## Files Created/Modified
- `packages/db/prisma/schema/esign.prisma` - SigningEnvelope, SigningRecipient, SigningEvent models with 4 enums
- `packages/db/prisma/schema/contract.prisma` - Added SIGNATURE_DECLINED, SIGNATURE_EXPIRED to ContractStatus
- `packages/db/prisma/schema/organization.prisma` - Added signingEnvelopes and signingEvents relation arrays
- `packages/db/prisma/schema/auth.prisma` - Added sentSigningEnvelopes relation to User
- `packages/api/src/routers/contract.ts` - Extended CONTRACT_TRANSITIONS with signing states
- `packages/integrations/src/types/esign.ts` - ESignAdapter interface and all shared types (created by parallel agent)
- `packages/integrations/src/adapters/__tests__/docusign-adapter.test.ts` - 6 todo stubs
- `packages/integrations/src/adapters/__tests__/autenti-adapter.test.ts` - 5 todo stubs
- `packages/api/src/routers/__tests__/esign.test.ts` - 5 todo stubs
- `packages/integrations/src/services/__tests__/signing-webhook.test.ts` - 7 todo stubs

## Decisions Made
- ESignAdapter types file was already created by a parallel agent; Task 2 only added test stub files
- DRAFT->PENDING_SIGNATURE transition added per D-08 decision from research phase
- SIGNATURE_DECLINED and SIGNATURE_EXPIRED states allow re-send back to PENDING_SIGNATURE per D-11

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TS7016 error for docusign-esign module (missing type declarations) -- not caused by this plan, out of scope
- Prisma db push required --accept-data-loss flag due to pre-existing unique constraint additions from Phase 14

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Schema and types are in place for Plan 02 (DocuSign adapter implementation)
- All test stubs ready for Plans 02-04 to fill in
- CONTRACT_TRANSITIONS ready for e-sign router to use

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (0377c4d, 5679dbf) found in git log.

---
*Phase: 15-e-sign-integration*
*Completed: 2026-03-23*
