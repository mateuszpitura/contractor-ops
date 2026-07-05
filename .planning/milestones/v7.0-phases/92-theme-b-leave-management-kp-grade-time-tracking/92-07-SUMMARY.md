# 92-07 SUMMARY — leave-balance engine + approval-chain LEAVE_REQUEST seams + resourceType-aware RBAC

**Status:** complete (backend); the RBAC contract executes via api typecheck + the invoice-path regression suite. The `leave-approval-rbac` Wave-0 test stays a HOLD scaffold (needs a role-session integration harness — flagged).
**Plan:** 92-07 (wave 3)

## What shipped

**Leave-balance service** (`services/leave-balance.ts`):
- `computeLeaveBalance(rows)` = Σ signed ledger minutes (pure).
- `resolveEntitlementMinutes({jurisdiction, leaveKind, tenureYears, etat})` =
  `round_up(baseEntitlementDays × etat) × 480`; a null/undefined etat is treated
  as full-time (1.00) with a logged warning, never throws; returns 0 for an
  unregistered market.
- `recomputeBalanceCache` (the Σ-ledger reconciliation oracle), `accrueAnnual`,
  `applyCarryover` (capped per `carryoverPolicy.maxDays`) — all upsert the cache
  in the caller's tx.

**Approval-chain LEAVE_REQUEST extension** — the generic Flow/Step/Decision
engine is branched at exactly the two invoice-coupled seams, never forked:
- `approval-engine.ts`: `createApprovalFlow` resourceType widened to
  `'INVOICE' | 'LEAVE_REQUEST'`; new `routeToLeaveChain` (OQ3: a single default
  LEAVE_REQUEST chain per org for v7.0 — duration/type-conditioned routing is out
  of scope).
- `approval-shared.ts`: `finalizeApprovedLeave` (set APPROVED, insert DEDUCTION,
  recompute cache, writeAuditLog `leave.approved`, all in the caller's tx) +
  `assertApprovalActionPermission(ctx, resourceType)` (the fine-grained body gate).
- `approval-queue.ts`: both `advanceResult.completed` sites (single approve +
  bulkApprove) and both reject sites (single reject + bulkReject) branch on
  `resourceType === 'LEAVE_REQUEST'`; the invoice path is behaviourally unchanged.

**resourceType-aware RBAC gate** (the fix that lets the P89 HR roles approve
leave WITHOUT gaining invoice:approve):
- `rbac.ts`: new `hasPermission(ctx, permission)` predicate (both auth modes) +
  `requireAnyPermission(...permissions)` coarse OR-set middleware. `requirePermission`
  left byte-unchanged.
- The six shared approval procedures (approve/reject/delegate/requestClarification/
  bulkApprove/bulkReject) now gate on
  `requireAnyPermission({invoice:['approve']}, {employee:['approve_leave']})` plus a
  per-request `assertApprovalActionPermission(ctx, step.approvalFlow.resourceType)`
  body assertion. delegate + requestClarification now `include: { approvalFlow: true }`.
  Net: an invoice approver admits INVOICE only; a leave_approver admits
  LEAVE_REQUEST only — no over-grant either direction.

**Consequential fixes surfaced by the Plan-06 client regen / enum extension:**
- `audit-writer.ts` `AuditEntityType` += `LEAVE_REQUEST`, `EMPLOYEE_TIME_RECORD`
  (the merged 92-03 EntityType extension had no matching AuditEntityType members;
  the regenerated client made `EntityType` no longer assignable until added).
- `gdpr.ts` `RETENTION_CITATIONS` += a `KP-ewidencja` citation (RETENTION_YEARS now
  carries that key).
- `approval.test.ts` delegate/requestClarification step mocks now carry
  `approvalFlow` (those procedures fetch it now).

## WARNING-3 (recorded)

The single-`approve` intermediate next-approver notify branch resolves the resource
via `tx.invoice.findUnique`, which returns null for a LEAVE_REQUEST — inert under
the v7.0 single-step default leave chain (no intermediate step), NOT a live bug. A
future multi-step leave chain must resolve the resource via a flow-level lookup. A
WHY comment marks the site.

## Verification

- `pnpm --filter @contractor-ops/api typecheck` — clean.
- `pnpm --filter @contractor-ops/api test leave-balance leave-time-cross-org-leak`
  GREEN (leave-balance 6, cross-org 16).
- `pnpm --filter @contractor-ops/api test approval` — 91 passed, 6 skipped (the
  leave HOLD scaffolds); invoice approve/reject/delegate/bulk path unchanged.
- `leave-approval-rbac` remains a HOLD scaffold: the resourceType gate is proven by
  typecheck + the invoice regression suite; a role-session + seeded-flow integration
  harness to execute the three RBAC directions GREEN is the remaining follow-up.
