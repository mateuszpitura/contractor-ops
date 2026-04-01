---
phase: 18-time-tracking
plan: 05
subsystem: api, ui
tags: [time-tracking, reconciliation, deviation, invoice-matching, tRPC]

requires:
  - phase: 18-time-tracking/01
    provides: TimeEntry and Timesheet schema
  - phase: 18-time-tracking/03
    provides: Portal time entry grid and submission
  - phase: 18-time-tracking/04
    provides: Admin time router with approval endpoints
provides:
  - computeTimeReconciliation service for PER_HOUR/PER_DAY contracts
  - TIME_DEVIATION flag in invoice-matching pipeline
  - DeviationFlag badge component with severity mapping
  - ReconciliationCard for invoice detail page
  - ReconciliationTable for admin time section
  - getReconciliation, getInvoiceReconciliation, listReconciliations tRPC endpoints
affects: [invoices, time-tracking, admin-dashboard]

tech-stack:
  added: []
  patterns:
    - "Loosely typed PrismaClient for parallel worktree compatibility"
    - "Configurable org threshold via settingsJson"

key-files:
  created:
    - packages/api/src/services/time-reconciliation.ts
    - apps/web/src/components/time/deviation-flag.tsx
    - apps/web/src/components/time/reconciliation-card.tsx
    - apps/web/src/components/time/reconciliation-table.tsx
  modified:
    - packages/api/src/services/invoice-matching.ts
    - packages/api/src/routers/time.ts
    - packages/api/src/routers/invoice.ts
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/time/page.tsx

key-decisions:
  - "Loosely typed PrismaClient in reconciliation service for parallel execution compatibility"
  - "Service period fallback: month of issueDate when servicePeriodStart/End not set"
  - "TIME_DEVIATION as warning-only flag per D-15 (does not change matchStatus or block approval)"

patterns-established:
  - "Org-level configurable threshold via settingsJson (timeDeviationThresholdPercent)"
  - "Period fallback pattern: servicePeriodStart/End or month-of-issueDate"

requirements-completed: [TIME-05]

duration: 6min
completed: 2026-03-28
---

# Phase 18 Plan 05: Invoice-vs-Time Reconciliation Summary

**Time-vs-invoice reconciliation service with configurable deviation threshold, DeviationFlag badge, ReconciliationCard on invoice detail, and ReconciliationTable in admin time section**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-28T14:47:38Z
- **Completed:** 2026-03-28T14:54:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Created computeTimeReconciliation service that compares approved hours x rate against invoiced amount for PER_HOUR and PER_DAY contracts
- Integrated TIME_DEVIATION flag into invoice-matching pipeline as warning-only (D-15)
- Built DeviationFlag badge with severity mapping (success/warning/destructive) and tooltip breakdown
- Added ReconciliationCard to invoice detail page with 3-stat grid and visual comparison bar
- Replaced reconciliation tab placeholder with full ReconciliationTable in admin time section

## Task Commits

Each task was committed atomically:

1. **Task 1: Time reconciliation service and invoice-matching integration** - `6bc99c1` (feat)
2. **Task 2: Deviation flag, reconciliation card, reconciliation table, and invoice detail integration** - `253188f` (feat)

## Files Created/Modified
- `packages/api/src/services/time-reconciliation.ts` - Reconciliation computation (PER_HOUR/PER_DAY, configurable threshold)
- `packages/api/src/services/invoice-matching.ts` - Added TIME_DEVIATION flag to auto-match pipeline
- `packages/api/src/routers/time.ts` - Added getReconciliation, getInvoiceReconciliation, listReconciliations endpoints
- `packages/api/src/routers/invoice.ts` - Pass servicePeriodStart/End to runAutoMatch
- `apps/web/src/components/time/deviation-flag.tsx` - DeviationFlag badge with severity + tooltip
- `apps/web/src/components/time/reconciliation-card.tsx` - ReconciliationCard with stats and comparison bar
- `apps/web/src/components/time/reconciliation-table.tsx` - Admin reconciliation table sorted by deviation
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - Added ReconciliationCard to invoice detail
- `apps/web/src/app/[locale]/(dashboard)/time/page.tsx` - Replaced placeholder with ReconciliationTable

## Decisions Made
- Used loosely typed PrismaClient in reconciliation service for parallel execution compatibility (precedent: Phase 16, 18)
- Service period fallback: when invoice has no servicePeriodStart/End, use month of issueDate for reconciliation period
- TIME_DEVIATION flag is warning-only per D-15 -- does not change matchStatus or block invoice approval
- Extended runAutoMatch invoice input type to include optional servicePeriodStart/End for accurate period detection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended runAutoMatch invoice type for service period**
- **Found during:** Task 1
- **Issue:** runAutoMatch function signature didn't accept servicePeriodStart/End needed for time reconciliation
- **Fix:** Added optional servicePeriodStart/servicePeriodEnd to the invoice parameter type and updated the caller in invoice.ts
- **Files modified:** packages/api/src/services/invoice-matching.ts, packages/api/src/routers/invoice.ts
- **Verification:** TypeScript compiles without errors for new files
- **Committed in:** 6bc99c1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix necessary for service period data flow. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in time-entry.ts (PrismaClient type resolution from parallel Plan 04 worktree) -- out of scope, not caused by this plan
- Pre-existing webpack build error for react-pdf CSS import -- out of scope

## Known Stubs
None -- all components wire to real tRPC queries and the reconciliation service performs actual computation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reconciliation feature complete, ready for Phase 18 Plan 06 (if any) or phase completion
- All D-13 through D-16 requirements addressed
- Deviation threshold configurable per-org via settingsJson.timeDeviationThresholdPercent

## Self-Check: PASSED

All created files exist. All commits verified (6bc99c1, 253188f).

---
*Phase: 18-time-tracking*
*Completed: 2026-03-28*
