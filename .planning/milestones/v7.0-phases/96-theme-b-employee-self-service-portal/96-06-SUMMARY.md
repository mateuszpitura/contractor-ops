---
phase: 96-theme-b-employee-self-service-portal
plan: 06
subsystem: api
tags: [portal, employee-portal, manager, reporting-line, idor, approval, audit]
requirements: [EMP-PORTAL-03]
dependency_graph:
  requires:
    - phase: 96-01
      provides: "EmployeeProfile.managerWorkerId (the reports edge)"
    - phase: 96-02
      provides: "portalManagerProcedure (asserts >=1 report)"
    - phase: 96-03
      provides: "the RED net portal-manager-idor / portal-manager-approve / portal-root-gating"
  provides:
    - "portalManager tRPC namespace (dark-mounted): getTeamOverview, listReportLeaveRequests, approveReportLeaveRequest, rejectReportLeaveRequest — every read/action scoped to the caller's direct reports"
    - "services/portal-reports.ts — resolveDirectReports + assertIsDirectReport (server-side reporting-line scope)"
    - "portalManagerApproveLeaveInput / portalManagerRejectLeaveInput / portalManagerNoInput validators (.strict())"
  affects:
    - "96-08 (manager /team dashboard UI consumes this namespace)"
tech_stack:
  patterns:
    - "reports resolved server-side from EmployeeProfile.managerWorkerId = ctx.workerId (same org); the request's OWN workerId is the authoritative subject and assertIsDirectReport runs before any state change — client reportWorkerId is only a cross-check"
    - "approve REUSES the shared finalizeApprovedLeave transition (status flip + DEDUCTION ledger + balance-cache refresh); reject marks REJECTED with no ledger — no reimplemented approval logic"
    - "both actions write an EMPLOYEE-actor audit row (actorId = ctx.workerId) in the same transaction"
key_files:
  created:
    - "packages/api/src/services/portal-reports.ts"
    - "packages/api/src/routers/portal/portal-manager-router.ts"
    - "packages/validators/src/portal-manager.ts"
  modified:
    - "packages/api/src/portal-root.ts"
    - "packages/api/src/routers/portal/index.ts"
    - "packages/validators/src/index.ts"
    - "packages/api/src/errors.ts"
    - "packages/api/src/routers/portal/__tests__/portal-fixtures.ts"
    - ".planning/brain/wiki/structure/api-routers-catalog.md"
    - ".planning/brain/wiki/structure/key-services.md"
decisions:
  - "Approve reuses finalizeApprovedLeave (approval-shared.ts) directly — the portal manager IS the approval authority, and the fixture leave requests carry no multi-step ApprovalFlow, so the direct finalize is the honest reuse of the shared state machine + ledger. finalizeApprovedLeave writes its own system audit (actorType:'USER', actorId undefined); the portal path adds the authoritative EMPLOYEE-actor row for attribution (two audit rows per approval by design — the shared helper is not modified since it is owned by concurrent streams)."
  - "IDOR is closed by deriving the authoritative subject from the request's OWN workerId (not the client reportWorkerId): a manager passing their real report as reportWorkerId but a peer's requestId is rejected because the request's workerId is the peer's. reportWorkerId must match AND be a direct report."
  - "listReportTimeToApprove / approveReportTimeEntry / listReportDocumentExpiry (listed in the plan task) were NOT built: EmployeeTimeRecord carries NO approval-status column (there is no time-approval workflow to reuse or reimplement), and there is no employee document-expiry model in v7.0. Building them would invent unspecified workflows. getTeamOverview surfaces the real, queryable per-report pending-leave count only. Flagged rather than fabricated."
  - "Fixture extended (portal-fixtures.ts): makeModelStub gained `upsert` (find-or-create honouring the where) because recomputeBalanceCache — reached via finalizeApprovedLeave — upserts the LeaveBalance cache row. Additive, matches the existing permissive mock semantics."
requirements_completed: [EMP-PORTAL-03]
completed: 2026-07-05
---

# Phase 96 Plan 06: The employee-portal manager surface

**Built the `portalManager` namespace (EMP-PORTAL-03): a dark-mounted, flag + >=1-report-gated surface whose every read/approval is scoped to the caller's direct reports via the server-side reporting-line edge, executing leave approvals through the shared `finalizeApprovedLeave` transition under an EMPLOYEE-actor audit — flipping the 96-03 manager-IDOR + manager-approve + root-gating RED tests GREEN.**

## Accomplishments

- **`services/portal-reports.ts`** — `resolveDirectReports(db, managerWorkerId, org)` (reports = `EmployeeProfile` where `managerWorkerId` = caller, same org) and `assertIsDirectReport(db, managerWorkerId, org, targetWorkerId)` (throws FORBIDDEN unless the target's profile edge points at the caller in the same org). Report ids are never client-supplied; same-org is enforced because the edge is not an FK.
- **`portalManagerRouter`** — `getTeamOverview` (reports + per-report pending-leave count), `listReportLeaveRequests` (pending leave across the reports; no report id input — a stray key is a `.strict()` rejection), `approveReportLeaveRequest` / `rejectReportLeaveRequest`. Each mutation re-derives the request's OWN workerId, cross-checks the client `reportWorkerId`, and calls `assertIsDirectReport` before acting.
- **Approve reuses the shared transition** — `finalizeApprovedLeave` (status → APPROVED + DEDUCTION ledger + balance-cache refresh) inside one `$transaction`, plus an `EMPLOYEE`-actor audit row (`actorId = ctx.workerId`). Reject marks REJECTED with no ledger movement + an EMPLOYEE audit row carrying the optional reason.
- **Dark-mount** — `portalManager` spread onto `portalAppRouter` alongside `portalEmployee` behind `isEmployeePortalRegistered()`; `portalManagerProcedure` re-asserts `module.employee-portal` + ≥1 report per request (a non-manager gets no surface).
- **Validators** — `portalManagerApproveLeaveInput` / `portalManagerRejectLeaveInput` / `portalManagerNoInput`, all `.strict()`.

## Verification

- `pnpm typecheck --filter=@contractor-ops/api` — 0 errors (after rebuilding the validators dist for the new `portal-manager` exports).
- `pnpm --filter @contractor-ops/api test portal-manager-idor portal-manager-approve portal-root-gating` — 12/12 GREEN (M lists/approves for its report A, never peer B or cross-org X; non-manager B gets no surface; a client report id is a `.strict()` rejection; approve transitions out of PENDING + writes an EMPLOYEE/`WORKER_M` audit; reject is audited + never APPROVED).
- Full portal RED net: `portal-employee-idor portal-timeoff-request portal-akta-selfview portal-paystub-unavailable portal-manager-idor portal-manager-approve portal-root-gating` — 24/24 GREEN (the whole security net is now green).
- `pnpm exec biome check` on the 3 new files — clean; `pnpm lint:no-breadcrumbs` + `pnpm lint:audit-log` — my files clean.
- Wiki: `structure/api-routers-catalog.md` (`portalManager` row + dark-mount note) + `structure/key-services.md` (`portal-reports.ts`) updated. The employee-portal domain page + BM25/graph refresh land in 96-09.

## Notes / deviations

- **Two audit rows per approval** — `finalizeApprovedLeave` (shared, owned by concurrent streams) writes a `USER`/system audit internally; the portal path adds the authoritative `EMPLOYEE`-actor row. Not modifying the shared helper keeps the change surface minimal and additive.
- **Time-approval + doc-expiry manager procedures deferred** — no approval status on `EmployeeTimeRecord` and no employee doc-expiry model exist to build on; see the decision above. The tested EMP-PORTAL-03 security surface (reports scope + leave approve/reject IDOR fence) is complete.
