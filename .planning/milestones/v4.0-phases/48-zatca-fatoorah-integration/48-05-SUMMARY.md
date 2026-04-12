---
phase: 48-zatca-fatoorah-integration
plan: 05
subsystem: api
tags: [zatca, csr, ecdsa, onboarding, x509, node-forge, infisical, trpc]

# Dependency graph
requires:
  - phase: 48-zatca-fatoorah-integration (plan 01)
    provides: ZATCA schemas, types, profile, generator, parser, compliance
provides:
  - ECDSA P-256 CSR generation with ZATCA-required X.509 subject attributes
  - 6 compliance test invoice builder for onboarding step 3
  - 5-step ZATCA onboarding orchestrator service
  - tRPC procedures for onboarding wizard UI
affects: [48-06 onboarding wizard UI, 48-04 api-client integration]

# Tech tracking
tech-stack:
  added: [node-forge (CSR ASN.1 construction)]
  patterns: [ASN.1 DER construction with forge + Node.js crypto ECDSA signing, dynamic module loading for parallel plan compatibility]

key-files:
  created:
    - packages/einvoice/src/profiles/zatca/onboarding.ts
    - packages/einvoice/src/profiles/zatca/__tests__/onboarding.test.ts
    - packages/api/src/services/zatca-onboarding.ts
  modified:
    - packages/einvoice/src/index.ts
    - packages/einvoice/package.json
    - packages/api/src/routers/zatca.ts
    - packages/api/src/root.ts

key-decisions:
  - "Used node-forge ASN.1 utilities for CSR structure + Node.js crypto for ECDSA signing (forge lacks native EC key support)"
  - "Dynamic import for ZatcaApiClient to decouple from Plan 04 parallel execution"
  - "credentialsRef set to infisical:zatca/{orgId} convention for Infisical path reference"

patterns-established:
  - "ASN.1 CSR construction: Build X.509 CSR manually with forge.asn1 when node-forge PKI module lacks algorithm support"
  - "Dynamic cross-package imports: Use dynamic import() with fallback TRPCError for modules created by parallel plans"

requirements-completed: [ZATCA-06]

# Metrics
duration: 20min
completed: 2026-04-11
---

# Phase 48 Plan 05: ZATCA Device Onboarding Summary

**ECDSA P-256 CSR generation with ZATCA X.509 attributes, 6 compliance test invoices, and 5-step onboarding orchestrator with tRPC procedures**

## Performance

- **Duration:** 20 min
- **Started:** 2026-04-11T23:29:04Z
- **Completed:** 2026-04-11T23:49:18Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- CSR generation producing ECDSA P-256 key pair with all ZATCA-required X.509 subject attributes (CN, O, OU, C=SA, SN, UID, title, registeredAddress, businessCategory)
- 6 compliance test invoices covering standard+simplified x invoice+credit+debit combinations
- Full 5-step onboarding orchestrator: saveTaxDetails, generateAndStoreCsr, requestComplianceCsid, runComplianceChecks, exchangeProductionCertificate
- Private key stored in Infisical immediately after generation, never returned to client
- tRPC procedures registered in zatcaRouter for all wizard steps

## Task Commits

Each task was committed atomically:

1. **Task 1: CSR generation and compliance test invoice builder** (TDD)
   - `a45bb8c` (test) - Failing tests for CSR and compliance invoices
   - `3b7c842` (feat) - Implementation with node-forge ASN.1 + Node.js crypto
2. **Task 2: ZATCA onboarding orchestrator service with tRPC procedures** - `ea3fe20` (feat)

## Files Created/Modified
- `packages/einvoice/src/profiles/zatca/onboarding.ts` - CSR generation (generateZatcaCsr) and compliance test invoice builder (buildComplianceTestInvoices)
- `packages/einvoice/src/profiles/zatca/__tests__/onboarding.test.ts` - 9 tests covering CSR attributes, key type, PEM format, invoice types, extensions, amounts
- `packages/api/src/services/zatca-onboarding.ts` - 5-step onboarding orchestrator with Infisical secret storage
- `packages/api/src/routers/zatca.ts` - tRPC router with 6 procedures (saveTaxDetails, generateCsr, requestComplianceCsid, runComplianceChecks, exchangeProductionCert, getOnboardingState)
- `packages/api/src/root.ts` - Registered zatcaRouter in appRouter
- `packages/einvoice/src/index.ts` - Exported generateZatcaCsr and buildComplianceTestInvoices
- `packages/einvoice/package.json` - Added node-forge and @types/node-forge dependencies

## Decisions Made
- Used node-forge for ASN.1 structure construction because Node.js crypto lacks native CSR creation support. However, node-forge doesn't support EC keys in its PKI module, so the CSR is built manually: forge.asn1 for the DER structure, Node.js crypto for ECDSA signing.
- Dynamic import pattern for ZatcaApiClient (from Plan 04) to avoid hard compile-time dependency in parallel execution. Uses interface-based type safety with runtime fallback.
- Initial PIH (Previous Invoice Hash) uses SHA-256 of string "0" per ZATCA specification for the first invoice in a chain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test regex for invoice subtype validation**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Test used `/^[01]{7}$/` regex but ZATCA subtypes contain digit "2" (e.g., "0200000")
- **Fix:** Changed regex to `/^[0-9]{7}$/` to match all valid ZATCA subtypes
- **Files modified:** packages/einvoice/src/profiles/zatca/__tests__/onboarding.test.ts
- **Verification:** All 9 tests pass
- **Committed in:** 3b7c842 (Task 1 feat commit)

**2. [Rule 3 - Blocking] Rewrote CSR generation to handle EC key incompatibility**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** node-forge's `pki.publicKeyFromPem()` throws "Cannot read public key. Unknown OID." for ECDSA keys
- **Fix:** Built CSR entirely from ASN.1 primitives using forge.asn1 helpers, with SPKI DER bytes from Node.js crypto passed directly
- **Files modified:** packages/einvoice/src/profiles/zatca/onboarding.ts
- **Verification:** All 9 tests pass, CSR contains correct attributes
- **Committed in:** 3b7c842 (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Cross-package TypeScript compilation errors due to parallel plan execution: einvoice and integrations packages have stale dist (not rebuilt with new exports from parallel Plans 02/03/04). These resolve at merge time when all worktrees are combined and packages rebuilt.
- IntegrationConnection model requires `credentialsRef` and `connectedByUserId` fields. Used `infisical:zatca/{orgId}` convention for credentialsRef and passed userId through the service.

## Known Stubs
None - all functions are fully implemented with real logic.

## User Setup Required
None - no external service configuration required for this plan. Infisical configuration is handled by Plan 04.

## Next Phase Readiness
- Onboarding service ready for Plan 06 (UI wizard) to call via tRPC
- CSR generation and compliance test invoices ready for integration testing
- Depends on Plan 04 completion for ZatcaApiClient availability at runtime

---
*Phase: 48-zatca-fatoorah-integration*
*Plan: 05*
*Completed: 2026-04-11*

## Self-Check: PASSED
- All 5 created files exist on disk
- All 3 commit hashes verified in git log
