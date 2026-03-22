---
phase: 08-payments
plan: 02
subsystem: ui
tags: [react, tanstack-table, nuqs, shadcn, payments, side-panel, dialog, bank-statement]

# Dependency graph
requires:
  - phase: 08-payments
    provides: Payment tRPC router with 12 procedures, export service, bank statement parser
  - phase: 05-invoice-intake-matching
    provides: Invoice table and side panel patterns, status badge patterns
  - phase: 06-approval-workflow
    provides: Approval side panel, AlertDialog patterns
provides:
  - /payments page with payment run history table, status filters, side panel
  - New payment run dialog (3-step: select, review, lock & export)
  - Bank statement import dialog with match results table
  - PaymentRunBadge and PaymentItemBadge status components
  - Invoice selection table with checkbox, filters, group-by-currency
affects: [08-payments, 09-dashboard-reports]

# Tech tracking
tech-stack:
  added: []
  patterns: [cursor-based-pagination-ui, inline-form-actions, step-indicator-dots, base64-blob-download]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/payments/page.tsx
    - apps/web/src/components/payments/payment-run-table/columns.tsx
    - apps/web/src/components/payments/payment-run-table/data-table.tsx
    - apps/web/src/components/payments/payment-run-table/data-table-toolbar.tsx
    - apps/web/src/components/payments/payment-run-side-panel.tsx
    - apps/web/src/components/payments/payment-run-badge.tsx
    - apps/web/src/components/payments/new-payment-run-dialog/index.tsx
    - apps/web/src/components/payments/new-payment-run-dialog/step-select.tsx
    - apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx
    - apps/web/src/components/payments/new-payment-run-dialog/step-confirmation.tsx
    - apps/web/src/components/payments/invoice-selection-table/columns.tsx
    - apps/web/src/components/payments/invoice-selection-table/data-table.tsx
    - apps/web/src/components/payments/bank-statement-dialog.tsx
  modified:
    - packages/api/src/routers/integration.ts

key-decisions:
  - "Route group is (dashboard) not (app) -- used correct existing route group"
  - "Inline form approach for per-item actions instead of Popover-in-Dropdown (base-ui render prop pattern incompatible with Popover nesting)"
  - "Cursor-based pagination for payment run list matching tRPC API design"
  - "base64 Blob download pattern with URL.createObjectURL for export file delivery"

patterns-established:
  - "Inline form state toggle for dropdown item actions (paid/failed/remove) instead of Popover composition"
  - "Step indicator dots component for multi-step dialogs (h-2 w-2 rounded-full bg-primary/bg-muted)"
  - "Client-side contractor search filtering with 300ms debounce on server-fetched data"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06]

# Metrics
duration: 14min
completed: 2026-03-22
---

# Phase 8 Plan 02: Payment UI Summary

**Full /payments page with run history table, 3-step new payment run dialog, side panel with status management and D-04 invoice removal, bank statement import, and navigation wiring**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-22T11:35:44Z
- **Completed:** 2026-03-22T11:49:55Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- /payments page with TanStack Table, cursor-based pagination, status filter chips synced to URL via nuqs, date range filter
- Payment run side panel with contextual actions per status (DRAFT/LOCKED/EXPORTED/COMPLETED/CANCELLED), inline mark paid/failed forms, remove-from-run for DRAFT runs (D-04), cancel with D-15 AlertDialog warnings
- 3-step new payment run dialog: invoice selection with filters/group-by-currency (D-02), review with currency-grouped totals and export format selector (D-08), confirmation with base64 file download
- Bank statement import dialog: dropzone for .mt940/.csv, parsing progress, auto-match results with checkbox confirmation
- PaymentRunBadge (5 statuses with icons) and PaymentItemBadge (3 statuses) components

## Task Commits

Each task was committed atomically:

1. **Task 1: /payments page with run history table, side panel, badges** - `b66e4f2` (feat)
2. **Task 2: New payment run dialog (3-step) and bank statement import** - `599a175` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx` - Payments page with Suspense boundary, table, toolbar, side panel, dialogs
- `apps/web/src/components/payments/payment-run-table/columns.tsx` - TanStack Table columns: runNumber, status, createdAt, invoiceCount, totalGrosze, exportFormat, actions
- `apps/web/src/components/payments/payment-run-table/data-table.tsx` - Data table with skeleton loading and cursor pagination
- `apps/web/src/components/payments/payment-run-table/data-table-toolbar.tsx` - Status chip bar and date range filter
- `apps/web/src/components/payments/payment-run-side-panel.tsx` - Sheet 400px with metadata grid, contextual actions, item list with inline forms
- `apps/web/src/components/payments/payment-run-badge.tsx` - PaymentRunBadge and PaymentItemBadge with color maps
- `apps/web/src/components/payments/new-payment-run-dialog/index.tsx` - 3-step dialog controller with step indicator dots
- `apps/web/src/components/payments/new-payment-run-dialog/step-select.tsx` - Invoice selection with currency/date/contractor filters, group-by-currency Switch
- `apps/web/src/components/payments/new-payment-run-dialog/step-review.tsx` - Review with currency groups, export format, Lock & Export CTA
- `apps/web/src/components/payments/new-payment-run-dialog/step-confirmation.tsx` - Success state with download via URL.createObjectURL
- `apps/web/src/components/payments/invoice-selection-table/columns.tsx` - Checkbox table columns with Missing IBAN and In-run badges
- `apps/web/src/components/payments/invoice-selection-table/data-table.tsx` - Selection table with row disable for in-run invoices
- `apps/web/src/components/payments/bank-statement-dialog.tsx` - Upload, parse, match, confirm dialog with progress and error states
- `packages/api/src/routers/integration.ts` - Fixed pre-existing "slack" to "SLACK" enum casing

## Decisions Made
- Used `(dashboard)` route group (existing convention) instead of `(app)` as plan referenced
- Used inline form state approach for per-item mark paid/failed/remove actions instead of Popover-inside-Dropdown (base-ui render prop pattern makes Popover nesting inside DropdownMenuItem impractical)
- Navigation already had Payments item wired from Phase 1 setup -- no changes needed
- Fixed pre-existing integration.ts SLACK enum casing to unblock API build (required for tRPC type generation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed integration.ts SLACK enum casing to unblock API build**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** Pre-existing `"slack"` vs `"SLACK"` enum mismatch in integration.ts prevented API package build, which meant the payment router types were not available in dist
- **Fix:** Changed `provider: "slack"` to `provider: "SLACK"` (correct enum value)
- **Files modified:** packages/api/src/routers/integration.ts
- **Verification:** API package builds clean, payment router types available
- **Committed in:** b66e4f2

**2. [Rule 1 - Bug] Replaced asChild with render prop pattern throughout**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** Plan assumed Radix `asChild` pattern, but project uses base-ui `render` prop pattern
- **Fix:** Replaced all DropdownMenuTrigger, PopoverTrigger, AlertDialogTrigger usage with `render={...}` or `render={(props) => ...}` pattern
- **Files modified:** All payment components
- **Committed in:** b66e4f2, 599a175

**3. [Rule 1 - Bug] Used (dashboard) route group instead of (app)**
- **Found during:** Task 1 (File creation)
- **Issue:** Plan referenced `apps/web/src/app/[locale]/(app)/payments/page.tsx` but actual route group is `(dashboard)`
- **Fix:** Created page at correct path `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx`
- **Files modified:** payments/page.tsx
- **Committed in:** b66e4f2

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing SLACK enum error in integration.ts prevented API dist build, blocking tRPC type propagation to web app. Fixed inline as Rule 3 deviation.

## Known Stubs
None - all components are fully wired to real tRPC mutations and queries. i18n translation keys are hardcoded as English strings (Plan 03 adds actual translations).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full payment UI complete, ready for Plan 03 (i18n translations) and Plan 04 (contractor payments tab, settings)
- All 13 payment-specific components created and wired to tRPC payment router
- Bank statement import flow complete end-to-end

## Self-Check: PASSED

All 13 created files verified present. Both task commits (b66e4f2, 599a175) found in git log.

---
*Phase: 08-payments*
*Completed: 2026-03-22*
