---
phase: 92-theme-b-leave-management-kp-grade-time-tracking
plan: 12
type: execute
status: complete
requirements: [LEAVE-02, LEAVE-01]
---

# Plan 92-12 Summary — Leave queue + balance + sick entry + i18n foundation

## What shipped

- **All Phase-92 i18n namespaces** (`Leave`, `EmployeeTime`, `Ewidencja`) added at full key parity across `en`/`de`/`pl`/`ar`, plus thin `en-US` overrides (`Time off`, `Record sick day`, `On-call`). Covers every S1–S5 string from the UI-SPEC copywriting contract: queue/status/filters, empty/error/reject copy, sick-entry dialog, team-calendar toggle/conflict/legend/empty, time-entry field labels + on-save WT warning (`EmployeeTime.wtLimit.{daily,weekly,night}.{approaching,breach}` — the exact dotted copy-keys `checkWtLimits` emits), ewidencja generate/regenerate/archived/superseded, and notification copy for the leave APPROVAL_REQUEST + sick + WT-limit alert. `pnpm i18n:parity` passes.
- **`use-leave-queue.ts`** — sole tRPC boundary for the surface: `trpc.leave.listRequests` (register), `trpc.leave.getBalance` (side-panel balance-after, enabled only when a row is open), `trpc.leave.leaveType.list` + `trpc.employee.list` (name maps), and `trpc.leave.recordSickAbsence` via `useResourceMutation` with invalidate + i18n toasts. URL state via `nuqs` (status/page/pageSize). Returns `queueProps` + `sidePanel` bundles.
- **`leave-queue-section.tsx`** — wired `LeaveQueue` (owns loading via `DataTable` skeleton, empty via `AtelierEmptyState variant="page"` icon `CalendarClock`, error via `QueryErrorPanel`) + presentational `LeaveQueueView` over the canonical `DataTable`, status `Tabs`, the `Record sick leave` header action, and the `EntitySummarySheet` side-panel whose **balance-after figure is the anchor**. Sick dialog uses `DialogBody`/`DialogFooter`.
- **`leave-balance-card.tsx`** — presentational anchor: remaining-days at Display size (`font-display text-[28px]`, teal, `tabular-nums`); negative balance-after → `text-destructive` + `TriangleAlert` + "Insufficient balance" (icon + text, never colour alone).
- **`/leave` route** — thin flag-gated page (`module.workforce-employees` → `null` when OFF), `WorkbenchPageHeader` + `AnimateIn`, registered in `dashboard-routes.tsx`.

## Deviations from the plan (merged-backend reality)

- The plan assumed `use-approval-actions.ts` exists and that `listRequests` yields approval-step rows actionable verbatim. In the merged backend, `use-approval-actions.ts` does **not** exist, `trpc.leave.listRequests` returns raw `LeaveRequest` rows (no step IDs), and approve/reject on the generic chain is keyed by `stepId`. The leave surface is therefore a **register + balance-after + direct sick + submit foundation**; pending leave requests are approved/rejected in the existing **Approvals inbox**, which already renders `LEAVE_REQUEST` approval steps through the generic, now resourceType-gated chain (`submitLeaveRequest` creates an `ApprovalFlow` with `resourceType='LEAVE_REQUEST'`). This keeps the RBAC fence intact without forking a leave-specific actions hook or destabilising shared approval code.
- Routes live under `src/pages/dashboard/` + `dashboard-routes.tsx` (there is no `src/routes/` dir); the plan's `routes/leave.tsx` path was adapted accordingly.

## Verification

- `pnpm i18n:parity` — OK (494 pre-existing baseline sites tolerated; no new drift).
- `pnpm check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` / `check:web-vite-dialog-pattern` — all OK.
- `pnpm --filter @contractor-ops/web-vite typecheck` — clean for all plan-12 files. The only outstanding error is the inherited `team-calendar.test.tsx` importing the not-yet-built `team-calendar-view` (RED contract merged from backend Plan 01) — resolved in Plan 13.

## Deferred

- `de`/`pl`/`ar` strings are best-effort (machine-assisted); flagged for native review post-deploy (standing deferral, non-blocking).
