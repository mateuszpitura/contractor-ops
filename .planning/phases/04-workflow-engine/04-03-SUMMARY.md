---
phase: 04-workflow-engine
plan: 03
subsystem: ui
tags: [tanstack-table, nuqs, trpc, workflow, tabs, sheet, dialog, my-tasks]

# Dependency graph
requires:
  - phase: 04-workflow-engine
    provides: workflow tRPC router (listRuns, myTasks, listTemplates, getRun, startRun, overdueCount)
  - phase: 03-contracts-documents
    provides: contract-table pattern (TanStack Table, nuqs, pagination, filters), contract-side-panel pattern
provides:
  - Workflow runs TanStack Table with server-side pagination, sorting, filtering
  - My tasks flat list with overdue sorting and status icons
  - Templates management table with CRUD actions
  - /workflows page with 3 tabs (Active runs, My tasks, Templates)
  - Workflow side panel (Sheet) with progress bar and task summary
  - Template picker dialog for starting workflow runs
  - Workflows translations namespace (EN + PL)
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [workflow-runs-table-mirroring-contract-table, url-tab-state-via-nuqs, permission-gated-tab-visibility]

key-files:
  created:
    - apps/web/src/components/workflows/workflow-runs-table/columns.tsx
    - apps/web/src/components/workflows/workflow-runs-table/data-table.tsx
    - apps/web/src/components/workflows/workflow-runs-table/data-table-toolbar.tsx
    - apps/web/src/components/workflows/workflow-runs-table/data-table-filters.tsx
    - apps/web/src/components/workflows/workflow-runs-table/data-table-pagination.tsx
    - apps/web/src/components/workflows/workflow-runs-table/use-workflow-filters.ts
    - apps/web/src/components/workflows/my-tasks-list.tsx
    - apps/web/src/components/workflows/templates-table.tsx
    - apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx
    - apps/web/src/components/workflows/workflow-side-panel.tsx
    - apps/web/src/components/workflows/template-picker-dialog.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Mirrored contract-table pattern exactly for workflow-runs-table consistency"
  - "Tab state synced to URL via nuqs parseAsString for deep-linking support"
  - "Templates tab visibility gated by usePermissions().can('workflow', ['create'])"
  - "Template picker accepts both single contractorId and bulk contractorIds array"

patterns-established:
  - "URL tab state: parseAsString with nuqs for tab persistence across navigation"
  - "Overdue row highlighting: bg-destructive/5 on table rows, bg-destructive/[0.03] on task cards"
  - "Permission-gated tabs: conditionally rendered TabsTrigger and TabsContent"

requirements-completed: [WKFL-05, WKFL-09, WKFL-10]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 4 Plan 3: Workflows Page Summary

**Main /workflows page with runs TanStack Table, My Tasks list, Templates management, side panel preview, and template picker dialog for starting workflows**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T16:26:31Z
- **Completed:** 2026-03-20T16:34:33Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Workflow runs TanStack Table mirroring contract-table pattern with manual pagination, sorting, filtering, and overdue row highlighting
- My tasks flat list with task status icons per UI-SPEC, overdue-first sorting, and navigation to run detail
- Templates management table with row actions (Edit, Duplicate, Activate/Archive, Delete with confirmation dialog)
- /workflows page with 3 tabs, tab state in URL, Templates tab permission-gated for admin/ops_manager
- Workflow side panel showing run progress bar, task summary counts, contractor link, and "Open workflow" CTA
- Template picker dialog with search, type pre-filtering, single and bulk workflow start support
- Full EN + PL translations for all workflow page copy per UI-SPEC copywriting contract

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow runs table, My Tasks list, Templates table** - `b6d3cc9` (feat)
2. **Task 2: Workflows page, side panel, template picker dialog** - `d66e153` (feat)

## Files Created/Modified
- `apps/web/src/components/workflows/workflow-runs-table/columns.tsx` - Column definitions with status/type badges and overdue highlighting
- `apps/web/src/components/workflows/workflow-runs-table/data-table.tsx` - TanStack Table with manual mode and empty/loading states
- `apps/web/src/components/workflows/workflow-runs-table/data-table-toolbar.tsx` - Search with 300ms debounce
- `apps/web/src/components/workflows/workflow-runs-table/data-table-filters.tsx` - Status, template, and overdue filters with popover
- `apps/web/src/components/workflows/workflow-runs-table/data-table-pagination.tsx` - Page size selector and navigation
- `apps/web/src/components/workflows/workflow-runs-table/use-workflow-filters.ts` - nuqs URL state for workflow filters
- `apps/web/src/components/workflows/my-tasks-list.tsx` - Flat task list with status icons and overdue sorting
- `apps/web/src/components/workflows/templates-table.tsx` - Templates table with CRUD actions dropdown
- `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` - Main workflows page with 3 tabs
- `apps/web/src/components/workflows/workflow-side-panel.tsx` - Side panel with progress bar and task summary
- `apps/web/src/components/workflows/template-picker-dialog.tsx` - Template picker with search and start mutation
- `apps/web/messages/en.json` - Workflows translations (EN)
- `apps/web/messages/pl.json` - Workflows translations (PL)

## Decisions Made
- Mirrored contract-table pattern exactly for workflow-runs-table to maintain codebase consistency
- Tab state synced to URL via nuqs `parseAsString` for deep-linking and shareable views
- Templates tab conditionally rendered using `usePermissions().can("workflow", ["create"])` matching permission matrix
- Template picker accepts both `contractorId` (single) and `contractorIds` (bulk) with `Promise.all` for bulk starts

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflows page fully functional with all three tabs, ready for run detail page (04-04) and contractor profile integration (04-05)
- Side panel provides quick preview with link to full run detail page
- Template picker reusable from multiple entry points (page CTA, contractor profile, bulk actions)

## Self-Check: PASSED

All 11 created files verified present. Both task commits (b6d3cc9, d66e153) verified in git log. TypeScript compilation clean (0 new errors).

---
*Phase: 04-workflow-engine*
*Completed: 2026-03-20*
