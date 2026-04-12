---
phase: 06-approval-workflow
plan: 06
subsystem: ui
tags: [tanstack-table, row-selection, bulk-actions, react]

requires:
  - phase: 06-approval-workflow
    provides: "Approval queue table, toolbar with bulk actions, side panel"
provides:
  - "Working row selection -> selectedIds -> bulk toolbar flow on /approvals page"
affects: []

tech-stack:
  added: []
  patterns:
    - "onSelectionChange callback pattern for forwarding TanStack Table row selection to parent"

key-files:
  created: []
  modified:
    - apps/web/src/components/approvals/approval-queue/data-table.tsx
    - apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx

key-decisions:
  - "useEffect-based selection forwarding instead of onRowSelectionChange callback to keep TanStack Table state setter simple"

patterns-established:
  - "Row selection reset on data change via useEffect dependency on data reference"

requirements-completed: [APPR-04]

duration: 1min
completed: 2026-03-21
---

# Phase 06 Plan 06: Gap Closure - Bulk Selection Wiring Summary

**Fixed broken bulk approve/reject wiring by adding onSelectionChange callback from TanStack Table row selection to parent page selectedIds state**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-21T22:58:09Z
- **Completed:** 2026-03-21T22:59:17Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Added onSelectionChange optional callback prop to ApprovalQueueTableProps interface
- Wired TanStack Table rowSelection state with onRowSelectionChange handler and useEffect forwarding
- Connected parent page setSelectedIds directly as onSelectionChange prop
- Added selection reset on data/tab/status/search/page changes to prevent stale selections
- Removed empty no-op handleSelectionFromTable callback

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire table row selection to parent via onSelectionChange callback** - `d98be5f` (fix)

## Files Created/Modified
- `apps/web/src/components/approvals/approval-queue/data-table.tsx` - Added onSelectionChange prop, rowSelection state, selection forwarding via useEffect, data-change reset
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` - Removed empty callback, passed setSelectedIds as onSelectionChange, added useEffect to clear on filter changes

## Decisions Made
- Used useEffect-based forwarding (rowSelection -> onSelectionChange) rather than inline onRowSelectionChange handler to keep TanStack Table's state setter clean and avoid stale closure issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- APPR-04 gap closed: bulk selection -> toolbar -> bulk action flow fully wired
- Phase 06 (approval-workflow) should now pass verification for all requirements

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*

## Self-Check: PASSED
