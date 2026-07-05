# 97-03 SUMMARY — hrDashboard router (headcount + utilization + KPI) + gate/mount

**Wave:** 3 · **Status:** done · flips RBAC / gating / section-grain / correctness RED tests GREEN.

> The Wave-3 backend (97-03/04/05) is one cohesive router file (`routers/workforce/hr-dashboard.ts`) plus its
> pure services, delivered in a single atomic commit — the router imports the doc-expiry/probation services, so
> they must land together. This SUMMARY covers the router shell + HR-DASH-01/02 + the KPI composite; 97-04 and
> 97-05 SUMMARYs cover their procedures in the same commit.

## What landed
- **`hrDashboardProcedure`** = `tenantProcedure.use(requirePermission({ employee: ['read'] })).use(assertHrDashboardEnabled).use(reportRateLimitMiddleware)`.
  The gate resolves to the four HR roles ONLY (owner excluded — the BFLA fence omits `employee` from `allPermissions`).
- **Mount:** a dedicated `conditionalHrDashboardRouters` in `root.ts` gated on `isWorkforceRegistered() && isHrDashboardRegistered()`
  → `hrDashboard.*` absent (METHOD_NOT_FOUND) when EITHER `module.workforce-employees` or `module.hr-dashboard` is off.
  (Deviation from the plan's "mount inside workforceRouters, no new conditional" — a dedicated conditional is required to give
  METHOD_NOT_FOUND on the `module.hr-dashboard`-off case, which the gating test demands.)
- **`middleware/require-hr-dashboard-flag.ts`** — `assertHrDashboardEnabled` (tRPC middleware, per-request re-assert) +
  `isHrDashboardRegistered()` (load-time). `errors.ts` gains `HR_DASHBOARD_DISABLED`.
- **`getHeadcount`** (HR-DASH-01) — active total + `employeeProfile.groupBy` by department / countryCode / employmentType +
  a `contractEndDate` date-window bucket; a shared `activeWhere` (`employmentStatus != TERMINATED`) guarantees buckets sum
  to the total; null grouping key → `'unspecified'`.
- **`getVacationUtilization`** (HR-DASH-02) — reads `leaveBalance.findMany` → the pure `deriveVacationUtilization`
  (`services/hr-dashboard-utilization.ts`; reuses `MINUTES_PER_LEAVE_DAY`); no ledger re-sum.
- **`getSummary`** — the KPI headline counts (total headcount, under-utilized, probation-due, expiring-docs ≤90d) in one call.
- **`packages/db/src/index.ts`** re-exports the new `EmploymentType` + `EmployeeDocCategory` enum types for consumers.

## Verification
- `pnpm typecheck --filter=@contractor-ops/api` green (17/17). `pnpm -F @contractor-ops/api test hr-dashboard` — 32 passed (7 files).
- Wiki (same change set): `structure/api-routers-catalog.md` (hrDashboard namespace + verify_with) + `structure/key-services.md` (HR-dashboard services).
