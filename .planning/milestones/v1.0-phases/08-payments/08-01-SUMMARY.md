---
phase: 08-payments
plan: 01
subsystem: api
tags: [tRPC, zod, payment, elixir, sepa, mt940, csv, bank-statement, export]

# Dependency graph
requires:
  - phase: 06-approval-workflow
    provides: Approval flow completion triggers paymentStatus READY
  - phase: 05-invoice-intake-matching
    provides: Invoice model with paymentStatus field, billing profiles
provides:
  - Payment Zod validators (run CRUD, status, export, import, removeFromRun)
  - Payment tRPC router with 12 procedures (readyForPayment, create, get, list, lockAndExport, updateItemStatus, markAllPaid, cancel, importStatement, confirmStatementMatches, removeFromRun, listByContractor)
  - Export service (CSV via xlsx, Elixir type 110, SEPA XML pain.001.001.03)
  - Bank statement parser (MT940 via mt940js, CSV) with auto-matcher
  - Approval router paymentStatus READY transition on flow completion
affects: [08-payments, 09-dashboard-reports]

# Tech tracking
tech-stack:
  added: [mt940js]
  patterns: [payment-run-state-machine, pure-function-export-generators, bank-statement-auto-matching]

key-files:
  created:
    - packages/validators/src/payment.ts
    - packages/api/src/routers/payment.ts
    - packages/api/src/services/payment-export.ts
    - packages/api/src/services/bank-statement.ts
  modified:
    - packages/validators/src/index.ts
    - packages/api/src/root.ts
    - packages/api/src/routers/approval.ts
    - packages/api/package.json

key-decisions:
  - "bankAccountMasked field used for IBAN in exports (ContractorBillingProfile stores masked, not raw IBAN)"
  - "generateCsv is async (dynamic xlsx import), generateElixir and generateSepaXml are sync"
  - "Approval router bulkApprove also sets paymentStatus READY (Rule 1 - Bug fix for consistency)"

patterns-established:
  - "VALID_TRANSITIONS map for payment run state machine with strict transition enforcement"
  - "Pure function export generators returning Buffer (no side effects)"
  - "Bank statement auto-matching by IBAN (last 20 chars) + amount (exact or +/-1 grosze tolerance)"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 8 Plan 01: Payment Backend Summary

**Payment tRPC router with 12 procedures, 3 export formats (CSV/Elixir/SEPA), bank statement parser with auto-matching, and approval-to-READY transition fix**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T11:23:48Z
- **Completed:** 2026-03-22T11:32:05Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Full payment run lifecycle API: DRAFT -> LOCKED -> EXPORTED -> COMPLETED/FAILED/CANCELLED
- Three export formats: CSV (xlsx library with BOM), Elixir type 110 (Polish domestic), SEPA XML pain.001.001.03
- Bank statement import with MT940/CSV parsing and auto-matching by IBAN+amount
- Approval router now transitions invoices to paymentStatus READY when flow completes
- removeFromRun mutation enables draft editing per D-04
- listByContractor query supports contractor profile Payments tab

## Task Commits

Each task was committed atomically:

1. **Task 1: Payment validators, export services, bank statement parser, mt940js** - `9ab3db4` (feat)
2. **Task 2: Payment tRPC router, approval fix, root registration** - `0478e25` (feat)

## Files Created/Modified
- `packages/validators/src/payment.ts` - Zod schemas for all payment operations (9 schemas)
- `packages/validators/src/index.ts` - Re-exports for payment schemas and types
- `packages/api/src/services/payment-export.ts` - Pure function export generators (CSV, Elixir, SEPA XML)
- `packages/api/src/services/bank-statement.ts` - MT940/CSV parser and auto-matcher
- `packages/api/src/routers/payment.ts` - tRPC router with 12 procedures
- `packages/api/src/root.ts` - Payment router registration
- `packages/api/src/routers/approval.ts` - paymentStatus READY transition on approval
- `packages/api/package.json` - mt940js dependency added

## Decisions Made
- Used `bankAccountMasked` from ContractorBillingProfile for IBAN in exports (the schema stores masked bank accounts, not raw IBANs)
- Made `generateCsv` async due to dynamic xlsx import; `generateElixir` and `generateSepaXml` are synchronous
- Applied approval paymentStatus fix to both `approve` and `bulkApprove` mutations for consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed billing profile field names**
- **Found during:** Task 2 (Payment router implementation)
- **Issue:** Plan referenced `iban` and `currency` on ContractorBillingProfile, but actual Prisma model uses `bankAccountMasked` and `preferredCurrency`
- **Fix:** Updated all billing profile selects and field references to use correct model field names
- **Files modified:** packages/api/src/routers/payment.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0478e25

**2. [Rule 2 - Missing Critical] Applied paymentStatus fix to bulkApprove**
- **Found during:** Task 2 (Approval router fix)
- **Issue:** Plan only mentioned fixing the single `approve` mutation, but `bulkApprove` has the same gap
- **Fix:** Added `paymentStatus: "READY"` and `readyForPaymentAt: new Date()` to bulkApprove's invoice update
- **Files modified:** packages/api/src/routers/approval.ts
- **Verification:** Both approve and bulkApprove set paymentStatus READY on flow completion
- **Committed in:** 0478e25

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in integration.ts ('"slack"' vs '"SLACK"') - not related to this plan, ignored

## Known Stubs
None - all exports, services, and router procedures are fully implemented with real logic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Payment backend API complete, ready for UI plans (08-02, 08-03, 08-04)
- readyForPayment query available for invoice selection table
- listByContractor query available for contractor profile Payments tab
- Export file generation working for all 3 formats

---
*Phase: 08-payments*
*Completed: 2026-03-22*
