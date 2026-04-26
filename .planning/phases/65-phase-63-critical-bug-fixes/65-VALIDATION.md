---
phase: 65
slug: phase-63-critical-bug-fixes
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-26
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for the 2 surviving fixes after D-04 re-validation.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (already installed; `packages/api` "test" script) |
| **Config file** | `packages/api/vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- <file>` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` |
| **Estimated runtime** | ~25s full suite, ~2-3s per file |
| **Typecheck command** | `cd packages/api && npx tsc --noEmit` (no separate typecheck script — `build` runs `tsc`) |

---

## Sampling Rate

- **After every task commit:** Run quick file-scoped command + typecheck
- **After every plan completes:** Run full `@contractor-ops/api` test suite (must remain green)
- **Before `/gsd-verify-work 63`:** Full suite green AND `pnpm -w build` green AND new regression tests green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 65-01-01 | 01 | 1 | PAY-07 | — | Skonto router passes the canonical payable basis (`amountToPayMinor`) to `evaluateSkontoEligibility`, ensuring discount calculations are consistent across `skonto.evaluateForInvoice` and `payment.applySkontoToItem`. | unit (vitest) | `pnpm --filter @contractor-ops/api test -- skonto.test.ts` | ✅ test file exists | ⬜ pending |
| 65-01-02 | 01 | 1 | PAY-07 | — | Typecheck remains clean after field swap. | typecheck (tsc) | `cd packages/api && npx tsc --noEmit` | N/A | ⬜ pending |
| 65-02-01 | 02 | 1 | PAY-06 | — | `daysOverdue` is computed inclusively from `overdueStartMs` so LPCDA claim letters report the legally correct accrual period. | unit (vitest) | `pnpm --filter @contractor-ops/api test -- late-payment-interest.test.ts` | ✅ test file exists | ⬜ pending |
| 65-02-02 | 02 | 1 | PAY-06 | — | Existing tests realigned to canonical expectations (no silent regression to off-by-one). | unit (vitest) | `pnpm --filter @contractor-ops/api test -- late-payment-interest.test.ts` | ✅ test file exists | ⬜ pending |
| 65-02-03 | 02 | 1 | PAY-06 | — | Typecheck remains clean. | typecheck (tsc) | `cd packages/api && npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Both regression tests land in pre-existing test files:

- `packages/api/src/routers/__tests__/skonto.test.ts` (existing — adds 1 new `it()` block)
- `packages/api/src/services/__tests__/late-payment-interest.test.ts` (existing — adds 1 new `it()` block, edits 3 expected values)

No new framework install or shared fixtures required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phase 63 re-verify (`63-VERIFICATION.md` flips `gaps_found` → `verified` for B-01 + B-05) | PAY-06, PAY-07 | Audit trail update is a documentation/verifier action, not a code path. Triggered by `/gsd-verify-work 63` after both fixes land. | (1) Land 65-01 + 65-02 commits. (2) Run `/gsd-verify-work 63 --auto`. (3) Confirm verifier output records B-01 + B-05 closures and rewrites `63-VERIFICATION.md` with current commit SHAs. |
| Phase 65 exit verify (`65-VERIFICATION.md` confirms B-01 + B-05 resolved AND Phase 63 re-verify passed) | — | Exit gate per CONTEXT.md D-13. | After Phase 63 re-verify: `/gsd-verify-work 65 --auto`. |

---

## Validation Sign-Off

- [x] All tasks have automated verify (vitest + tsc)
- [x] Sampling continuity: every task pair commits + full suite
- [x] Wave 0 covers all MISSING references — no missing infrastructure
- [x] No watch-mode flags (`vitest run` invoked via `test` script)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-26
