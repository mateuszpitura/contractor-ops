---
title: HR dashboard
type: domain
tags: [hr, workforce, dashboard, leave, personnel-file, gulf]
source_commit: 1e41c29d6
verify_with:
  - packages/api/src/routers/workforce/hr-dashboard.ts
  - packages/api/src/services/hr-dashboard-utilization.ts
  - packages/api/src/services/hr-dashboard-doc-expiry.ts
  - packages/api/src/services/hr-dashboard-probation.ts
  - packages/api/src/services/saudization-dashboard.ts
  - apps/web-vite/src/pages/dashboard/hr.tsx
  - apps/web-vite/src/components/hr-dashboard/
  - apps/web-vite/src/lib/hr-roles.ts
updated: 2026-07-05
---

# HR dashboard

## Purpose

A STAFF, read-only command view of the workforce for the four HR roles. Aggregates the shipped Theme B
employee data (registry, personnel file, leave) plus the v6.0 F1 compliance-expiry math and the F3 Gulf
nationalisation service into six sections. Ships dark behind `module.hr-dashboard` (layered on
`module.workforce-employees`).

## Flow

```
hrDashboard.* (packages/api/src/routers/workforce/hr-dashboard.ts)
  → pure services (hr-dashboard-utilization / -doc-expiry / -probation, saudization-dashboard)
  → web-vite dashboard/hr  (page → wired section → hooks/use-hr-* → *View)
```

## Entry points

| Piece | Path |
|-------|------|
| Router | `hrDashboard` — `packages/api/src/routers/workforce/hr-dashboard.ts` (mounted via `conditionalHrDashboardRouters` in `root.ts`) |
| Gate middleware | `packages/api/src/middleware/require-hr-dashboard-flag.ts` (`assertHrDashboardEnabled` + `isHrDashboardRegistered()`) |
| Pure services | `services/hr-dashboard-{utilization,doc-expiry,probation}.ts` + `services/saudization-dashboard.ts` (`computeNationalisationDashboard`) |
| Page | `apps/web-vite/src/pages/dashboard/hr.tsx` (`HrDashboardPage` + `HrDashboardPageContent`), route `dashboard/hr` |
| UI sections | `apps/web-vite/src/components/hr-dashboard/` (header + headcount + utilization + doc-expiry + probation + nationalisation) |
| Hooks (sole tRPC boundary) | `components/hr-dashboard/hooks/use-hr-{summary,headcount,utilization,doc-expiry,probation,nationalisation}.ts` |
| Role set | `apps/web-vite/src/lib/hr-roles.ts` (`isHrDashboardRole`) |
| Nav entry | `apps/web-vite/src/lib/navigation.ts` (`hr` item) filtered by `use-nav-items.ts` `roles` predicate |

## UI surface (six widget groups)

| Widget | Requirement | Procedure | Notes |
|--------|-------------|-----------|-------|
| KPI header | — | `getSummary` | total headcount / under-utilized / probation-due / expiring-docs |
| Headcount | HR-DASH-01 | `getHeadcount` | total + by department / jurisdiction / employment-type / contract-end |
| Vacation utilization | HR-DASH-02 | `getVacationUtilization` | under-utilized callout + per worker-year table; dark leave source → degraded card |
| Document expiry | HR-DASH-03 | `getDocumentExpiry` | expired/30/60/90 bands by category; **section-filtered by the server** — the UI renders only what it receives |
| Probation watchlist | HR-DASH-04 | `getProbationWatchlist` | 14/7/0 buckets with severity |
| Gulf nationalisation | HR-DASH-05 | `getNationalisationRollup` | KSA + UAE side-by-side; "record manual headcount" prompt when absent — never a platform-derived rate |

Every section is `page → wired section → hooks/use-*.ts (sole tRPC boundary) → *View`, with loading / empty /
degraded / error states. All copy is the `HrDashboard.*` i18n namespace (en/en-US/de/pl/ar); nav label `Navigation.hr`.

## Invariants

- RBAC gate = `requirePermission({ employee: ['read'] })` → the four HR roles ONLY (`hr_admin`, `hr_manager`,
  `payroll_officer`, `leave_approver`); **owner excluded** (the BFLA fence omits `employee` from `allPermissions`).
  NOT `report:read`.
- The aggregation columns (`department`, `employmentType`, `contractEndDate`, `probationEndsAt`, and
  `PersonnelFileDocument.expiresAt` + `docCategory`) were ADDED additively in 97-01 — they were not P90-promoted.
- Doc-expiry composes the pure `@contractor-ops/compliance-policy` `daysUntilExpiryInTz` math — NOT the contractor
  `compliance-reminder-scan` cron.
- The nationalisation rate is manual-input only (F3 anti-feature); the band is read-through, never inferred.
- Server is the authoritative RBAC boundary; the client gate (page + nav) matches the raw active-member role against
  the HR role set (`lib/hr-roles.ts`) because the four HR roles are NOT in the client `MemberRole` union.

## Related

- [[domains/employee-registry]]
- [[domains/personnel-file]]
- [[domains/leave-and-time]]
- [[domains/gulf-saudization]]
- [[structure/api-routers-catalog]]
- [[structure/key-services]]

## Verify live

```bash
semble search "hrDashboardRouter"
semble search "isHrDashboardRole"
semble search "computeNationalisationDashboard"
```

## Agent mistakes

- Assuming the widget source columns were P90-promoted — they were NOT; 97-01 added them additively (see 97-01 SUMMARY).
- Gating the surface on `report:read` — it is `employee:read` (the four HR roles, owner excluded).
- Reusing the contractor `compliance-reminder-scan` for doc expiry — it composes `compliance-policy` pure math instead.
- Rendering a platform-derived Emiratisation/Saudization rate — the rate is manual-input only; a missing country
  shows the "record manual headcount" prompt.
- Gating the client on `can('employee', ['read'])` — it returns `false` for every client role (the HR roles are not
  in the `MemberRole` union), which would lock everyone out; match the raw role via `lib/hr-roles.ts` instead.
- Assuming the doc-expiry UI sees every section — the server section-filters per caller; the view is a dumb renderer.
