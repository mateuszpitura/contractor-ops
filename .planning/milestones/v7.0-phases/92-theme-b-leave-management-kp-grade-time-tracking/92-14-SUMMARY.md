---
phase: 92-theme-b-leave-management-kp-grade-time-tracking
plan: 14
type: execute
status: complete
requirements: [TIME-EMP-01, TIME-EMP-02]
---

# Plan 92-14 Summary — Employee time entry + WT-limit alert surface

## What shipped

- **`use-employee-time.ts`** — sole tRPC boundary using the DISTINCT `employeeTime.*` procedures (never contractor `time.*`): `trpc.employeeTime.weekSummary` (hours this week), `trpc.employeeTime.listRecords` (month records + overtime-this-month), `trpc.employee.list` (worker selector), and `trpc.employeeTime.upsertRecord` via `useResourceMutation`. The mutation's `onSuccess` captures the returned `findings` into state (non-blocking) and derives the limit-status KPI.
- **`employee-time-section.tsx`** — wired `EmployeeTime`: worker `Select`, three KPI `SummaryCard`s (hours this week / overtime this month / limit status — the anchor) with `SummaryCardSkeleton` loading, the on-save `WtLimitWarningBanner`, and the month records over the canonical `DataTable`. Owns loading/empty (`AtelierEmptyState`)/error (`QueryErrorPanel`).
- **`employee-time-entry-view.tsx`** — day-grain form (`DialogBody`/`DialogFooter`): Date, Hours worked, Night, Overtime 50% / 100%, Weekend/holiday, On-call + location, Absence type. Collects hours and converts to the minute-grained `upsertRecord` payload.
- **`wt-limit-alert-banner.tsx`** (S5 shared) — status-coloured focal headline (`font-display` 20px), warning-triangle shape + text (non-colour cue), `aria-live` assertive on breach / polite when approaching, "View time record" + dismiss.
- **`wt-limit-warning-banner.tsx`** — maps the highest-severity `finding` to the shared banner, resolving the finding's dotted `copyKey` (`tRoot(finding.copyKey, {name, limit, actual})`) with minutes→hours.
- **S5 entity route** — `getEntityUrl` in `notification-item.tsx` gains `EMPLOYEE_TIME_RECORD → /employee-time` and `LEAVE_REQUEST → /leave` so the daily WT-scan digest + leave notifications deep-link correctly.
- **`/employee-time` route** — thin flag-gated page, registered in `dashboard-routes.tsx`.

## Deviations (backend-honest)

- **On-save WT warning is post-commit, not a pre-save gate.** `upsertRecord` commits the row and returns `findings` in the same call (never throws on breach). There is no dry-run endpoint, so the non-blocking warning surfaces after the save succeeds (the save was never blocked — UI-A3 satisfied). The `saveAnyway` copy key stays reserved.
- **No Notes field / no delete affordance.** `upsertEmployeeTimeRecordInput` has no `notes` field and the router exposes no delete procedure, so neither is rendered (the day model is upsert-by-(worker,date)). Unused i18n keys stay for parity.
- Overtime is split into 50% / 100% surcharge buckets (the actual KP model); rendered as two fields labelled "Overtime 50% / 100%" (numeric suffixes, not translatable prose).

## Verification

- `pnpm --filter @contractor-ops/web-vite typecheck` — clean.
- `check:web-vite-data-layer` / `page-shells` / `presentational` / `dialog-pattern` — all OK.
- `pnpm i18n:parity` — OK.

## Deferred

- de/pl/ar strings best-effort, flagged for native review.
