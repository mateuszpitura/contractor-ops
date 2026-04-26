---
phase: 05-invoice-intake-matching
plan: 01
subsystem: api
tags: [trpc, zod, prisma, invoice, matching, sha256]

requires:
  - phase: 01-foundation-auth
    provides: "tenantProcedure, requirePermission, RBAC middleware, plain() pattern"
  - phase: 03-contracts-documents
    provides: "contractRouter, documentRouter, DocumentLink entity model"
provides:
  - "invoiceRouter with 11 tRPC procedures (CRUD, list, matching, status transitions)"
  - "Invoice Zod validators (create, update, list, manualMatch schemas)"
  - "Auto-matching engine service (NIP lookup, contract scoring, deviation detection, duplicate check)"
  - "computeDuplicateCheckHash for SHA-256 duplicate detection"
affects: [05-02, 05-03, 05-04, 05-05, 06-approval-workflow, 08-payment-runs]

tech-stack:
  added: []
  patterns: ["NIP-based contractor matching", "score-based match classification (MATCHED/PARTIAL/UNMATCHED/DISCREPANCY)", "flagsJson array for invoice warnings"]

key-files:
  created:
    - packages/validators/src/invoice.ts
    - packages/api/src/services/invoice-matching.ts
    - packages/api/src/routers/invoice.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts

key-decisions:
  - "Used Organization.settingsJson (not metadata) for invoiceDeviationThresholdPercent"
  - "Contractor lookup uses taxId field (not nip) matching Prisma Contractor model"
  - "Score thresholds: 80+ = MATCHED, 50-79 = PARTIAL, 0-49 = UNMATCHED; deviation override to DISCREPANCY"

patterns-established:
  - "Invoice matching score: 50pts NIP match + 30pts active contract + 20pts amount within threshold"
  - "flagsJson as string[] for runtime invoice warnings (NO_ACTIVE_CONTRACT, EXPIRED_CONTRACT, CURRENCY_MISMATCH, DUPLICATE_SUSPECTED)"

requirements-completed: [INV-01, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08, INV-09]

duration: 4min
completed: 2026-03-21
---

# Phase 05 Plan 01: Invoice Backend Summary

**Invoice tRPC router with 11 procedures, Zod validators, and NIP-based auto-matching engine with score classification and duplicate detection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-21T20:30:51Z
- **Completed:** 2026-03-21T20:34:52Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Invoice Zod validators (create, update, list, manualMatch) with all Prisma enum mirrors
- Auto-matching engine with NIP lookup, contract scoring (0-100), deviation detection, and SHA-256 duplicate check
- Invoice tRPC router with 11 procedures: create, getById, update, list, statusCounts, submitForMatching, manualMatch, voidInvoice, dismissDuplicate, searchContractors, contractsForContractor
- Router registered in appRouter, TypeScript compiles cleanly, API package builds

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice Zod validators and matching engine service** - `bbcab1e` (feat)
2. **Task 2: Invoice tRPC router with all procedures** - `38d0b92` (feat)

## Files Created/Modified
- `packages/validators/src/invoice.ts` - Zod schemas for invoice CRUD and matching with enum mirrors
- `packages/validators/src/index.ts` - Re-exports all invoice validators and types
- `packages/api/src/services/invoice-matching.ts` - Auto-matching engine: computeDuplicateCheckHash + runAutoMatch
- `packages/api/src/routers/invoice.ts` - 11-procedure tRPC router for invoice lifecycle
- `packages/api/src/root.ts` - Register invoiceRouter in appRouter

## Decisions Made
- Used `Organization.settingsJson` for `invoiceDeviationThresholdPercent` (not `metadata` which is String type)
- Contractor lookup via `taxId` field (Prisma model uses `taxId`, not `nip`)
- Score classification: 80-100 = MATCHED, 50-79 = PARTIAL, 0-49 = UNMATCHED; deviation percentage override to DISCREPANCY

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed contractor NIP field name**
- **Found during:** Task 1 (matching engine service)
- **Issue:** Plan referenced `nip` field on Contractor model, but Prisma schema uses `taxId`
- **Fix:** Changed `nip: invoice.sellerTaxId` to `taxId: invoice.sellerTaxId`
- **Files modified:** packages/api/src/services/invoice-matching.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** bbcab1e (Task 1 commit)

**2. [Rule 1 - Bug] Fixed org settings field name**
- **Found during:** Task 2 (submitForMatching procedure)
- **Issue:** Plan referenced `settingsJson` via `metadata` field, but Organization.metadata is String?, not Json?
- **Fix:** Changed to `settingsJson` which is the Json? field on Organization model
- **Files modified:** packages/api/src/routers/invoice.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** 38d0b92 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both were field name corrections to match actual Prisma schema. No scope creep.

## Issues Encountered
None beyond the field name corrections documented above.

## Known Stubs
None - all procedures are fully wired to Prisma queries and the matching engine.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Invoice router is the foundation for all remaining Phase 5 plans
- Plans 02-05 can build UI, email intake, and refinements on top of this API
- Approval workflow (Phase 6) can integrate with invoice status transitions

---
## Self-Check: PASSED

All 5 files verified present. Both commits (bbcab1e, 38d0b92) verified in git log.

---
*Phase: 05-invoice-intake-matching*
*Completed: 2026-03-21*
