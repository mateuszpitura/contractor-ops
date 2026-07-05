# 97-06 SUMMARY — staff HR dashboard shell + headcount + vacation-utilization UI

**Wave:** 4 · **Status:** done · builds the web-vite surface on the 97-03 `hrDashboard` procedures.

## What landed
- **Route + page shell** — `dashboard/hr` lazy route in `router/dashboard-routes.tsx` → `pages/dashboard/hr.tsx`.
  `HrDashboardPage` = `Suspense` + `HrDashboardPageContent` (thin composer — `useTranslations` / `usePermissions` /
  `useFlag` / `useLocale` / `<Navigate>` only, no `useTRPC`). Composes the KPI header + headcount + utilization
  sections behind `AnimateIn`.
- **Flag + role gate** — the page renders only when `module.hr-dashboard` is on AND the active member holds one of the
  four HR roles. **Key correction:** the four worker-model HR roles (`hr_admin`, `hr_manager`, `payroll_officer`,
  `leave_approver`) are NOT in the client `MemberRole` union (`role-normalization.ts`), so
  `usePermissions().can('employee', ['read'])` resolves to `false` for every client-modeled role and cannot gate the
  surface (it would lock everyone out). The equivalent-and-correct client gate matches the raw active-member role
  against the HR role set (`lib/hr-roles.ts` — `isHrDashboardRole`), which mirrors the server `employee:read` grant
  exactly (owner excluded). The server `hrDashboardProcedure` stays the authoritative RBAC boundary; this is
  UX / defense-in-depth. A loading guard prevents an unauthorized-redirect flash while the membership query resolves.
- **Nav entry** — a `hr` item (icon `UsersRound`, `href /dashboard/hr`) in the `operations` group, gated on
  `flag: module.hr-dashboard` + a new additive `NavItem.roles` predicate (the same four HR roles). `use-nav-items.ts`
  filters on `roles` against the raw member role — a minimal additive extension because the flag+permission nav model
  cannot express an HR-role gate (same `MemberRole` gap). `navigation.test.ts` asserts the gating.
- **KPI header** (`hr-dashboard-header.tsx`) — wired `HrDashboardHeader` over `use-hr-summary` (`getSummary`) →
  four read-only stats (total headcount, under-utilized, probation-due, expiring-docs) with `AnimatedNumber`,
  `tabular-nums`, action-needed emphasis, and a `<dl>` semantic. Branches loading / empty (no workforce) / error.
- **Headcount** (HR-DASH-01, `hr-headcount-section.tsx`) — wired over `use-hr-headcount` (`getHeadcount`) →
  total + by-department / by-jurisdiction / by-employment-type / by-contract-end breakdowns. Empty card when there
  are no active employees.
- **Vacation utilization** (HR-DASH-02, `hr-utilization-section.tsx`) — wired over `use-hr-utilization`
  (`getVacationUtilization`) → an under-utilized callout + a per worker-year table via the canonical
  `WorkbenchDataTable` (client pagination; under-utilized rows flagged). A dark leave source renders a real degraded
  card ("leave tracking not enabled").
- **Shared section scaffolding** (`hr-section.tsx`) — presentational `HrSectionCard` / `HrSectionSkeleton` /
  `HrSectionEmpty` / `HrSectionError` reused by every widget so loading / empty / degraded / error are consistent.
- **Layering** — page → wired section → `hooks/use-*.ts` (sole tRPC boundary) → presentational `*View`. All copy is
  `HrDashboard.*` keys (authored in 97-08); the KPI header + section labels are keyed from the start.

## Verification
- `pnpm --filter @contractor-ops/web-vite typecheck` — green (0 errors; requires `--max-old-space-size` locally).
- `pnpm check:web-vite-data-layer` / `check:web-vite-page-shells` / `check:web-vite-presentational` — OK.
- `pnpm --filter @contractor-ops/web-vite test src/lib/__tests__/navigation.test.ts` — 8 passed.
- `check:web-vite-table-pattern` has 4 PRE-EXISTING violations on main (tax-filing / ewidencja / hris-sync / webhooks);
  no hr-dashboard file is flagged (my tables use the canonical `WorkbenchDataTable`).

## Notes / deviations
- **Worktree fast-forwarded to `main`** (strict-ancestor, zero unique commits — non-destructive) to build on the
  merged 97-01…97-05 backend, mirroring 97-01's setup; then `pnpm install` + `db build` + `ui build` in the fresh worktree.
- i18n JSON is authored in 97-08 (the 5-locale sweep) — the components reference keys only.
- The `NavItem.roles` gate is a new (additive) nav mechanism; recorded for the wiki + MEMORY in 97-08.
