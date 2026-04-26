---
phase: 65-phase-63-critical-bug-fixes
plan: 01
subsystem: payments
tags: [skonto, prisma, vitest, withholding, reverse-charge-vat, regression-test]

requires:
  - phase: 63-uk-payments-financial-features
    provides: skonto router scaffold (evaluateForInvoice procedure) and the canonical payment.applySkontoToItem reference for the buyer-side basis
provides:
  - Skonto basis is now consistent across the evaluate→apply boundary (skonto.evaluateForInvoice + payment.applySkontoToItem both read invoice.amountToPayMinor)
  - B-01 / CR-02 from 63-VERIFICATION.md is closed
  - Locking regression test that fails deterministically if the field is reverted (uses a fixture where totalMinor != amountToPayMinor)
affects: [phase-65-02 (independent — late-payment-interest), future Skonto refactors, billing reconciliation work]

tech-stack:
  added: []
  patterns:
    - vi.mock chain extension to bypass pre-existing test-infra ENOTDIR on the validators/zatca subpath import (mocks services/stripe-client.js + services/billing-service.js to short-circuit the tier middleware load chain)

key-files:
  created: []
  modified:
    - packages/api/src/routers/skonto.ts
    - packages/api/src/routers/__tests__/skonto.test.ts

key-decisions:
  - "Skonto basis on the eligibility query MUST equal invoice.amountToPayMinor (the buyer-side payable amount) — never invoice.totalMinor — to match payment.applySkontoToItem and stay consistent across the evaluate→apply boundary. Inline comment installed at the call site to prevent future regression."
  - "The pre-existing working-tree change in packages/validators/src/zatca.ts (uncommitted, not Phase 65's responsibility) switched to a subpath import that the api-package vitest alias for @contractor-ops/einvoice cannot resolve — full-suite ENOTDIR. Worked around in this plan's own test file by adding minimal vi.mock entries for services/stripe-client.js and services/billing-service.js, since modifying validators/zatca.ts or vitest.config.ts is outside Phase 65's file lane (per the orchestrator's strict file-lane rule). Production code untouched by the workaround."
  - "Test-infra mocks added inside the plan's allowed file scope (routers/__tests__/skonto.test.ts) — this is on-lane test-file modification, not an out-of-lane infra fix."

patterns-established:
  - "Schema-divergence regression tests should use fixtures that EXPOSE the bug surface (here, totalMinor != amountToPayMinor) and assert both the positive (called with correct field) and negative (NOT called with broken field) cases."
  - "When the test-loader fails on a pre-existing transitive import that's outside the plan's file lane, prefer extending the plan-test's own vi.mock list to short-circuit the chain rather than touching the broken upstream."

requirements-completed:
  - PAY-07

duration: 35min
completed: 2026-04-26
---

# Phase 65 · Plan 01: use amountToPayMinor as Skonto basis Summary

**Skonto eligibility query now reads invoice.amountToPayMinor (matching payment.applySkontoToItem) so reverse-charge VAT and supplier-withholding invoices produce a consistent basis across evaluate→apply.**

## Performance

- **Duration:** ~35 min (including test-infra triage and workaround)
- **Started:** 2026-04-26T02:36Z
- **Completed:** 2026-04-26T02:46Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Swapped `invoice.totalMinor` → `invoice.amountToPayMinor` at `packages/api/src/routers/skonto.ts:285` (the `evaluateForInvoice` query)
- Added a "B-01 regression" test that exercises a withholding fixture where the two fields diverge (`totalMinor=120_000`, `amountToPayMinor=100_000`) and asserts the basis equals `amountToPayMinor` (and explicitly NOT `totalMinor`)
- Extended the shared `mockInvoiceWithTerm` / `mockInvoiceNoTerm` fixtures to include `amountToPayMinor` so the surrounding tests keep loading the canonical schema shape
- Worked around a pre-existing test-infra ENOTDIR (validators/zatca subpath) by adding `vi.mock` entries for `services/stripe-client.js` and `services/billing-service.js` inside the plan's own test file
- All 24 tests in skonto.test.ts pass (was 23, +1 for the B-01 regression case); typecheck clean

## Task Commits

1. **Task 1+2+3 atomic commit:** `599d2534` — fix(65-01): use amountToPayMinor as Skonto basis in skonto.evaluateForInvoice

Per CONTEXT.md D-08/D-09/D-10, Tasks 1, 2, 3 are bundled into a single atomic commit so the fix and its locking regression test ship together.

## Files Created/Modified

- `packages/api/src/routers/skonto.ts` — line 285: source field swapped (`totalMinor` → `amountToPayMinor`); inline comment installed naming the consistency rationale (mirrors payment.applySkontoToItem) so future readers do not regress it
- `packages/api/src/routers/__tests__/skonto.test.ts` — added `amountToPayMinor` to default fixtures; added B-01 regression test; added `vi.mock` for `services/stripe-client.js` + `services/billing-service.js` to bypass the pre-existing zatca-subpath ENOTDIR in the test loader

## Decisions Made

- **Use `amountToPayMinor` as the canonical Skonto basis.** Matches `payment.applySkontoToItem` and the buyer-side payable semantics. Documented inline at the call site. (Per CONTEXT.md D-03 / B-01.)
- **Stay strictly in file lane.** A pre-existing uncommitted working-tree change in `packages/validators/src/zatca.ts` (re-routed to a subpath the api-package vitest alias can't resolve) broke the test loader. Per the orchestrator's strict file-lane rule, I did NOT modify validators/zatca.ts or vitest.config.ts — instead added test-file-scoped mocks to bypass the broken transitive load chain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Pre-existing test-infra ENOTDIR blocked vitest loader**
- **Found during:** Task 2 (running skonto.test.ts to verify the new regression test passes)
- **Issue:** Test loader fails with `ENOTDIR ... einvoice/src/index.ts/zatca/schemas` because of an uncommitted working-tree change in `packages/validators/src/zatca.ts` (out-of-lane, not Phase 65's responsibility) combined with the api-package vitest alias mapping `@contractor-ops/einvoice` → `einvoice/src/index.ts` (file). Affects all api package tests that load any router (transitively pulls tier middleware → billing-service → stripe-client → validators).
- **Fix:** Added two `vi.mock` entries inside `packages/api/src/routers/__tests__/skonto.test.ts` (this plan's own test file, fully on-lane): mock `services/stripe-client.js` and `services/billing-service.js` to short-circuit the chain. No production code or out-of-lane file touched.
- **Files modified:** `packages/api/src/routers/__tests__/skonto.test.ts` (already in plan scope)
- **Verification:** `npx vitest run src/routers/__tests__/skonto.test.ts` → 24/24 green
- **Committed in:** `599d2534` (part of Task 3 atomic commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — pre-existing test-infra issue worked around in-lane)
**Impact on plan:** Workaround necessary to satisfy CONTEXT.md D-11 ("new regression test passes"). Fully in-lane. No scope creep. The underlying validators/zatca + vitest alias mismatch is left for whichever phase OWNS those files (Phase 66 background planner is touching validators/contractor.ts but not zatca.ts; this is likely a leftover from Phase 64 — recorded here for downstream awareness).

## Issues Encountered

- **Pre-existing test-infra ENOTDIR.** Documented above and worked around in-lane. Recorded as a separate concern for the file-owning phase to address.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- B-01 closed; consistency invariant locked by regression test.
- Ready for Plan 65-02 (independent: touches `services/late-payment-interest.ts` + its service test, no overlap with this plan's files).
- Per CONTEXT.md D-12: after Plan 65-02 lands, run `/gsd-verify-work 63` to flip 63-VERIFICATION.md from `gaps_found` → `verified` for B-01 and B-05 closures.

---
*Phase: 65-phase-63-critical-bug-fixes*
*Completed: 2026-04-26*
