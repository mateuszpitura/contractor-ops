---
phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
plan: 03
subsystem: compliance
tags: [trpc, compliance-recovery, approval-flow, payment-gate, int-02, tdd, green-gate]

# Dependency graph
requires:
  - phase: 72
    provides: onComplianceItemSatisfied recovery hook + assertContractorPaymentEligibility (compliance-recovery.ts)
  - phase: 73
    provides: approveUploadReplacement admin mutation (complianceAdmin namespace) + post-tx best-effort dispatchComplianceUploadOutcome
  - phase: 81-01
    provides: RED unit-test surface for the INT-02 compliance-recovery seam (D-12 recovery fires in-tx, D-14 notification-failure isolation)
provides:
  - INT-02 server seam CLOSED — onComplianceItemSatisfied called in-tx in approveUploadReplacement for the approved item, so an approved portal upload releases held PENDING_COMPLIANCE ApprovalFlows and unblocks contractor payment
affects: [81-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-transaction recovery atomicity: recovery hook called inside the caller's $transaction (atomic with the SATISFIED flip); contractor notification stays post-tx best-effort"
    - "Per-item recovery call (mirrors classification.ts:101) — exactly one item flips per approval, NOT the all-BLOCKING supersession loop"

key-files:
  created:
    - .planning/milestones/v6.0-phases/81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces/81-03-SUMMARY.md
  modified:
    - packages/api/src/routers/compliance/compliance-admin.ts

key-decisions:
  - "D-12: per-item recovery call (itemId/contractorId/organizationId) placed after the SATISFIED flip + audit write and before the return, inside the existing $transaction"
  - "D-14: post-tx dispatchComplianceUploadOutcome left UNCHANGED and OUTSIDE the tx — a dispatch failure never rolls back the approval or the in-tx recovery flip"
  - "tx typed via Parameters<typeof onComplianceItemSatisfied>[0] (mirrors classification.ts:92) — no unsafe `as` on external data; structural RecoveryClient cast only"

patterns-established:
  - "Pattern: recovery hook wired into a second caller (admin-approve) matching the classification-reconcile per-item call shape"

requirements-completed: [COMPL-07, COMPL-08, COMPL-11]

# Metrics
duration: 12min
completed: 2026-06-06
---

# Phase 81 Plan 03: INT-02 Compliance Payment-Block Recovery (GREEN) Summary

**`onComplianceItemSatisfied` is now called inside `approveUploadReplacement`'s `$transaction` for the approved item, so an approved portal upload re-asserts contractor eligibility, resumes any held PENDING_COMPLIANCE ApprovalFlow to PENDING, and unblocks the contractor's payment — closing the INT-02 server seam and turning the 81-01 D-12/D-14 RED cases GREEN.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-06T18:42Z
- **Completed:** 2026-06-06T18:54Z
- **Tasks:** 1
- **Files modified:** 1 (compliance-admin.ts)

## Accomplishments
- Imported `onComplianceItemSatisfied` from `../../services/compliance-recovery` (it was NOT imported in this file before).
- Added the in-tx recovery call inside `approveUploadReplacement`'s existing `$transaction`, AFTER the SATISFIED flip (item update) and the `compliance.upload.approved` audit write, and BEFORE `return { item: updated, contractorId: before.contractorId }`.
- Call is per-item only — `{ itemId: input.itemId, contractorId: before.contractorId, organizationId: ctx.organizationId }` — mirroring `classification.ts:101`, NOT the all-BLOCKING supersession loop in `releaseHeldApprovalsForContractor` (D-12 / T-81-03-04).
- `organizationId` is sourced from `ctx.organizationId` (session), never client input (T-81-03-03 IDOR mitigation).
- Left the post-tx best-effort `dispatchComplianceUploadOutcome(...)` UNCHANGED and OUTSIDE the transaction (D-14 / T-73-08-04 / T-81-03-01).
- `tx` cast via `Parameters<typeof onComplianceItemSatisfied>[0]` (the analog's typing at `classification.ts:92`) — satisfies the structural `RecoveryClient` interface without an unsafe cast on external payloads.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire onComplianceItemSatisfied into approveUploadReplacement tx** - `fa148159` (feat)

## Files Created/Modified
- `packages/api/src/routers/compliance/compliance-admin.ts` - Added the `onComplianceItemSatisfied` import (import block) + the in-tx recovery call (after SATISFIED flip + audit, before return). +14 lines; no other lines changed. (biome reordered the new import alphabetically within the existing import group on commit — purely formatting.)

## GREEN Verification
- `pnpm --filter @contractor-ops/api test src/__tests__/compliance-upload-review.test.ts` → **18 passed (18)**. The three 81-01 INT-02 RED cases are now GREEN:
  - D-12 "flips a held PENDING_COMPLIANCE flow to PENDING + clears holds inside the approve tx" — `approvalFlowUpdate` called with `{ where: { id: 'flow-held-1' }, data: { status: 'PENDING' } }`.
  - D-12 "queries held flows by JSONB containment of the approved itemId (recovery in-tx)" — `$queryRaw` (the recovery containment query) called.
  - D-14 "a post-tx notification dispatch failure does NOT roll back the approval or the recovery flip" — approval returns `status: 'SATISFIED'` and the in-tx `approvalFlowUpdate` survives a rejected `dispatchSpy`.
- The 15 pre-existing approve/reject/WR-1 cases remain GREEN (no weakening, no harness change).
- `pnpm typecheck --filter @contractor-ops/api` → clean (14/14 turbo tasks successful).

## Decisions Made
- Placed the recovery call after the audit write (not between the item update and the document update) so the entire SATISFIED-flip + ACTIVE-document + audit unit precedes the eligibility re-assertion — matching the CONTEXT/RESEARCH guidance "after the SATISFIED flip and audit, before the return". The recovery's own `approval.compliance_resolved` audit row (written inside the hook) therefore follows the approve audit row, preserving the existing two-row forensic shape (D-13).
- Used `Parameters<typeof onComplianceItemSatisfied>[0]` rather than importing `RecoveryClient` directly — identical to the working analog (`classification.ts:92`) and keeps the call site self-documenting about which client shape the hook needs.

## Deviations from Plan

None - plan executed exactly as written. The single task's action, placement, per-item shape, and the D-14 post-tx notification invariant were all implemented verbatim.

## Threat Surface
- No new trust boundary, network endpoint, auth path, or schema change. The change adds an in-tx call to an already-RBAC-gated (`compliance:override`) mutation.
- T-81-03-01 (DoS via recovery rollback): mitigated — recovery is in-tx (atomic, intended); the post-tx notification stays best-effort outside the tx.
- T-81-03-02 (SQLi in held-flow query): mitigated — `onComplianceItemSatisfied` uses `$queryRaw` with a bound `${...}::jsonb` parameter (no interpolation); this plan only calls the unchanged hook.
- T-81-03-03 (cross-tenant IDOR): mitigated — `organizationId: ctx.organizationId` from session; the hook scopes its query to that org.
- T-81-03-04 (over-release via all-BLOCKING loop): mitigated — per-item call only; the supersession loop is not used here.

## Known Stubs
None — this is a runtime wiring change, no UI/data stubs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 81-06 (E2E): the INT-02 server seam is now closed; the "portal upload → admin approve → payment unblock" E2E flow can exercise `approveUploadReplacement` end-to-end and assert the held ApprovalFlow resumes to PENDING + the payment gate releases.

## Self-Check: PASSED

- FOUND: packages/api/src/routers/compliance/compliance-admin.ts (modified, `onComplianceItemSatisfied` import + in-tx call both present)
- FOUND: .planning/milestones/v6.0-phases/81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces/81-03-SUMMARY.md
- FOUND: commit fa148159 in git history

---
*Phase: 81-v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces*
*Completed: 2026-06-06*
