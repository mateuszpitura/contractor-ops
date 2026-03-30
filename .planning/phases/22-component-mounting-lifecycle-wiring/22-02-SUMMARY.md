---
phase: 22-component-mounting-lifecycle-wiring
plan: 02
subsystem: api
tags: [trpc, calendar, lifecycle-hooks, fire-and-forget]

# Dependency graph
requires:
  - phase: 20-documentation-calendar
    provides: calendar-deadline-sync and calendar-event-service functions
provides:
  - Calendar auto-push on contract create/update/delete lifecycle events
  - Calendar auto-push on invoice approval (single and bulk) lifecycle events
  - Calendar auto-push on approval SLA deadline when submitting for approval
  - Calendar cleanup on invoice void
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fire-and-forget calendar sync via void keyword + .catch() on all lifecycle hooks"
    - "Contractor name lookup outside transaction for calendar event metadata"

key-files:
  created: []
  modified:
    - packages/api/src/routers/contract.ts
    - packages/api/src/routers/approval.ts
    - packages/api/src/routers/invoice.ts

key-decisions:
  - "All calendar sync calls use void + .catch() pattern to never block mutations"

patterns-established:
  - "Lifecycle hook wiring: import sync service, add fire-and-forget call after mutation with conditional guard"

requirements-completed: [CAL-01]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 22 Plan 02: Calendar Lifecycle Wiring Summary

**Fire-and-forget calendar sync hooks wired into 8 contract/approval/invoice lifecycle mutations using void + .catch() pattern**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T11:55:59Z
- **Completed:** 2026-03-30T11:59:23Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Contract create/update with endDate automatically pushes expiry deadline to connected calendars
- Contract update clearing endDate or contract soft-delete removes calendar event
- Invoice approval (single and bulk) pushes payment deadline when dueDate exists
- Approval chain submission pushes SLA deadline when configured
- Invoice void removes payment deadline calendar event
- All 8 hook points use fire-and-forget pattern -- calendar failures never block mutations

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire calendar sync into contract create/update/delete** - `02ab90e` (feat)
2. **Task 2: Wire calendar sync into approval and invoice lifecycle** - `5aab9fb` (feat)

## Files Created/Modified
- `packages/api/src/routers/contract.ts` - Added syncContractExpiryDeadline on create/update, deleteCalendarEvent on update-clear/delete
- `packages/api/src/routers/approval.ts` - Added syncPaymentDueDeadline on approve/bulkApprove, syncApprovalSlaDeadline on submitForApproval, dueDate to invoice select
- `packages/api/src/routers/invoice.ts` - Added deleteCalendarEvent on voidInvoice

## Decisions Made
- All calendar sync calls use void + .catch() pattern to never block mutations (per D-10 from plan)
- Contractor name fetched via separate prisma.contractor.findUnique in update mutation since updated result lacks contractor relation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All calendar lifecycle hooks are wired and operational
- Calendar events will auto-push when contracts/invoices/approvals change, provided calendar connections exist

---
*Phase: 22-component-mounting-lifecycle-wiring*
*Completed: 2026-03-30*
