# Phase 65: Phase 63 Critical Bug Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 65-phase-63-critical-bug-fixes
**Areas discussed:** Scope boundary, Test/regression strategy, Commit atomicity, Re-verification gate

---

## Pre-discussion State Verification

Before opening discussion, the current state of the 4 ROADMAP success criteria was probed against `v2`:

| Bug | Source criterion | Current state | Evidence |
|---|---|---|---|
| 1 | Late-interest flag key (`payments.late-interest-enabled`) on all 6 procedures | ✅ ALREADY FIXED | `late-payment-interest.ts:49,178,283,343,388,567` all use canonical key (commit `929b0e1d`) |
| 2 | `skonto.ts` line 287 uses `invoice.amountToPayMinor` | ⚠️ PARTIALLY — line 280 uses `invoice.totalMinor` | `grep amountToPayMinor packages/api/src/routers/skonto.ts` returns nothing |
| 3 | `'admin:boe-rate'` registered in `accessControlStatement` | ✅ ALREADY FIXED | `packages/auth/src/permissions.ts:32` |
| 4 | `daysOverdue` from `overdueStartMs` (not `dueDateMs`) | ❌ STILL BROKEN | `late-payment-interest.ts:213` uses `dueDateMs` |

Plus `63-VERIFICATION.md` flagged adjacent bugs (TRPCError code `FAILED_PRECONDITION` → `PRECONDITION_FAILED`, schema relation names `billingProfile`/`skontoTerm` plural mismatch, Prisma narrowing at lines 78/226/435) that the user was asked whether to include.

---

## Scope boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Strict (4 named bugs only) | Touch only the lines named in the success criteria; adjacent bugs become Phase 68 follow-up. | |
| Strict + compile blockers | Fix the 4 named bugs PLUS any adjacent bug that prevents `pnpm typecheck` from passing on those 3 files (excludes Prisma narrowing investigation). | |
| Comprehensive (everything in 63-VERIFICATION.md) | Close all gaps_remaining + new_findings: 4 named bugs + TRPCError codes + relation names + Prisma narrowing. | ✓ |
| Decide after re-verify | Re-run /gsd-verify-work first to get current truth before planning. | |

**User's choice:** Comprehensive (everything in 63-VERIFICATION.md)
**Notes:** Implies bug inventory B-01 through B-07 in CONTEXT.md `<decisions>`. CONTEXT.md D-04 still mandates a re-validate pass at planning time so already-fixed items get dropped from the plan.

---

## Test/regression strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Add focused regression tests per fix | One test → one bug, lives next to the code under test. | ✓ |
| Update existing tests + tsc gate | Update existing assertions to canonical fields; rely on `pnpm typecheck` for type-safety fixes. | |
| tsc + manual verification only | No new tests; rely on typecheck + manual smoke test. | |

**User's choice:** Add focused regression tests per fix
**Notes:** Existing skonto/late-interest tests passed against broken code because they mocked the bad field names. Regression tests in Phase 65 must use a real (or pg-mem) Prisma client so schema drift is caught at test time. The mocked-broken-shape pattern is itself bugged and gets cleaned up per D-07.

---

## Commit atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| One commit per fix (atomic) | `fix(65-NN): <summary>` per bug — easy bisect/revert, matches Phase 63 convention. | ✓ |
| One commit per remaining fix only | Skip commits for the 2 already-fixed bugs since they're done. | |
| Single batched Phase 65 commit | One `fix(65): close v5.0 audit gaps` commit. | |

**User's choice:** One commit per fix (atomic)
**Notes:** Plans mirror commits — one PLAN.md per fix (D-09). Plans for already-fixed bugs are dropped during the validation pass at planning time (D-04).

---

## Re-verification gate

| Option | Description | Selected |
|--------|-------------|----------|
| Re-run /gsd-verify-work for Phase 63 | Update `63-VERIFICATION.md` from `gaps_found` → `verified`. Phase 65 done when 63 fully verified. | |
| tsc + tests + visual diff | `pnpm typecheck` clean + tests green + visual diff matches success criteria text. | |
| Both: tsc gate during execute, then re-verify | Use tsc + tests as the per-plan gate; run /gsd-verify-work as the final Phase 65 step. | ✓ |

**User's choice:** Both — tsc gate during execute, then re-verify
**Notes:** Per-plan gate enforces correctness at landing time (D-11). Final re-verify of Phase 63 (NOT Phase 65) closes `63-VERIFICATION.md` from `gaps_found` → `verified` (D-12). Phase 65 itself gets its own short `65-VERIFICATION.md` confirming all bug-IDs resolved (D-13).

---

## Claude's Discretion

- Test file naming when a regression case doesn't fit existing test files
- How to spike on B-07 (Prisma narrowing root cause)
- Whether `pnpm typecheck` runs at the package level or via `turbo typecheck` in CI gate

## Deferred Ideas

- Generic tenant-scope adapter helper (only if B-07 reveals a repo-wide pattern)
- Repo-wide test-mock anti-pattern audit (mocked-Prisma-with-broken-fields hiding real bugs)
- Test infra standardization across `packages/api` (real-Prisma harness vs mocks)
- Phase 67 verification work (Phase 56 + 58) — explicitly out of scope
