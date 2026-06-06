---
phase: 80-v6-0-verification-hardening-manual-uat
fixed_at: 2026-06-06T00:53:07Z
review_path: .planning/phases/80-v6-0-verification-hardening-manual-uat/80-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 80: Code Review Fix Report

**Fixed at:** 2026-06-06T00:53:07Z
**Source review:** .planning/phases/80-v6-0-verification-hardening-manual-uat/80-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (all Warnings; Info findings IN-01/IN-02/IN-03 are out of scope under `critical_warning`)
- Fixed: 6
- Skipped: 0

Every fix was applied to the single source file `packages/api/src/__tests__/v6-cross-feature-composition.test.ts` and verified by re-running the suite in an isolated worktree (16/16 pass after each change) plus a scoped `tsc --noEmit` confirming no TypeScript errors in the edited file.

## Fixed Issues

### WR-01: F4 gate mock ignores `status` and `organizationId`

**Files modified:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts`
**Commit:** 71cf32d8
**Applied fix:** Extended `makeGateClient.workflowTaskRun.findMany` to honour all four predicates the real `assertRunCompletable` filters on — `taskType`, `workflowRunId`, `organizationId`, and the open-status set (`status.in`). Added `organizationId` and `taskStatus` options to the mock. Threaded `SEEDED.organizationId` into the composed step-4 gate client and added a cross-org isolation control asserting that the same open task queried under `OTHER_ORG_ID` does NOT block (`resolves.toBeUndefined()`). Expanded the predicate describe so a wrong-org query and a closed-status (`DONE`/`CANCELLED`) query both return `[]`, proving each of the four predicates is load-bearing.

### WR-02 + WR-06: `projectedBand` tautology and null-coalescing rate fallbacks

**Files modified:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts`
**Commit:** 8d2bd516
**Applied fix:** Replaced all three `expect(traj).not.toHaveProperty('projectedBand')` tautologies with an exhaustive key-set assertion `expect(Object.keys(traj).sort()).toEqual(TRAJECTORY_KEYS)`, backed by a new module-level `TRAJECTORY_KEYS` constant — so adding ANY new key (including an accidental `projectedBand`) now trips the test. In the same edit regions, the two `expect(traj.projectedRate ?? 1).toBeLessThan(traj.currentRate ?? 0)` comparisons (WR-06) were replaced with explicit `not.toBeNull()` assertions followed by a typed `<` comparison, so a null regression fails loudly instead of being arithmetically absorbed. The two findings were committed together because the WR-06 comparison sites were physically interleaved with the WR-02 key-set sites on the same lines and could not be split cleanly.

### WR-03: Hardcoded source line-number breadcrumbs in comments

**Files modified:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts`
**Commit:** 2546a0a0
**Applied fix:** Replaced every `file.ts:NN-MM` line-range breadcrumb with a symbol reference: the prisma-mock comment now cites the `contractorId.in` + `contractor.is.organizationId` scope in `assertContractorPaymentEligibility`'s findMany where; the enforced-branch comment now states the enforced branch throws without writing audit and only the flag-OFF `recordWouldBlock` path emits a row; the would-block comment now cites `recordWouldBlock` by name. The `workflow-shared.ts:332-340` breadcrumb had already been removed when the WR-01 mock comment was rewritten. Verified no `.ts:NN` patterns remain.

### WR-04: Review-finding IDs and decision breadcrumbs in source comments

**Files modified:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts`
**Commit:** abd5ea67
**Applied fix:** Stripped all opaque IDs while preserving rationale: removed `Phase-74` from the header and the override `it` title (the override mechanism is described behaviorally, not by phase tag); removed `(D-01)` from the F2 header note (kept the why — F2's ACCESS_REVOKE saga runs post-completion, off the blocked path, so it belongs to manual UAT); removed `(WR-02)` from the tenant-isolation comment; removed `(WR-02 + WR-03)` from the predicate describe title. Verified no `WR-0N` / `D-01` / `Phase-74` tokens remain. The traceability lives in commit bodies and the SUMMARY, the correct home per project convention.

### WR-05: Regional reminder mock diverges from real `select` / tenant scope

**Files modified:** `packages/api/src/__tests__/v6-cross-feature-composition.test.ts`
**Commit:** 64707714
**Applied fix:** Added a `tenantOrgId` parameter to `regionClientFactory` and an `organizationId` filter to its `findMany`, scoping the ME regional client to the seeded tenant (`ME_ORG.id`, passed via `getRegionalClient`) so the scan no longer incidentally fans out the band/fire/dispatch pipeline over the OTHER-tenant EXPIRED row. Added a comment documenting that the mock intentionally returns FULL rows rather than the scan's `select` projection (the store rows already carry exactly the fields the scan reads) and that the org scope models the per-tenant RLS isolation the regional client gets in production. Confirmed no Vitest hoisting/TDZ issue with the `ME_ORG.id` reference inside the lazily-invoked `getRegionalClient` mock.

---

_Fixed: 2026-06-06T00:53:07Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
