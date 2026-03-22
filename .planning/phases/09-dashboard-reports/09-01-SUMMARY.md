---
phase: 09-dashboard-reports
plan: 01
subsystem: api
tags: [trpc, prisma, csv, xlsx, dashboard, reports, audit-log, raw-sql]

requires:
  - phase: 08-payments
    provides: "Invoice paymentStatus, paidAt fields, payment run infrastructure"
  - phase: 01-foundation-auth
    provides: "tenantProcedure, requirePermission middleware, RBAC with report:read permission"
provides:
  - "dashboardRouter with kpis, spendTrend, deadlines, activity procedures"
  - "reportRouter with 5 report types + 4 chart endpoints + 5 CSV export mutations"
  - "auditRouter with list/actors/export procedures"
  - "report-export service with CSV generation using xlsx + BOM"
affects: [09-02, 09-03, 09-04, 09-05, 09-06]

tech-stack:
  added: []
  patterns:
    - "Raw SQL with ::int cast for BigInt safety in aggregate queries"
    - "Shared reportRead middleware constant for DRY permission checks"
    - "auditFilterSchema shared between list and export procedures"

key-files:
  created:
    - packages/api/src/routers/dashboard.ts
    - packages/api/src/routers/report.ts
    - packages/api/src/routers/audit.ts
    - packages/api/src/services/report-export.ts
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "WorkflowTaskRun status TODO/IN_PROGRESS used for open tasks (not PENDING/IN_PROGRESS as plan stated)"
  - "Compliance gaps computed in-memory from contractor data rather than raw SQL for consistency with contractor router health logic"
  - "Export mutations return base64-encoded CSV via report-export service, consistent with payment-export pattern"

patterns-established:
  - "Report chart endpoints: no-pagination variants of list queries for visualization data"
  - "Export mutations: same filters as list query but no pagination, max 10000 rows"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, ORG-10]

duration: 7min
completed: 2026-03-22
---

# Phase 09 Plan 01: Backend API Routers Summary

**3 tRPC routers (dashboard/report/audit) with 17 query + 6 mutation procedures, raw SQL spend aggregations, and CSV export service**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T13:44:38Z
- **Completed:** 2026-03-22T13:51:58Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Dashboard router with KPI aggregations (5 metrics + trend data), monthly spend trend by currency, combined deadlines feed, and activity feed
- Report router with 5 paginated report types (spendByContractor, spendByTeam, expiringContracts, overdueInvoices, complianceGaps), 4 chart endpoints, and 5 CSV export mutations
- Audit router with filtered/paginated list, actors dropdown, and full CSV export
- CSV export service using xlsx library with UTF-8 BOM for Polish character support

## Task Commits

Each task was committed atomically:

1. **Task 1: Create dashboard and report tRPC routers** - `accbef2` (feat)
2. **Task 2: Create audit tRPC router and CSV export service** - `9f1ff45` (feat)

## Files Created/Modified
- `packages/api/src/routers/dashboard.ts` - Dashboard KPIs, spend trend, deadlines, activity feed
- `packages/api/src/routers/report.ts` - 5 report types with pagination + 4 chart endpoints + 5 export mutations
- `packages/api/src/routers/audit.ts` - Audit log list with search/filter/pagination, actors dropdown, CSV export
- `packages/api/src/services/report-export.ts` - CSV generation with xlsx + BOM for Polish characters
- `packages/api/src/root.ts` - Wired dashboard, report, audit sub-routers

## Decisions Made
- Used WorkflowTaskRun status `TODO`/`IN_PROGRESS` for open tasks KPI (matching actual enum values, not `PENDING`/`IN_PROGRESS` as plan stated)
- Compliance gaps computed in-memory from contractor relations for consistency with existing contractor router health computation
- Export mutations share query logic with list endpoints but without pagination, capped at 10000 rows

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed WorkflowTaskRun status enum values**
- **Found during:** Task 1 (dashboard.ts kpis query)
- **Issue:** Plan referenced `PENDING`/`IN_PROGRESS` but actual enum is `TODO`/`IN_PROGRESS`
- **Fix:** Used correct enum values `TODO` and `IN_PROGRESS`
- **Files modified:** packages/api/src/routers/dashboard.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** accbef2

**2. [Rule 1 - Bug] Fixed readonly array type incompatibility with Prisma**
- **Found during:** Task 1 (report.ts expiringContracts/overdueInvoices)
- **Issue:** `as const` arrays create readonly tuples incompatible with Prisma's mutable array types
- **Fix:** Used explicit mutable type assertion instead of `as const`
- **Files modified:** packages/api/src/routers/report.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** accbef2

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 routers registered and type-safe, ready for frontend consumption in Plans 02-06
- Chart endpoints ready for dashboard visualization components
- Export mutations ready for download buttons in report views

---
*Phase: 09-dashboard-reports*
*Completed: 2026-03-22*
