---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 01
subsystem: testing
tags: [vitest, trpc, rbac, idp-deprovisioning, compliance-recovery, tdd, red-gate]

# Dependency graph
requires:
  - phase: 76
    provides: DeprovisioningRun/@@unique([organizationId, idempotencyKey]) (76-WR1), startDeprovisioningRun + getDeprovisioningEligibility, idempotency P2002 handler
  - phase: 77
    provides: idp:override_step_failure permission, isProviderSignoffSatisfied, idpDeprovisioningEnabled toggle map, DeprovisioningToggleProvider tuple
  - phase: 72
    provides: onComplianceItemSatisfied recovery hook + assertContractorPaymentEligibility
  - phase: 73
    provides: approveUploadReplacement / rejectUploadReplacement admin mutations (complianceAdmin namespace)
provides:
  - RED unit-test surface for the INT-01 server seam (multi-provider derivation D-05, empty-set throw D-06, idp:start_run gate D-10, per-assignment idempotency D-09)
  - RED contractorId→assignmentId resolver test (most-recent ENDED disambiguation D-01)
  - RED unit-test surface for the INT-02 compliance-recovery seam (D-12 recovery fires in-tx, D-14 notification-failure isolation)
  - Rewritten roles.test.ts idp invariants locking owner+admin+it_admin idp:start_run grant (D-10)
  - Repaired pre-existing harness bug in compliance-upload-review.test.ts (wrong tRPC namespace)
affects: [81-02, 81-03, 81-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RED-first TDD gate: assertion-level failing tests authored before Wave 1 source"
    - "Server-caller harness with hoisted in-memory Prisma store + $transaction passthrough mock"
    - "Order-tolerant permission-array assertions (sort-compare) for RBAC statement equality"

key-files:
  created:
    - packages/api/src/__tests__/contractor-assignment-resolver.test.ts
  modified:
    - packages/api/src/__tests__/deprovisioning-start.test.ts
    - packages/api/src/__tests__/compliance-upload-review.test.ts
    - packages/auth/src/__tests__/roles.test.ts

key-decisions:
  - "RED tests assert the POST-wiring contract; they intentionally fail until 81-02/81-03 land source"
  - "Derivation tests read the provider set off the captured steps.create payload rather than mocking a provider const"
  - "it_admin idp invariant pinned to EXACTLY ['start_run'] (research A1) — override_step_failure stays owner/admin-only"

patterns-established:
  - "Pattern 1: multi-provider derivation verified via the steps.create payload captured on deprovisioningRun.create"
  - "Pattern 2: D-14 isolation verified by rejecting the post-tx dispatch mock and asserting the in-tx recovery flip survives"

requirements-completed: [IDP-01, IDP-05, IDP-06, IDP-09, IDP-10, COMPL-07, COMPL-08, COMPL-11]

# Metrics
duration: 40min
completed: 2026-06-06
---

# Phase 81 Plan 01: Wave 0 RED Gate Summary

**Assertion-level failing unit tests for both v6.0 integration seams (INT-01 IdP-trigger server + INT-02 compliance recovery) plus the rewritten `idp:start_run` RBAC invariants — every behavior 81-02/81-03 implement now has a test asserting it first.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-06-06T18:06Z
- **Completed:** 2026-06-06T18:50Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- INT-01 server RED cases: multi-provider step derivation (D-05, GWS+Slack vs GWS-only), empty-set `PRECONDITION_FAILED` throw carrying `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` (D-06, incl. enabled-but-not-resolver-backed ENTRA), `idp:start_run` FORBIDDEN gate on both `startDeprovisioningRun` and `getDeprovisioningEligibility` (D-10), and a per-assignment idempotency-key existing-run return (D-09).
- New `contractor-assignment-resolver.test.ts`: most-recent ENDED assignment disambiguation + no-ENDED null path (D-01) against the new `deprovisioning.resolveAssignmentForContractor` procedure that 81-02 adds.
- INT-02 recovery RED cases: D-12 (held PENDING_COMPLIANCE flow flips to PENDING + holds cleared in-tx, JSONB-containment held-flow query runs) and D-14 (post-tx notification dispatch failure does not roll back the approval or the recovery flip).
- Rewrote the three `roles.test.ts` idp invariants for the `idp:start_run` grant (owner+admin hold both actions; it_admin holds exactly `start_run`; all other roles hold none; it_admin invoice/contractor exclusion unchanged).

## Task Commits

Each task was committed atomically:

1. **Task 1: INT-01 server RED scaffolds + resolver test** - `9f4038bb` (test)
2. **Task 2: INT-02 recovery RED scaffolds + namespace fix** - `34217f5a` (test)
3. **Task 3: roles.test.ts idp:start_run invariant rewrite** - `cc685051` (test)

## Files Created/Modified
- `packages/api/src/__tests__/deprovisioning-start.test.ts` - Added `organization.findUnique` settingsJson read to the hoisted store; `runCreate` now echoes the asked-for steps; 5 new RED cases for D-05/D-06/D-10/D-09.
- `packages/api/src/__tests__/contractor-assignment-resolver.test.ts` - New file; 2 RED cases for the D-01 contractorId→assignmentId resolver.
- `packages/api/src/__tests__/compliance-upload-review.test.ts` - Added `$queryRaw` + `approvalFlow.update` + `contractorComplianceItem.findMany` to the mock store; 3 new RED cases for D-12/D-14; corrected approve/reject call sites to the `complianceAdmin` namespace.
- `packages/auth/src/__tests__/roles.test.ts` - Rewrote the owner/admin idp equality, added an it_admin EXACTLY-`start_run` invariant, and rewrote the "no other role holds idp" invariant to allow it_admin.

## RED Verification (expected failing — Wave 1 source not yet written)
- `pnpm --filter @contractor-ops/api test deprovisioning-start` → 5 new fail (assertion-level), 7 pass.
- `pnpm --filter @contractor-ops/api test contractor-assignment-resolver` → 2 fail (TRPCError: procedure not found — the resolver lands in 81-02).
- `pnpm --filter @contractor-ops/api test compliance-upload-review` → 3 new fail (assertion-level: `approvalFlow.update`/`$queryRaw` never called — recovery wires in 81-03), 15 pass.
- `pnpm --filter @contractor-ops/auth test roles` → 3 new fail (assertion-level: start_run grant lands in 81-02), 16 pass.

## 76-WR1 Idempotency Index (RESEARCH open question A5)
- **Schema source of truth:** PRESENT. `packages/db/prisma/schema/idp-deprovisioning.prisma:25` declares `@@unique([organizationId, idempotencyKey])` on `DeprovisioningRun` (per-org dedup, WR-1).
- **Live DB-level confirmation:** NOT executed. The only configured `DATABASE_URL` in this tree points at a remote Neon EU instance; the sandbox classifier (correctly) blocked the read-only `pg_indexes` query against it as a production read with credential exposure. No local-only Postgres connection string is available in this environment, and applying migrations was out of scope (git-safety / no approval).
- **Setup note for 81-06 (E2E P2002 case):** before the E2E idempotency test relies on the unique index, confirm `prisma db push` (or the migration) has been applied to the target DB so `DeprovisioningRun_organizationId_idempotencyKey` exists at the DB level. The schema guarantees Prisma will create it on the next push; this is the only residual setup dependency for the P2002 path (mitigates T-81-01-01).

## Decisions Made
- Verified the multi-provider derivation by reading the `provider` values off the `steps.create` payload captured on `deprovisioningRun.create`, rather than mocking a provider constant — keeps the test resilient to the exact derivation implementation 81-02 chooses (it must derive from the resolver-backed set ∩ enabled ∩ signoff).
- For D-14, asserted the recovery flip (`approvalFlow.update`) survives a rejected post-tx dispatch mock, which simultaneously proves the approval committed (item SATISFIED) and that the best-effort notification is genuinely outside the transaction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected the tRPC namespace in compliance-upload-review.test.ts**
- **Found during:** Task 2 (INT-02 recovery scaffolds)
- **Issue:** Every case in the existing file called `caller.classification.approveUploadReplacement` / `...rejectUploadReplacement`, but those procedures live in `complianceAdminRouter`, mounted at the always-on `complianceAdmin` namespace (root.ts:202) — `classificationRouter` does not contain them. Result: all 13 pre-existing cases failed at the harness level with `TRPCError: No procedure found on path "classification,approveUploadReplacement"`, which would have masked the new D-12/D-14 RED cases behind a harness error (violating the plan's "assertion-level, not harness/compile error" acceptance criterion).
- **Fix:** Replaced the 18 `caller.classification.{approve,reject}UploadReplacement` call sites with `caller.complianceAdmin.{...}`.
- **Files modified:** packages/api/src/__tests__/compliance-upload-review.test.ts
- **Verification:** After the fix, the 15 pre-existing cases PASS (they exercise real shipped behavior) and only the 3 new D-12/D-14 cases RED at assertion level.
- **Committed in:** `34217f5a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** The namespace fix was required for the Task 2 RED gate to be assertion-level as the plan mandates; it also repaired pre-existing test debt the milestone audit owed. No scope creep — no source/runtime files were touched.

## Issues Encountered
- The sandbox blocked the remote Neon DB index query (production-read + credential-exposure guard). Resolved by recording the schema-level guarantee and deferring live DB confirmation to the 81-06 E2E setup, exactly as the plan's Task 3 instructions allow ("if absent, document … do NOT apply migrations without approval").
- lint-staged biome flagged an unused `heldFlows` destructure on the first Task 2 commit; removed it (the value is used only inside the hoisted factory closure) and re-committed cleanly.

## Threat Flags
None — this plan created/edited test files only; no new runtime trust boundary, network endpoint, auth path, or schema change was introduced.

## Known Stubs
None — these are RED test scaffolds, not UI/data stubs. The "missing" behaviors (resolver procedure, multi-provider derivation, idp:start_run grant, recovery wiring) are the intended Wave 1 deliverables that 81-02/81-03 turn GREEN.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 81-02 (INT-01 source): turn the deprovisioning-start + resolver + roles RED cases GREEN — dynamic `PROVIDERS_FOR_RUN` derivation, org `settingsJson` read, `idp:start_run` gate on both procedures + the new `resolveAssignmentForContractor` procedure, and the `permissions.ts`/`roles.ts` start_run grant (owner+admin+it_admin).
- 81-03 (INT-02 source): turn the compliance-upload-review RED cases GREEN — call `onComplianceItemSatisfied` inside the `approveUploadReplacement` transaction after the SATISFIED flip, keeping the post-tx notification best-effort.
- 81-06 (E2E): confirm the 76-WR1 unique index is applied at the DB level before the P2002 idempotency E2E case relies on it (see "76-WR1 Idempotency Index" above).

## Self-Check: PASSED

All four test files and the SUMMARY exist on disk; all four commits (`9f4038bb`, `34217f5a`, `cc685051`, `b4544240`) are present in git history.

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
