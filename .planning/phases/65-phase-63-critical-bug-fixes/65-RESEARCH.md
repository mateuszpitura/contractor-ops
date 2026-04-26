# Phase 65: Phase 63 Critical Bug Fixes - Research

**Researched:** 2026-04-26
**Mode:** D-04 re-validation (CONTEXT.md mandate)

<summary>
## What I learned

Phase 65 was scoped against a 7-bug inventory (B-01 .. B-07) drawn from `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md`. CONTEXT.md decision **D-04** mandates a re-validation pass at planning time (run `tsc --noEmit` against `packages/api`) and dropping any bug already resolved by intervening commits on the v2 branch.

Re-validation result: **5 of 7 bugs already resolved** by commits `415794cb` (skonto schema relations), `929b0e1d` (late-interest router type errors), and `ece79f07` (Decimal import path). Phase 65 reduces to **2 surviving fixes**.

</summary>

<revalidation>
## D-04 Re-validation (executed 2026-04-26)

```
$ cd packages/api && npx tsc --noEmit
EXIT: 0
```

**Zero TypeScript errors** in `@contractor-ops/api`. Per-bug status against canonical schema and current code:

| Bug | Description | Status | Evidence |
|-----|-------------|--------|----------|
| **B-01** | `skonto.ts:280` uses `invoice.totalMinor`; ROADMAP success criterion #2 demands `invoice.amountToPayMinor` | **OPEN** | Line 280 still reads `invoiceTotalMinor: invoice.totalMinor`. Inconsistent with `payment.ts:1431` (Skonto-apply call site) which uses `invoice.amountToPayMinor`. Same invoice → two different Skonto bases across procedures. |
| **B-02** | `skonto.ts:244` uses singular `billingProfile` include | **CLOSED** | Line 233 reads `billingProfiles: { where: { isDefault: true }, ... take: 1 }`. Canonical relation in `contractor.prisma:58` is `billingProfiles ContractorBillingProfile[]` (array). Resolved by commit `415794cb`. |
| **B-03** | `skonto.ts` references `invoice.skontoTerm` (singular) | **CLOSED** | Line 240/258 read `skontoTerms: true` / `invoice.skontoTerms[0]`. Canonical relation in `invoice.prisma:68` is `skontoTerms SkontoTerm[]`. Resolved by commit `415794cb`. |
| **B-04** | `skonto.ts` references `invoice.contractor` not in include | **CLOSED** | Lines 231-238 include `contractor: { include: { billingProfiles: ... } }`. Resolved by commit `415794cb`. |
| **B-05** | `services/late-payment-interest.ts:213` uses `dueDateMs` instead of `overdueStartMs` for `daysOverdue` | **OPEN** | Line 213 still reads `Math.floor((endDateMs - dueDateMs) / day)`. Per LPCDA, interest accrues from the day after due date. The helper `overdueStartMs` is computed at line 196 (`dueDateMs + 24 * 60 * 60 * 1000`) but unused on line 213. Existing test at `late-payment-interest.test.ts:225` expects `daysOverdue=30` with the broken formula — that test enshrines the off-by-one and must be corrected to `29`. |
| **B-06** | TRPCError `'FAILED_PRECONDITION'` (invalid in tRPC v11) | **CLOSED** | Lines 462, 469 read `code: 'PRECONDITION_FAILED'`. Resolved by commit `929b0e1d`. |
| **B-07** | Prisma client narrowing failure on `boEBaseRateHistory` | **CLOSED** | Lines 75-76, 222-223, 433-434 use `ctx.db as unknown as Pick<PrismaClient, 'boEBaseRateHistory'>` cast (same WR-04 pattern used in `bacs.ts`). Resolved by commit `929b0e1d`. |

**Cross-check against `63-VERIFICATION.md`:** That report (re-verified 2026-04-26T00:15:00Z, third pass) declares `gaps_remaining: []` and 16/16 truths verified. It explicitly classifies `invoice.totalMinor` at line 280 as the *correct* Skonto basis. That contradicts ROADMAP.md success criterion #2. CONTEXT.md decision **D-01** ("comprehensive scope from 63-VERIFICATION.md gaps_remaining + new_findings") combined with ROADMAP success criterion authority resolves toward fixing B-01 — and the inconsistency with `payment.ts:1431` is the deciding factor (same domain concept must use the same basis).

**B-05 is NOT in the verifier's 16-truth list** — it's a behavioural bug (claim-letter wrongness by 1 day) that the schema-typecheck cannot catch. The inline source comment at line 194 ("interest starts the day after due date") asserts the correct intent; the implementation at line 213 contradicts the comment.

</revalidation>

<final_scope>
## Final Phase 65 scope

After D-04 re-validation, two plans:

1. **`65-01-PLAN.md` — fix(65-01): align skonto eligibility router with canonical Skonto basis (B-01)**
   - Change `skonto.ts:280` from `invoice.totalMinor` → `invoice.amountToPayMinor`.
   - Add a regression test at `routers/__tests__/skonto.test.ts` that exercises an invoice where `totalMinor != amountToPayMinor` (e.g., reverse-charge + withholding case) and asserts the Skonto basis passed to `evaluateSkontoEligibility` matches `amountToPayMinor`. Must use a real Prisma client (or in-memory equivalent) — NOT a mock that hides the bug (per CONTEXT.md D-06).
   - Per CONTEXT.md D-08, single atomic commit `fix(65-01): use amountToPayMinor as Skonto basis in skonto.evaluateForInvoice`.

2. **`65-02-PLAN.md` — fix(65-02): correct daysOverdue computation in calculateLateInterest (B-05)**
   - Change `services/late-payment-interest.ts:213` from `Math.floor((endDateMs - dueDateMs) / day)` → `Math.floor((endDateMs - overdueStartMs) / day) + 1`. The `+ 1` accounts for inclusive day-counting from `overdueStartMs` (overdueStartMs itself is day 1).
   - Update existing tests at `services/__tests__/late-payment-interest.test.ts` lines 225, 237, 406 (currently encode the off-by-one) to assert the corrected values: `daysOverdue=29` instead of `30`, etc. Document the change in the test description so it cannot be silently regressed.
   - Per CONTEXT.md D-07, the existing tests "passed against broken code" — must be re-anchored to canonical behaviour, not deleted-and-rewritten.
   - Per CONTEXT.md D-08, single atomic commit `fix(65-02): compute daysOverdue from overdueStartMs for LPCDA correctness`.

**Bugs explicitly dropped from plan (per D-04):**

- B-02, B-03, B-04 (commit `415794cb`)
- B-06, B-07 (commit `929b0e1d`)
- Decimal import (commit `ece79f07`) — was not in original B-01..B-07 inventory but was a contributing TS2307; included here for completeness.

**Phase exit gate (per CONTEXT.md D-12, D-13):**

After both fix plans land, the orchestrator must:

1. Re-run `/gsd-verify-work 63` (re-verify Phase 63) to flip `63-VERIFICATION.md` from `gaps_found` → `verified` for the new B-01 + B-05 closures. The verifier already shows `gaps_remaining: []`; this re-run captures the additional fixes and updates the audit trail.
2. Generate `65-VERIFICATION.md` confirming B-01 and B-05 are resolved AND the Phase 63 re-verify succeeded.

This is the phase's exit gate — D-13.

</final_scope>

<implementation_notes>
## Implementation notes

### B-01 — Skonto basis field

- **Why `amountToPayMinor` not `totalMinor`:** `payment.ts:1431` (Skonto application call site) already uses `amountToPayMinor`. For an invoice with reverse-charge VAT or supplier withholding, `amountToPayMinor != totalMinor`. The Skonto discount must apply against the amount the buyer is actually paying, not the gross invoice total — otherwise the discount calculation overstates the eligible discount.
- **Schema confirmation:** `Invoice.amountToPayMinor` is a non-nullable `Int` in `invoice.prisma:25`. Always present; no nullability handling needed at the call site.
- **Verifier disagreement is non-blocking:** The verifier's claim that `totalMinor` is correct contradicts both ROADMAP success criterion #2 and the `payment.ts` precedent. Phase 65 enforces consistency with `payment.ts` (the more critical surface — money actually moves there).

### B-05 — daysOverdue inclusive count

- **LPCDA Section 4(1) intent:** Interest is owed for each day the debt remains unpaid past the statutory due date. The phrase "starts the day after due date" (per the source comment at line 194) means day 1 = `overdueStartMs`. If invoice is due Feb 13 and remains unpaid as of Feb 14 EOD, the buyer owes 1 day of interest.
- **Formula derivation:**
  - Current (broken): `floor((endDateMs - dueDateMs) / day)` — counts elapsed-days from due-date including a phantom day-0.
  - Corrected: `floor((endDateMs - overdueStartMs) / day) + 1` — counts elapsed-days from overdue-start (day-after-due) inclusively. The `+ 1` because if endDateMs == overdueStartMs (Feb 14 00:00:00 UTC), the 14th itself is day 1 of the overdue period.
- **Edge case at line 199** (`if (endDateMs <= dueDateMs)`): unchanged — the early-return covers same-day-due case correctly. The fix only affects the post-`if` branch where `endDateMs > dueDateMs`.
- **Test impact:** Three test expectations change:
  - Line 225: `30` → `29` (Feb 13 due, Mar 15 asOf)
  - Line 237: `60` → `59` (Feb 13 due, Apr 14 asOf)
  - Line 406: `30` → `29` (Feb 13 due, Mar 15 paidAt)
- **Downstream impact on `accruedInterestMinor`:** Test line 231 (`expect 4_829`) and line 240 (`expect 4828`-ish) recompute. Recompute and update.
- **No router-side changes:** The router consumes the service result; the off-by-one propagates transparently. No router test touches `daysOverdue` arithmetic.

### Commit & verification gates

- Per CONTEXT.md D-10: each commit must include the regression test that locks the corrected behaviour AND `pnpm --filter @contractor-ops/api typecheck` (= `pnpm --filter @contractor-ops/api build` per `package.json` — there is no separate typecheck script; `tsc --noEmit` is the equivalent local check) must pass.
- Per CONTEXT.md D-11: each plan completes only when (a) typecheck passes on the changed file, (b) the new regression test passes, (c) existing tests in the affected file still pass after their expected-value updates (B-05 only).

</implementation_notes>

<canonical_refs_consulted>
## Canonical references read for this research

- `.planning/phases/63-uk-payments-financial-features/63-VERIFICATION.md` — re-verified 2026-04-26T00:15:00Z, gaps_remaining: []
- `.planning/ROADMAP.md` §"Phase 65" — 4 success criteria
- `.planning/phases/65-phase-63-critical-bug-fixes/65-CONTEXT.md` — locked decisions D-01..D-13
- `packages/api/src/routers/skonto.ts` — current state (line 280: totalMinor)
- `packages/api/src/routers/payment.ts:1431` — Skonto-apply call site (uses amountToPayMinor)
- `packages/api/src/services/late-payment-interest.ts` — current state (line 213: dueDateMs)
- `packages/api/src/services/__tests__/late-payment-interest.test.ts` — test expectations at lines 193, 208, 225, 237, 406
- `packages/db/prisma/schema/invoice.prisma:21,25,68` — totalMinor, amountToPayMinor, skontoTerms relation
- `packages/db/prisma/schema/contractor.prisma:58,146` — billingProfiles, skontoTerms relations
- Recent commits `415794cb`, `929b0e1d`, `ece79f07` (intervening v2-branch fixes that closed B-02..B-04 + B-06..B-07)

</canonical_refs_consulted>

## RESEARCH COMPLETE
