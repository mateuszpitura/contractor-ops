---
phase: 06-approval-workflow
plan: 03
subsystem: ui
tags: [tanstack-table, approval-queue, sla-badge, side-panel, bulk-actions, nuqs, i18n]

requires:
  - phase: 06-approval-workflow
    provides: Approval tRPC router with listPending, approve, reject, delegate, clarify, bulkApprove, bulkReject procedures
  - phase: 01-foundation-auth
    provides: usePermissions hook, RBAC, shadcn components, i18n framework
  - phase: 02-contractor-registry
    provides: TanStack Table patterns, floating bulk toolbar pattern, nuqs URL state
provides:
  - Approvals queue page at /approvals with tabs, status chips, search, table, side panel
  - SLA countdown badge component with color-coded status
  - TanStack Table with 7 columns and inline approve/reject actions
  - Floating bulk action toolbar with approve/reject
  - Side panel with invoice summary, chain tracker, and 4 approval actions
affects: [06-04, 06-05, 07-notifications]

tech-stack:
  added: []
  patterns: [approval-queue-table, sla-badge-countdown, floating-bulk-toolbar, side-panel-approval-actions]

key-files:
  created:
    - apps/web/src/components/approvals/sla-badge.tsx
    - apps/web/src/components/approvals/approval-queue/columns.tsx
    - apps/web/src/components/approvals/approval-queue/data-table.tsx
    - apps/web/src/components/approvals/approval-queue/data-table-toolbar.tsx
    - apps/web/src/components/approvals/approval-queue/side-panel.tsx
    - apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Mini chain tracker uses estimated step count from current stepOrder rather than fetching full flow steps array (keeps side panel fast)"
  - "Delegate user picker uses simple text input for userId in v1 (Command search picker deferred to refinement)"
  - "Clarify and delegate modals rendered as positioned overlays within Sheet component to avoid z-index stacking issues"

patterns-established:
  - "Approval queue column factory with action callbacks pattern: getColumns(t, { onApprove, onReject })"
  - "Reject popover with min-10-char comment validation inline within column cell"
  - "Floating bulk toolbar fixed at bottom with backdrop-blur, appears on selection > 0"

requirements-completed: [APPR-02, APPR-03, APPR-04, APPR-05, APPR-07]

duration: 6min
completed: 2026-03-21
---

# Phase 06 Plan 03: Approval Queue UI Summary

**Approvals page with TanStack Table queue, SLA countdown badges, inline approve/reject, bulk toolbar, and side panel with 4 approval actions (approve, reject, clarify, delegate)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T22:28:12Z
- **Completed:** 2026-03-21T22:34:35Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- SLA countdown badge with green/yellow/red/overdue color coding and 60-second auto-update
- Full approval queue table with 7 columns including inline approve/reject on row hover
- Approvals page with My Approvals and admin-only All tabs, URL-synced via nuqs
- Floating bulk action toolbar with approve and reject (with shared comment dialog)
- Side panel with invoice summary, mini chain tracker, and 4 approval actions
- Complete i18n translations for EN and PL (Approvals namespace)

## Task Commits

Each task was committed atomically:

1. **Task 1: SLA badge component and approval queue table with columns** - `f5a3c28` (feat)
2. **Task 2: Approvals page with tabs, toolbar, side panel, and bulk actions** - `5c613fd` (feat)

## Files Created/Modified
- `apps/web/src/components/approvals/sla-badge.tsx` - Color-coded SLA countdown badge with setInterval update
- `apps/web/src/components/approvals/approval-queue/columns.tsx` - 7-column ColumnDef array with inline actions and reject popover
- `apps/web/src/components/approvals/approval-queue/data-table.tsx` - TanStack Table wrapper with server-side pagination and overdue highlighting
- `apps/web/src/components/approvals/approval-queue/data-table-toolbar.tsx` - Status chip bar, search, floating bulk toolbar, bulk reject dialog
- `apps/web/src/components/approvals/approval-queue/side-panel.tsx` - Sheet side panel with invoice summary and 4 approval actions
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` - Approvals page with tabs, query, empty state, loading skeleton
- `apps/web/messages/en.json` - Added Approvals namespace with all UI strings
- `apps/web/messages/pl.json` - Added Approvals namespace with Polish translations

## Decisions Made
- Mini chain tracker in side panel shows simplified stepper based on current step order rather than fetching the full flow steps array -- keeps the side panel fast and avoids additional queries
- Delegate user picker uses simple text Input for userId in v1 (full Command search picker deferred to UX refinement)
- Clarification and delegation modals rendered as positioned overlays within the Sheet component to avoid z-index stacking issues with nested popovers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing Input import in side-panel.tsx**
- **Found during:** Task 2 (side panel creation)
- **Issue:** Delegate popover used Input component but import was missing
- **Fix:** Added `import { Input } from "@/components/ui/input"` to imports
- **Files modified:** apps/web/src/components/approvals/approval-queue/side-panel.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 5c613fd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial missing import. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
- Delegate user picker uses text Input for userId instead of full Command search -- intentional v1 simplification, will be enhanced in UX refinement phase
- Mini chain tracker shows estimated step count based on current stepOrder rather than actual flow steps -- adequate for v1 queue side panel usage

## Next Phase Readiness
- Approval queue UI complete, ready for invoice detail integration (Plan 04) and audit trail (Plan 05)
- All 4 approval actions (approve, reject, clarify, delegate) wired to tRPC mutations
- Bulk operations with floating toolbar functional

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*
