---
phase: 96-theme-b-employee-self-service-portal
plan: 08
subsystem: web-vite
tags: [portal, employee-portal, manager, ui, web-vite, approvals]
requirements: [EMP-PORTAL-03, EMP-PORTAL-04]
dependency_graph:
  requires:
    - phase: 96-06
      provides: "portalManager namespace (getTeamOverview, listReportLeaveRequests, approveReportLeaveRequest, rejectReportLeaveRequest)"
    - phase: 96-07
      provides: "the employee portal surface + shared section shell + isModuleDarkError"
  provides:
    - "/portal/employee/team/* routes: manager overview + leave approvals (approve/reject)"
    - "manager section hooks (sole tRPC boundary) + wired sections + views"
  affects:
    - "96-09 (nav wiring + full i18n parity)"
tech_stack:
  patterns:
    - "permission-loaded surface: a non-manager caller gets FORBIDDEN from portalManagerProcedure (>=1 report), mapped to isForbidden -> a forbidden state, never a crash"
    - "approve/reject post portalManager mutations; every list is server-scoped to direct reports (report ids never client-supplied); the row's reportWorkerId is re-validated server-side"
    - "reject captures an optional reason in a confirm Dialog (DialogBody/DialogFooter); approve is a direct action"
key_files:
  created:
    - "apps/web-vite/src/components/portal/employee/team/hooks/use-manager-overview.ts"
    - "apps/web-vite/src/components/portal/employee/team/hooks/use-manager-approvals.ts"
    - "apps/web-vite/src/components/portal/employee/team/manager-overview.tsx"
    - "apps/web-vite/src/components/portal/employee/team/manager-approvals.tsx"
    - "apps/web-vite/src/pages/portal/employee/team/index.tsx"
    - "apps/web-vite/src/pages/portal/employee/team/approvals.tsx"
  modified:
    - "apps/web-vite/src/router/portal-routes.tsx"
    - "apps/web-vite/messages/en.json"
decisions:
  - "Documents-expiry surface (use-manager-documents / manager-documents / team/documents route) NOT built: the 96-06 backend has no listReportDocumentExpiry (there is no employee document-expiry model in v7.0) and no report time-approval (EmployeeTimeRecord carries no approval status). Building UI against non-existent procedures would be a typecheck error / dead UI. The overview + leave-approvals surfaces (the backed, tested EMP-PORTAL-03 functionality) are complete."
  - "Approvals render as an accessible semantic list of ApprovalRow components (each with useCallback-stable handlers), not the workbench DataTable: DataTable is heavy for a short pending-approvals set and its server-pagination ergonomics add no value here. No raw shadcn <Table> is used. The confirm Dialog follows the body/footer convention."
  - "isForbidden is derived from the same isModuleDarkError helper as the employee surface (FORBIDDEN/METHOD_NOT_FOUND/UNAUTHORIZED) — a non-manager or dark org renders the forbidden state."
requirements_completed: []
completed: 2026-07-05
---

# Phase 96 Plan 08: Manager team dashboard UI

**Built the `/portal/employee/team/*` manager surface on the existing portal shell — a team overview and a leave-approvals surface (approve/reject with a reason-capturing confirm dialog) — consuming the 96-06 `portalManager` backend, permission-loaded so a non-manager gets a forbidden state, never a crash.**

## Accomplishments

- **Hooks (only `usePortalTRPC` callers under `team/`)** — `use-manager-overview` (getTeamOverview → reports + `isForbidden`/`isEmpty`/`isManager`), `use-manager-approvals` (listReportLeaveRequests + getTeamOverview for report names + approve/reject mutations with toasts + invalidation).
- **Wired sections + views** — `ManagerOverview` (per-report summary grid with pending-leave counts) and `ManagerApprovals` (a semantic list of `ApprovalRow`s with approve/reject; a `RejectDialog` captures an optional reason via DialogBody/DialogFooter). Every section branches loading / forbidden / error / empty / success.
- **Team home + routes** — `/portal/employee/team` composes the overview + approvals with `AnimateIn`; `/portal/employee/team/approvals` is the standalone approvals page. Both are thin Suspense composers inside the authenticated `PortalShell`.
- **i18n** — English source keys under `Portal.employee.team.*` (overview + approvals + reject dialog).

## Verification

- `pnpm check:web-vite-data-layer` + `check:web-vite-page-shells` + `check:web-vite-presentational` + `check:web-vite-dialog-pattern` — all OK.
- `pnpm typecheck --filter=@contractor-ops/web-vite` — 19/19 GREEN (run with `NODE_OPTIONS=--max-old-space-size=8192`).
- `pnpm exec biome check` on the team files — 0 errors (1 nursery `noJsxPropsBind` warning on a controlled-textarea onChange, non-blocking).
- `pnpm i18n:parity` — RED on the new en-only keys; parity is 96-09.

## Notes / deviations

- **Documents-expiry + time-approval surfaces omitted** (no backend — see decision). The manager surface delivers the overview + leave approve/reject, which is the backed EMP-PORTAL-03 scope.
- **Semantic list over DataTable** for the short approvals set (see decision); fully accessible, no raw shadcn `<Table>`.
- **Nav visibility** (show `/team` only to managers) is finalized with the rest of the portal nav in 96-09; today the routes exist and a non-manager who navigates directly gets the forbidden state.
