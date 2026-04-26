---
phase: 65-phase-63-critical-bug-fixes
plan: 02
subsystem: payments
tags: [late-payment-interest, lpcda, vitest, off-by-one, regression-test, boundary-test]

requires:
  - phase: 63-uk-payments-financial-features
    provides: late-payment-interest service scaffold (calculateLateInterest pure function), the overdueStartMs helper computed at line 196 (was already correct, just unused), and the existing 30-test fixture suite that enshrined the off-by-one
provides:
  - daysOverdue is now computed from overdueStartMs with inclusive-elapsed semantics, matching LPCDA Section 4(1)
  - Widened guard (endDateMs < overdueStartMs) prevents negative-day windows
  - 3 existing test expectations realigned (30→29 days, 60→59 days) with inline LPCDA-correct (B-05) comments preserving the audit trail
  - 3 downstream accruedInterestMinor / totalClaimMinor expectations recomputed and realigned to keep the file green
  - 2 new boundary regression tests (asOf == overdueStartMs → 0 days; asOf == overdueStartMs + 24h → 1 day) lock the corrected semantics
  - B-05 from 63-VERIFICATION.md is closed
affects: [LPCDA claim PDF generation (already consumes service result transparently), late-interest dashboard tile, future LPCDA refactors, Phase 63 re-verify (D-12)]

tech-stack:
  added: []
  patterns:
    - Realign-don't-delete pattern for tests that enshrined a bug (per CONTEXT.md D-07): rename the it() block to reflect the corrected semantics, update the expected value, add an inline `LPCDA-correct (B-05)` comment naming the source decision — preserves the audit trail showing what the bug was and when it was fixed.
    - Boundary regression test pattern: when fixing an off-by-one, lock both edges with two tests — one at the lower boundary (= 0) and one at the next discrete step (= 1) — so the formula cannot drift by a sign or constant in either direction.

key-files:
  created: []
  modified:
    - packages/api/src/services/late-payment-interest.ts
    - packages/api/src/services/__tests__/late-payment-interest.test.ts

key-decisions:
  - "daysOverdue MUST be computed as `floor((endDateMs - overdueStartMs) / day)` — NOT `floor((endDateMs - dueDateMs) / day)` and NOT `floor(...) + 1`. The pre-fix formula counted the dueDate itself as the first overdue day (LPCDA forbids this); a `+1` formula would count the partial-day endDateMs as a full day (over-claims by one). Inline LPCDA Section 4(1) comment installed at the call site."
  - "Guard widened from `endDateMs <= dueDateMs` to `endDateMs < overdueStartMs`. Strict subset of the pre-fix range, so all previously-guarded cases still short-circuit; additionally covers any `dueDate < endDate < overdueStart` window so the post-guard formula can never return negative."
  - "Three downstream test expectations (partial payments, COMPENSATION waiver, revoked waiver) had hardcoded accruedInterestMinor / totalClaimMinor values derived from the broken 30-day count. Re-derived from first principles using the corrected 29-day count: 4_829 → 4_668 (500_000 principal), 2_897 → 2_801 (300_000 principal), 11_829 → 11_668 (4_668 + 7_000 compensation). Per CONTEXT.md D-07 / Plan 65-02 Note 3, production correctness drives test expectations — never the reverse."
  - "Per CONTEXT.md D-07, no it() block was deleted. Each realignment carries the same test name (or a refined version naming the new day count) plus an inline `LPCDA-correct (B-05)` comment so the audit trail is visible in `git log -p` and `git blame`."

patterns-established:
  - "When a test asserts a value that turns out to be wrong (the test passed against broken code), realign — never delete. The test names + inline 'LPCDA-correct' comments document what the bug was and that it has been fixed."
  - "Off-by-one fixes in time-based formulas should ship two boundary tests: one at the post-fix lower boundary (returns 0) and one at the next discrete step (returns 1). Single-point fixtures (e.g., 'a 30-day-overdue invoice') do not catch sign or constant drift."

requirements-completed:
  - PAY-06

duration: 25min
completed: 2026-04-26
---

# Phase 65 · Plan 02: compute daysOverdue from overdueStartMs Summary

**LPCDA Section 4(1)-correct daysOverdue formula: counts full days elapsed since overdueStartMs (the day after due date) instead of misusing dueDateMs and overstating every claim by one day; guard widened to prevent negative windows; tests realigned with audit trail; boundary regressions added.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-26T02:46Z
- **Completed:** 2026-04-26T02:55Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Service formula at `packages/api/src/services/late-payment-interest.ts:227` switched from `(endDateMs - dueDateMs)` to `(endDateMs - overdueStartMs)`; LPCDA Section 4(1) comment + B-05 reference installed
- Guard at line 206 widened from `endDateMs <= dueDateMs` to `endDateMs < overdueStartMs` to prevent any negative-day window in the post-guard formula
- Three existing daysOverdue assertions realigned (30→29 days, 60→59 days, 30→29 paidAt) with inline `LPCDA-correct (B-05)` comments
- Three downstream accruedInterestMinor / totalClaimMinor assertions recomputed and realigned (4_829→4_668; 2_897→2_801; 11_829→11_668)
- Two new B-05 boundary regression tests added to lock the corrected lower edge (0 days) and the first-day edge (1 day)
- All 32 tests in `services/__tests__/late-payment-interest.test.ts` pass (was 30, +2 boundary)
- Typecheck clean; no production code touched outside the service file

## Task Commits

1. **Task 1+2+3 atomic commit:** `d5428ccf` — fix(65-02): compute daysOverdue from overdueStartMs for LPCDA correctness

Per CONTEXT.md D-08/D-09/D-10, Tasks 1, 2, 3 bundled into a single atomic commit so the formula fix, the widened guard, the realigned existing tests, and the new boundary regression tests ship together.

## Files Created/Modified

- `packages/api/src/services/late-payment-interest.ts` — formula at line 227 + guard at line 206 with inline LPCDA Section 4(1) / B-05 commentary forbidding revert
- `packages/api/src/services/__tests__/late-payment-interest.test.ts` — 3 daysOverdue realignments + 3 downstream value realignments + 2 new boundary regression tests, all carrying `LPCDA-correct (B-05)` inline comments for audit trail

## Decisions Made

- **No `+1` in the formula.** Discussed in plan body and re-derived in the executor. `floor((endDateMs - overdueStartMs) / day)` correctly returns 0 when no full overdue day has elapsed (asOf == overdueStartMs) and 1 after the first full day. Adding `+1` would over-count partial days as full days.
- **Widen the guard, don't shrink it.** `endDateMs < overdueStartMs` is a strict superset of `endDateMs <= dueDateMs` (since `overdueStartMs == dueDateMs + 24h`), so all previously-short-circuited cases still short-circuit. Additionally protects against any future `@db.DateTime` column where `dueDateMs < endDateMs < overdueStartMs` is possible.
- **Realign downstream expectations from first principles, not by trial.** Recomputed `dailyInterest * daysOverdue` for each affected fixture (300_000 principal, 500_000 principal) using the corrected day count and updated comments to show the derivation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Specificity gap] Plan listed 3 daysOverdue realignments; downstream tests had 3 more assertions enshrining the broken value**
- **Found during:** Task 2 (running the full test file after the planned 3 realignments)
- **Issue:** The plan's Note 2 instructed "If any unrealigned test still asserts an off-by-one value (search the file for `daysOverdue).toBe(`), update it." The plan only enumerated 3 daysOverdue assertions but did not enumerate the 3 downstream `accruedInterestMinor` / `totalClaimMinor` assertions in the partial-payments and waivers describe blocks that were derived from the broken 30-day count.
- **Fix:** Recomputed each affected expectation from first principles using the corrected 29-day count (per Plan Note 3) and updated:
    * partial-payment `accruedInterestMinor`: 2_897 → 2_801
    * COMPENSATION-waiver `accruedInterestMinor` + `totalClaimMinor`: 4_829 → 4_668
    * revoked-waiver `accruedInterestMinor`: 4_829 → 4_668; `totalClaimMinor`: 11_829 → 11_668
  Each carries an inline `LPCDA-correct (B-05)` comment showing the derivation.
- **Files modified:** `packages/api/src/services/__tests__/late-payment-interest.test.ts` (already in plan scope)
- **Verification:** `npx vitest run src/services/__tests__/late-payment-interest.test.ts` → 32/32 green
- **Committed in:** `d5428ccf` (part of Task 3 atomic commit)

---

**Total deviations:** 1 auto-fixed (1 specificity gap — plan understated downstream test impact; auto-fix was on-lane and consistent with planner's Note 3)
**Impact on plan:** No scope creep. Necessary to satisfy CONTEXT.md D-11 ("existing tests not regressed"). All-in-lane.

## Issues Encountered

- **Pre-existing test-infra ENOTDIR (validators/zatca subpath).** Same pre-existing issue documented in 65-01-SUMMARY.md. Affects only `routers/__tests__/late-payment-interest.test.ts` (the router-level test that imports through the validators chain), NOT `services/__tests__/late-payment-interest.test.ts` (the service-level test). The router test file does NOT enshrine any of the realigned daysOverdue values — it tests router-layer concerns (Prisma narrowing, feature-flag gating) that are unchanged by Plan 65-02. No regression introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- B-05 closed; formula and boundary semantics locked by 2 new regression tests + 6 realigned assertions
- Ready for the post-execution verification step per CONTEXT.md D-12: run `/gsd-verify-work 63` to flip `63-VERIFICATION.md` from `gaps_found` → `verified` for B-01 + B-05 closures
- Then per CONTEXT.md D-13: write `65-VERIFICATION.md` confirming B-01 + B-05 resolved AND Phase 63 re-verify succeeded

---
*Phase: 65-phase-63-critical-bug-fixes*
*Completed: 2026-04-26*
