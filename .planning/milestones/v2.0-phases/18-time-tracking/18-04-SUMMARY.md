---
phase: 18-time-tracking
plan: 04
subsystem: api, ui
tags: [trpc, timesheet, approval, bulk-operations, admin-dashboard]

requires:
  - phase: 18-time-tracking
    provides: "Time entry service functions (approve/reject/bulk), validator schemas, Prisma timesheet model"
provides:
  - "Admin time management tRPC router with 8 procedures"
  - "Manager-facing approval queue UI with batch operations"
  - "Per-contractor timesheet review page"
  - "Rejection reason dialog with validation"
  - "Admin sidebar Time navigation item"
affects: [18-05-reconciliation, time-tracking-integration]

tech-stack:
  added: []
  patterns: ["Admin time router follows approval.ts pattern with tenantProcedure + requirePermission"]

key-files:
  created:
    - packages/api/src/routers/time.ts
    - apps/web/src/components/time/approval-queue-table.tsx
    - apps/web/src/components/time/contractor-timesheet-review.tsx
    - apps/web/src/components/time/rejection-reason-dialog.tsx
    - apps/web/src/app/[locale]/(dashboard)/time/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx
  modified:
    - packages/api/src/root.ts
    - apps/web/src/lib/navigation.ts

key-decisions:
  - "Used groupBy queries for listContractors instead of _count relation filter (Prisma type compatibility in parallel execution)"
  - "Used ctx.user!.id pattern matching approval.ts rather than ctx.session.user.id"

patterns-established:
  - "Admin time router: tenantProcedure + requirePermission({ time: ['read'|'approve'] })"
  - "Approval queue: batch select with sticky bottom action bar pattern"

requirements-completed: [TIME-02]

duration: 6min
completed: 2026-03-28
---

# Phase 18 Plan 04: Admin Time Management Summary

**Admin time tRPC router with 8 procedures, manager approval queue with batch operations, per-contractor timesheet review, and rejection dialog with 10-char minimum validation**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T23:38:56Z
- **Completed:** 2026-03-27T23:45:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Admin time management tRPC router with listPending, listAll, getTimesheet, listContractors, approve, reject, bulkApprove, bulkReject
- Manager-facing approval queue table with bulk checkbox selection, batch approve/reject with confirmation dialogs
- Per-contractor timesheet review with read-only grid, entry descriptions, source badges, and sticky action bar
- Rejection reason dialog with 10-char minimum, 500-char max, supporting both single and bulk modes
- Admin /time page with 3 tabs: Pending Reviews (with badge count), All Entries (with status filter), Reconciliation placeholder
- Time nav item in admin sidebar finance group between Approvals and Payments

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin time tRPC router and navigation wiring** - `e9330ee` (feat)
2. **Task 2: Admin time page, approval queue, contractor review, rejection dialog** - `b6afa40` (feat)

## Files Created/Modified
- `packages/api/src/routers/time.ts` - Admin time management tRPC router (8 procedures)
- `packages/api/src/root.ts` - Added timeRouter to appRouter (alongside portalTimeRouter)
- `apps/web/src/lib/navigation.ts` - Added Time nav item with Clock icon in finance group
- `apps/web/src/components/time/approval-queue-table.tsx` - Pending timesheet approval table with bulk actions
- `apps/web/src/components/time/contractor-timesheet-review.tsx` - Per-contractor read-only grid review
- `apps/web/src/components/time/rejection-reason-dialog.tsx` - Rejection reason dialog with validation
- `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` - Admin time tracking page with 3 tabs
- `apps/web/src/app/[locale]/(dashboard)/time/[contractorId]/page.tsx` - Per-contractor review page

## Decisions Made
- Used groupBy queries for listContractors to avoid Prisma _count relation filter type issues in parallel execution context
- Followed ctx.user!.id pattern from approval.ts for user identification in mutations
- Used fixed bottom bar with slide-in animation for batch action bar per UI-SPEC

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing Prisma type issues: timesheet model not in generated PrismaClient types (known parallel execution issue per STATE.md). All time-tracking files share this limitation.
- Pre-existing react-pdf CSS import failure prevents full web build. Not related to time tracking changes.
- `time` permission type not yet registered in Better Auth Permission type. Same class of issue as portalTime router.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Admin time management complete, ready for Plan 05 (reconciliation)
- Reconciliation tab placeholder in place, waiting for implementation
- All approve/reject/bulk flows ready for end-to-end testing once Prisma schema is generated

---
*Phase: 18-time-tracking*
*Completed: 2026-03-28*
