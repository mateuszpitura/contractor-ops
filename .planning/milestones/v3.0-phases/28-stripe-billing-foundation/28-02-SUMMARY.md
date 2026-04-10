---
phase: 28-stripe-billing-foundation
plan: 02
subsystem: api
tags: [stripe, billing, ocr, credits, metering, prisma]

requires:
  - phase: 28-stripe-billing-foundation/01
    provides: "Billing schema (OcrCreditLedger, Subscription), billing-constants.ts, stripe-client.ts"
provides:
  - "Credit service with atomic deduction, balance checking, top-up allocation"
  - "OCR extraction credit gating (hard-block on exhaustion)"
  - "Stripe Meter event reporting per OCR extraction"
  - "Test scaffolds for BILL-04, BILL-05, BILL-06"
affects: [billing-router, ocr-extraction, subscription-management]

tech-stack:
  added: []
  patterns: ["Serializable transaction for atomic credit deduction", "Fire-and-forget Stripe Meter events", "Discriminated union return types for credit gating"]

key-files:
  created:
    - "packages/api/src/services/credit-service.ts"
    - "packages/api/src/services/__tests__/credit-service.test.ts"
  modified:
    - "packages/api/src/services/ocr-extraction.ts"
    - "packages/api/src/routers/ocr.ts"

key-decisions:
  - "Serializable isolation level for credit deduction prevents race conditions"
  - "Meter event is fire-and-forget (outside transaction) to avoid blocking deduction on Stripe API latency"
  - "Credit check uses usage-based counting (negative entries) rather than net balance to avoid top-up credits masking overconsumption"

patterns-established:
  - "Credit gating pattern: checkAndDeductCredit before async dispatch, return discriminated union"
  - "Stripe Meter fire-and-forget: .catch() with console.error, never blocks business logic"

requirements-completed: [BILL-04, BILL-05, BILL-06]

duration: 3min
completed: 2026-04-01
---

# Phase 28 Plan 02: OCR Credit Metering Summary

**Atomic OCR credit deduction with Serializable isolation, trial-aware allowances (5 credits per D-08), Stripe Meter reporting, and hard-block on credit exhaustion**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T19:18:43Z
- **Completed:** 2026-04-01T19:22:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Credit service with atomic deduction using Prisma Serializable transaction to prevent race conditions
- Trial subscriptions correctly use TRIAL_CREDIT_ALLOWANCE (5) instead of tier-based allowance per D-08
- OCR extraction hard-blocked when credits exhausted -- returns error before QStash dispatch per D-14
- Stripe Meter events fired after each successful deduction for invoice-level usage tracking per D-12
- Both admin and portal OCR trigger endpoints return TRPCError PRECONDITION_FAILED on credit exhaustion

## Task Commits

Each task was committed atomically:

1. **Task 1: Credit service with atomic deduction, trial-aware balance, and Stripe Meter reporting** - `ea62b16` (feat)
2. **Task 2: Integrate credit check into OCR extraction flow** - `5e8fb7f` (feat)

## Files Created/Modified
- `packages/api/src/services/credit-service.ts` - Credit balance, atomic deduction, top-up allocation, Stripe Meter reporting
- `packages/api/src/services/__tests__/credit-service.test.ts` - Test scaffolds for BILL-04/05/06 including D-08 trial scenarios
- `packages/api/src/services/ocr-extraction.ts` - Added credit gating before QStash dispatch
- `packages/api/src/routers/ocr.ts` - Added TRPCError handling for credit exhaustion in trigger and portalTrigger

## Decisions Made
- Serializable isolation level chosen for credit deduction to prevent concurrent requests from overspending
- Meter event fires outside the transaction (fire-and-forget) to avoid blocking on Stripe API latency
- Credit usage counted from negative ledger entries only, not net balance, to correctly separate allowance from top-ups

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Credit metering system complete, ready for Plan 03 (billing tRPC router and Stripe Checkout)
- billing-constants.ts remains single source of truth for all credit allowances
- OCR extraction flow now gated by credits -- all downstream features will respect credit limits

## Self-Check: PASSED

- [x] credit-service.ts exists
- [x] credit-service.test.ts exists
- [x] Commit ea62b16 found
- [x] Commit 5e8fb7f found

---
*Phase: 28-stripe-billing-foundation*
*Completed: 2026-04-01*
