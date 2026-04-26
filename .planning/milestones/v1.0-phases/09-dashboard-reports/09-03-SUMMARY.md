---
phase: 09-dashboard-reports
plan: 03
subsystem: ui
tags: [recharts, tanstack-table, nuqs, react, reports, csv-export]

requires:
  - phase: 09-01
    provides: Report tRPC router with spend, expiring, overdue, compliance endpoints and CSV export mutations
provides:
  - Reports page with sidebar navigation for 5 report types
  - Shared report components (chart, table, breadcrumb, date filter, export)
  - Spend by contractor report with bar chart drill-down
  - Spend by team report with bar chart
  - Expiring contracts report with 30/60/90 day bucket chart
  - Overdue invoices report (table-only)
  - Compliance gaps report with pie chart drill-down
  - CSV export for all report types
affects: [09-04, 09-05]

tech-stack:
  added: [recharts]
  patterns: [report-component-pattern, chart-drill-down, base64-csv-export]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/reports/page.tsx
    - apps/web/src/components/reports/report-sidebar.tsx
    - apps/web/src/components/reports/date-range-filter.tsx
    - apps/web/src/components/reports/report-chart.tsx
    - apps/web/src/components/reports/report-table.tsx
    - apps/web/src/components/reports/drill-down-breadcrumb.tsx
    - apps/web/src/components/reports/export-buttons.tsx
    - apps/web/src/components/reports/spend-contractor-report.tsx
    - apps/web/src/components/reports/spend-team-report.tsx
    - apps/web/src/components/reports/expiring-contracts-report.tsx
    - apps/web/src/components/reports/overdue-invoices-report.tsx
    - apps/web/src/components/reports/compliance-gaps-report.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Button group for date presets instead of ToggleGroup (no toggle-group UI component exists)"
  - "Budget % column shows dash placeholder since no budget feature exists yet"
  - "Expiring contracts uses days selector (30/60/90) independent of date range filter"

patterns-established:
  - "Report component pattern: chart + drill-down breadcrumb + table + export buttons"
  - "Chart drill-down: clicking chart segment sets filter state, breadcrumb shows path"
  - "downloadBase64File utility for CSV export via base64 Blob pattern"

requirements-completed: [RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06]

duration: 8min
completed: 2026-03-22
---

# Phase 09 Plan 03: Reports Page Summary

**Reports page with 5 report types (spend/contractor, spend/team, expiring contracts, overdue invoices, compliance gaps), Recharts charts with drill-down, TanStack tables with server-side pagination, and CSV export**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T13:54:17Z
- **Completed:** 2026-03-22T14:02:17Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Built 6 shared report components: sidebar, date range filter, chart (bar/pie), table, drill-down breadcrumb, export buttons
- Created 5 report type components each wired to tRPC report endpoints with charts, tables, and CSV export
- Reports page with sidebar navigation, date range filter with presets, and URL state via nuqs for shareable filtered views
- Responsive layout: vertical sidebar on desktop, horizontal scrollable pill bar on mobile

## Task Commits

Each task was committed atomically:

1. **Task 1: Create shared report components** - `90acee0` (feat)
2. **Task 2: Create 5 report type components and wire reports page** - `3f4401f` (feat)

## Files Created/Modified
- `apps/web/src/components/reports/report-sidebar.tsx` - Vertical nav with 5 report types, mobile pill bar
- `apps/web/src/components/reports/date-range-filter.tsx` - Preset buttons + custom date picker
- `apps/web/src/components/reports/report-chart.tsx` - Recharts wrapper for bar-horizontal, bar-grouped, pie
- `apps/web/src/components/reports/report-table.tsx` - TanStack Table with server-side pagination/sorting
- `apps/web/src/components/reports/drill-down-breadcrumb.tsx` - Breadcrumb for chart drill-down navigation
- `apps/web/src/components/reports/export-buttons.tsx` - Export page/all buttons with base64 download utility
- `apps/web/src/components/reports/spend-contractor-report.tsx` - Spend by contractor with bar chart drill-down
- `apps/web/src/components/reports/spend-team-report.tsx` - Spend by team with bar chart
- `apps/web/src/components/reports/expiring-contracts-report.tsx` - Expiring contracts with bucket chart
- `apps/web/src/components/reports/overdue-invoices-report.tsx` - Overdue invoices table-only report
- `apps/web/src/components/reports/compliance-gaps-report.tsx` - Compliance gaps with pie chart drill-down
- `apps/web/src/app/[locale]/(dashboard)/reports/page.tsx` - Reports page with sidebar + content area
- `apps/web/messages/en.json` - Reports i18n namespace (English)
- `apps/web/messages/pl.json` - Reports i18n namespace (Polish)

## Decisions Made
- Used Button group for date presets instead of ToggleGroup since no toggle-group shadcn component exists in the project
- Budget % column in spend-by-team report shows "-" placeholder since no budget management feature exists yet
- Expiring contracts report uses its own days selector (30/60/90) instead of the shared date range filter since the API uses days parameter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
- `apps/web/src/components/reports/spend-team-report.tsx` line ~130: Budget % column returns "-" because no budget feature exists. Intentional -- will be resolved when budget management is built.

## Next Phase Readiness
- Reports page complete with all 5 report types
- Ready for notification/integration phases that may reference report data
- All components follow established patterns for consistency

## Self-Check: PASSED

All 12 created files verified present. Both task commits (90acee0, 3f4401f) verified in git log.

---
*Phase: 09-dashboard-reports*
*Completed: 2026-03-22*
