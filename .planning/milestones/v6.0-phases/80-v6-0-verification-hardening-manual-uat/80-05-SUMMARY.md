---
phase: 80-v6-0-verification-hardening-manual-uat
plan: 05
subsystem: testing
tags: [vitest, trpc, compliance-payment-gate, saudization, workflow-offboarding, multi-tenant, gulf]

# Dependency graph
requires:
  - phase: 80-v6-0-verification-hardening-manual-uat
    provides: "v6-cross-feature-composition.test.ts (the isolated F1/F3/F4 describes + gulf-fixtures factories from plan 80-01)"
provides:
  - "SC#1 composition proof: a single composed-scenario test threading F1 (compliance payment hard-block) + F3 (Saudization advisory) + F4 (IP_VERIFICATION offboarding hard-block) through ONE seeded contractor's shared mutable mock-Prisma store"
  - "Load-bearing tenant-isolation: payment-gate prisma mock now honours where.contractorId.in + where.contractor.is.organizationId (WR-02); makeGateClient.workflowTaskRun.findMany honours where.taskType=IP_VERIFICATION + where.workflowRunId (WR-03)"
  - "Honest enforced-vs-audit split: enforced branch asserted to write no audit row; separate flag-OFF would-block assertion captures the compliance.payment.would_block row pinned to exactly CONTRACTOR_ID"
affects: [v6.0 milestone-close re-verification, 80-VERIFICATION.md SC#1]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One composed-scenario it body threading multiple real services through ONE shared mutable mock-Prisma store (no beforeEach reset mid-flow), with a second synthetic tenant making where-filter predicates load-bearing"

key-files:
  created: []
  modified:
    - packages/api/src/__tests__/v6-cross-feature-composition.test.ts

key-decisions:
  - "Mock predicates mirror the exact real where shapes (compliance-payment-gate.ts:86-99, workflow-shared.ts:332-340) so a second-tenant row is excluded, not silently leaked"
  - "Resolved the enforced-vs-audit tension honestly per the real service: enforced throw writes no audit row; the documented audit-emitting path is the flag-OFF would-block branch (compliance-payment-gate.ts:106-120) — never asserted hard-block AND audit on the same call"
  - "F2 IdP deprovisioning deliberately NOT composed (D-01) — its ACCESS_REVOKE saga runs post-offboarding-completion, off the blocked path"

patterns-established:
  - "Composed cross-feature integration test: seed one coherent SEEDED context (contractorId, organizationId, workflowRunId, headcount) so each gate derives its inputs from the same state rather than disconnected literals"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-06-06
---

# Phase 80 Plan 05: SC#1 Cross-Feature Composition Test Hardening Summary

**A single composed-scenario test now threads F1 (payment hard-block) + F3 (Saudization advisory) + F4 (IP_VERIFICATION offboarding hard-block) through ONE seeded contractor's shared mock-Prisma store, with the payment-gate and IP-block mocks made load-bearing via a second synthetic tenant.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-06T01:23:00Z
- **Completed:** 2026-06-06T01:31:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 1 (test file) + 1 deferred-items log

## Test Result (SC#1 verification input)

**PASS** — `pnpm --filter @contractor-ops/api exec vitest run src/__tests__/v6-cross-feature-composition.test.ts` → **16 tests passed (16)**, 1 file passed.

(Up from the 11-test baseline: +3 mock-predicate tests in Task 1, +2 composed-scenario tests in Task 2.)

API package typecheck (`tsc --noEmit` inside `packages/api`): **exit 0, zero errors.**

## Accomplishments

- **SC#1 composed scenario:** a new `describe('SC#1 — F1+F3+F4 compose on ONE seeded contractor (single shared store)')` whose primary `it` runs, in sequence on one shared mutable store with no mid-flow reset: `runComplianceReminderScan` flips the free-zone item PENDING→EXPIRED → `assertContractorPaymentEligibility` throws PRECONDITION_FAILED (enforced) → `projectOffboardingTrajectory` returns the advisory from the SAME seeded headcount → `assertRunCompletable` throws PRECONDITION_FAILED on the open IP_VERIFICATION task.
- **WR-02 fix:** the `@contractor-ops/db` `prisma.contractorComplianceItem.findMany` mock now honours `where.contractorId.in` and `where.contractor.is.organizationId`, mirroring the real gate query — so a second-tenant EXPIRED BLOCKING row is excluded and `cause.contractorReasons` is pinned to exactly CONTRACTOR_ID.
- **WR-03 fix:** `makeGateClient.workflowTaskRun.findMany` now honours `where.taskType === 'IP_VERIFICATION'` and `where.workflowRunId`, mirroring `workflow-shared.ts:332-340` — so the `blockedTaskKind` assertion is load-bearing (a non-IP task or mismatched run is filtered out).
- **Honest enforced-vs-audit split:** the enforced branch is asserted to write NO audit row (`expect(auditWriteSpy).not.toHaveBeenCalled()`); a separate flag-OFF would-block assertion captures the `compliance.payment.would_block` row and pins `metadata.contractorReasons` via `toHaveLength(1)` to exactly CONTRACTOR_ID, with an inline comment citing `compliance-payment-gate.ts:106-120`.
- **No coverage regression:** the F3 advisory shape (`advisory:true`/`authoritative:false`/no `projectedBand`), the Phase-74 override-clears-block path, and the Gulf locked-phrase invariant (`LOCKED_AE/SA_PHRASES`) all remain asserted.
- **F2 excluded (D-01):** no IdP/ACCESS_REVOKE composition added; the only `ACCESS_REVOKE`/`idp` mentions are the header comment explaining the exclusion.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make the prisma + gate-client mocks honour their where predicates and seed a second org/contractor (WR-02 + WR-03)** - `ca8f7faa` (test)
2. **Task 2: Add the single composed-scenario describe threading F1→F3→F4 + the honest enforced-vs-audit split** - `19742eeb` (feat)

_Both tasks carried `tdd="true"`. They were executed as a single coherent module edit per task (mock fix + new behavior tests in Task 1; composed scenario + would-block split in Task 2), verified failing-then-green against the scoped vitest run rather than as separate test/feat commits, because the change is test-only against already-shipped services._

## Files Created/Modified

- `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` - added OTHER_ORG_ID/OTHER_CONTRACTOR_ID constants, `recordFreeZoneItemFor` helper, the WR-02 prisma-mock predicate fix, the WR-03 gate-client predicate fix, three mock-predicate tests, and the composed SC#1 describe (composed `it` + would-block `it`). Now 654 lines (min_lines:120 satisfied).
- `.planning/phases/80-v6-0-verification-hardening-manual-uat/deferred-items.md` - logged one out-of-scope upstream typecheck failure (see Issues).

## Decisions Made

- Mock `where` predicates were written to mirror the exact real query shapes so the second-tenant row is genuinely excluded, turning previously false-green isolation assertions into real ones.
- Kept the test-only TDD cycle as one verified-green edit per task (no separate RED commit) since both tasks edit a single test module against already-tested production services; the failing-then-passing transition was verified via the scoped vitest run between edits.

## Deviations from Plan

None - plan executed exactly as written. The mock fixes, second-tenant seeding, composed scenario, enforced-vs-audit split, and preserved assertions all match the plan's behavior/action specs.

## Issues Encountered

- **Worktree had no installed dependencies.** This fresh worktree shipped without `node_modules`, so vitest/tsc could not run. Resolved by symlinking the worktree's git-ignored `node_modules` (root + every `packages/*`) to the main checkout's installed trees (identical base commit `55a97fe7`, shared pnpm content-addressed store). Symlinks are gitignored and never staged. No `pnpm install` was run (respects the 7-day release-age supply-chain constraint).
- **Out-of-scope upstream typecheck failure.** `pnpm typecheck --filter=@contractor-ops/api` fails while building the upstream `@contractor-ops/secrets` package (`cached-store.ts:35` — `TS1294` under `erasableSyntaxOnly`, pre-existing on base commit, enabled repo-wide in `d31087cd`). Unrelated to this plan; logged in `deferred-items.md`. The api package's own `tsc --noEmit` passes with zero errors, which is the in-scope typecheck signal.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC#1 is met: the cross-feature integration test proves F1+F3+F4 compose on one shared store with load-bearing tenant isolation and an honest audit assertion. Ready for v6.0 milestone-close re-verification of 80-VERIFICATION.md SC#1.
- No blockers from this plan. The upstream `@contractor-ops/secrets` `erasableSyntaxOnly` build error is a separate, pre-existing repo-wide concern.

## Self-Check: PASSED

- FOUND: `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` (modified)
- FOUND: `.planning/.../80-05-SUMMARY.md`
- FOUND: `.planning/.../deferred-items.md`
- FOUND commit: `ca8f7faa` (Task 1, test)
- FOUND commit: `19742eeb` (Task 2, feat)
- Scoped test: 16 passed (16); api `tsc --noEmit`: exit 0

---
*Phase: 80-v6-0-verification-hardening-manual-uat*
*Completed: 2026-06-06*
