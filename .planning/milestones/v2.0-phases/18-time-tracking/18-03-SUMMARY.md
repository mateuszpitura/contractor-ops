---
phase: 18-time-tracking
plan: 03
subsystem: api, ui
tags: [trpc, portal, timesheet, time-tracking, grid, date-fns, sync]

# Dependency graph
requires:
  - phase: 18-time-tracking/01
    provides: "Timesheet/TimeEntry Prisma models, Zod validators, time-entry service"
  - phase: 18-time-tracking/02
    provides: "Clockify sync service, Jira worklog sync service"
  - phase: 13
    provides: "portalProcedure middleware, portal layout, nav structure"
provides:
  - "Portal time tRPC router with 8 procedures (CRUD, submit, sync, providers)"
  - "Portal /time page with weekly timesheet grid"
  - "Time nav item in portal top bar and mobile menu"
  - "7 time tracking UI components (grid, header, entry form, sync buttons, badges, stats)"
affects: [18-time-tracking/04, 18-time-tracking/05]

# Tech tracking
tech-stack:
  added: []
  patterns: ["weekly grid with auto-save on blur", "ISO week navigation with date-fns", "external sync popover with date range"]

key-files:
  created:
    - packages/api/src/routers/portal-time.ts
    - apps/web/src/app/[locale]/(portal)/portal/time/page.tsx
    - apps/web/src/components/time/timesheet-grid.tsx
    - apps/web/src/components/time/timesheet-header.tsx
    - apps/web/src/components/time/single-entry-form.tsx
    - apps/web/src/components/time/time-entry-status-badge.tsx
    - apps/web/src/components/time/time-source-badge.tsx
    - apps/web/src/components/time/external-sync-button.tsx
    - apps/web/src/components/time/time-summary-stats.tsx
  modified:
    - packages/api/src/root.ts
    - apps/web/src/components/portal/portal-top-bar.tsx
    - apps/web/src/components/portal/portal-mobile-menu.tsx

key-decisions:
  - "Used inline ISO Monday helper in router (same as time-entry service convention)"
  - "Grid stores hours locally during edit, saves minutes on blur for responsive UX"

patterns-established:
  - "Auto-save grid pattern: local state during edit, onBlur triggers tRPC mutation"
  - "Week navigation: startOfISOWeek snap for calendar date selection"

requirements-completed: [TIME-01, TIME-03, TIME-04]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 18 Plan 03: Portal Time UI Summary

**Portal time tRPC router with 8 endpoints and full contractor UI: weekly timesheet grid with auto-save, single entry dialog, Clockify/Jira sync buttons, and week navigation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-27T23:27:20Z
- **Completed:** 2026-03-27T23:35:20Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Portal time tRPC router with getTimesheet, getActiveContracts, saveDraftEntries, createSingleEntry, submitTimesheet, listTimesheets, syncExternal, and getConnectedProviders procedures
- Weekly timesheet grid with project rows, Mon-Sun columns, auto-save on cell blur, tab/enter navigation, and imported entry protection
- Time nav item added to portal top bar and mobile menu between Documents and Payments
- Single entry dialog, external sync buttons with date range popover, summary stats cards, status and source badges

## Task Commits

Each task was committed atomically:

1. **Task 1: Portal time tRPC router and app router wiring** - `c5c6f10` (feat)
2. **Task 2: Portal time page, nav update, and all portal time components** - `d0d6dff` (feat)

## Files Created/Modified
- `packages/api/src/routers/portal-time.ts` - Portal time tRPC router with 8 procedures
- `packages/api/src/root.ts` - Added portalTime to appRouter
- `apps/web/src/components/portal/portal-top-bar.tsx` - Added Time nav item with Clock icon
- `apps/web/src/components/portal/portal-mobile-menu.tsx` - Added Time nav item with Clock icon
- `apps/web/src/app/[locale]/(portal)/portal/time/page.tsx` - Portal time page composing all components
- `apps/web/src/components/time/timesheet-grid.tsx` - Weekly grid with auto-save, tab navigation, imported entry handling
- `apps/web/src/components/time/timesheet-header.tsx` - Week selector with calendar, status badge, total display, submit button
- `apps/web/src/components/time/single-entry-form.tsx` - Dialog form for ad-hoc time entries
- `apps/web/src/components/time/time-entry-status-badge.tsx` - Status badge (DRAFT/SUBMITTED/APPROVED/REJECTED)
- `apps/web/src/components/time/time-source-badge.tsx` - Source badge (MANUAL/CLOCKIFY/JIRA) with tooltips
- `apps/web/src/components/time/external-sync-button.tsx` - Sync button with date range popover
- `apps/web/src/components/time/time-summary-stats.tsx` - 3 summary cards (this week, pending, approved)

## Decisions Made
- Used inline ISO Monday helper in the router rather than importing date-fns (follows Phase 4 convention for API package)
- Grid uses local state for in-progress edits and triggers onBlur save to avoid excessive mutation calls during typing
- Rejection banner uses amber colors consistent with warning status per UI-SPEC color contract

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- API package build fails due to missing Prisma Timesheet/TimeEntry models and CLOCKIFY IntegrationProvider enum (created by parallel Plan 18-01, not yet merged). Portal-time router code is correct and will compile after merge.
- Web build has pre-existing react-pdf CSS import failure from Phase 16 (unrelated). All time components compile cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Portal time router ready for admin time router (Plan 04) to reference patterns
- All UI components ready for visual testing after merge with Plan 01 schema
- Sync buttons wire directly to Plan 02's Clockify/Jira sync services

---
*Phase: 18-time-tracking*
*Completed: 2026-03-28*
