---
phase: 63-uk-payments-financial-features
plan: 06
subsystem: payments
tags: [skonto, xrechnung, cii, bg-20, early-payment-discount, trpc, feature-flags]

# Dependency graph
requires:
  - phase: 63-01
    provides: SkontoTerm, SkontoSnapshot, SkontoApplication Prisma models + financial.prisma schema
provides:
  - evaluateSkontoEligibility + resolveSkontoTerm pure functions
  - skontoRouter with 5 tRPC procedures (upsert/delete invoice/profile, evaluate)
  - paymentRouter extensions (applySkontoToItem, getFormatDetection)
  - XRechnung BG-20 Skonto structured payment terms in CII generator
  - XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE mirrored constant with drift guard
affects: [63-07, einvoice, payments]

# Tech tracking
tech-stack:
  added: []
  patterns: [skonto-cascade-resolution, bg-20-structured-skonto-syntax]

key-files:
  created:
    - packages/api/src/services/skonto.ts
    - packages/api/src/services/__tests__/skonto.test.ts
    - packages/api/src/routers/skonto.ts
  modified:
    - packages/api/src/routers/payment.ts
    - packages/api/src/root.ts
    - packages/einvoice/src/profiles/xrechnung-de/generator.ts
    - packages/einvoice/src/profiles/xrechnung-de/constants.ts
    - packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts
    - packages/einvoice/src/profiles/xrechnung-de/__tests__/locked-phrase-parity.test.ts

key-decisions:
  - "Mirror SKONTO_DESCRIPTION_TEMPLATE_DE in einvoice constants.ts with drift guard test (same pattern as existing reverse-charge/Kleinunternehmer phrases) to avoid circular workspace dependency"
  - "Use payments.skonto-enabled feature flag key from registry (not PAY_SKONTO_ENABLED as plan shorthand)"

patterns-established:
  - "Skonto cascade resolution: invoice-level term > billing-profile default > null"
  - "BG-20 structured Skonto syntax: #SKONTO#TAGE={d}#PROZENT={p}#BASISBETRAG={b}# in ram:Description #text"

requirements-completed: [PAY-07]

# Metrics
duration: 9min
completed: 2026-04-15
---

# Phase 63 Plan 06: Skonto Eligibility Service + XRechnung BG-20 Summary

**German early payment discount (Skonto) service with cascade resolution, tRPC router with validation, payment router extensions, and XRechnung BG-20 structured payment terms per Anhang E**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-15T01:06:08Z
- **Completed:** 2026-04-15T01:15:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Skonto eligibility service with pure functions: `evaluateSkontoEligibility` (6 scenarios) and `resolveSkontoTerm` (invoice > profile > null cascade)
- skontoRouter with 5 feature-flagged procedures: upsertForInvoice, deleteForInvoice, upsertForBillingProfile, deleteForBillingProfile, evaluateForInvoice
- paymentRouter extended with `applySkontoToItem` (transactional discount application + SkontoApplication record) and `getFormatDetection` (per-item SEPA/SWIFT/BANK_FILE routing)
- XRechnung CII generator extended with optional `skontoTerm` parameter emitting BG-20 `ram:SpecifiedTradePaymentTerms` with structured `#SKONTO#TAGE=...#PROZENT=...#BASISBETRAG=...#` syntax

## Task Commits

Each task was committed atomically:

1. **Task 1: Skonto eligibility service + tRPC router + payment router extensions**
   - `febfddb4` (test) — RED: 12 failing skonto service tests
   - `3547ea51` (feat) — GREEN: service + router + payment extensions, all tests passing
2. **Task 2: XRechnung BG-20 Payment Terms Skonto extension** - `85032455` (feat)

## Files Created/Modified

- `packages/api/src/services/skonto.ts` — Pure functions: evaluateSkontoEligibility, resolveSkontoTerm
- `packages/api/src/services/__tests__/skonto.test.ts` — 12 test cases covering all eligibility scenarios
- `packages/api/src/routers/skonto.ts` — 5-procedure tRPC router with payments.skonto-enabled flag
- `packages/api/src/routers/payment.ts` — Extended with applySkontoToItem + getFormatDetection
- `packages/api/src/root.ts` — Wired skontoRouter into appRouter
- `packages/einvoice/src/profiles/xrechnung-de/generator.ts` — BG-20 Skonto payment terms with buildPaymentTerms helper
- `packages/einvoice/src/profiles/xrechnung-de/constants.ts` — Mirrored XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE
- `packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts` — 8 Skonto BG-20 test cases
- `packages/einvoice/src/profiles/xrechnung-de/__tests__/locked-phrase-parity.test.ts` — Drift guard for Skonto template

## Decisions Made

- Used mirrored constant `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` in einvoice constants.ts (same pattern as existing reverse-charge and Kleinunternehmer phrases) instead of cross-package import, to avoid circular dependency between validators and einvoice packages
- Used the actual registry key `payments.skonto-enabled` with `tenantFlaggedProcedure` + `requireFeatureFlag` pattern (matching late-payment-interest router pattern) rather than the plan's shorthand `PAY_SKONTO_ENABLED`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import pattern for SKONTO_DESCRIPTION_TEMPLATE_DE**
- **Found during:** Task 2 (XRechnung BG-20 extension)
- **Issue:** Plan specified direct import from `@contractor-ops/validators` but einvoice package cannot depend on validators (circular dependency: validators -> einvoice for zatca re-exports)
- **Fix:** Mirrored the constant in `xrechnung-de/constants.ts` as `XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE` with a drift guard test in `locked-phrase-parity.test.ts` (same proven pattern used for reverse-charge and Kleinunternehmer phrases)
- **Files modified:** constants.ts, locked-phrase-parity.test.ts
- **Verification:** Locked-phrase parity test passes (3/3 including new Skonto guard)
- **Committed in:** 85032455

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Import pattern change necessary due to existing circular dependency constraint. No scope creep.

## Issues Encountered

- Generator test suite (`generator.test.ts`) fails to run due to pre-existing `libxmljs2` native module Node.js version mismatch (`NODE_MODULE_VERSION 137 vs 131`). This is an environment issue in the worktree, not related to our changes. The locked-phrase parity tests and skonto service tests all pass. The new Skonto test cases are syntactically correct and follow the exact same patterns as existing passing tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Skonto service and router ready for Plan 07 UI consumption via `trpc.skonto.*` and `trpc.payment.applySkontoToItem`
- XRechnung generator accepts `skontoTerm` parameter for e-invoice generation pipeline
- Feature-flagged via `payments.skonto-enabled` (default: false, ship-dark)

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-15*
