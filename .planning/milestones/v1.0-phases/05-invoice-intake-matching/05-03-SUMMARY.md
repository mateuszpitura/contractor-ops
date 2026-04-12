---
phase: 05-invoice-intake-matching
plan: 03
subsystem: ui
tags: [tanstack-table, nuqs, react, next-intl, invoice, side-panel, upload, status-chips]

requires:
  - phase: 05-invoice-intake-matching
    provides: "invoiceRouter with list, statusCounts, create tRPC procedures"
  - phase: 03-contracts-documents
    provides: "Contract table pattern (columns, data-table, toolbar, filters, pagination, use-filters), DropZone component, Sheet side panel pattern"
  - phase: 02-contractor-registry
    provides: "nuqs URL state management pattern, Suspense boundary for SSG"
provides:
  - "Invoice list page at /invoices with TanStack Table, status chip bar, side panel, upload area"
  - "InvoiceDataTable component with 11 columns, server-side pagination/sorting/filtering"
  - "StatusChipBar with live counts from trpc.invoice.statusCounts"
  - "InvoiceSidePanel (480px Sheet) with amounts, dates, matching sections"
  - "InvoiceUploadArea with multi-file PDF upload, per-file progress, retry"
  - "Invoices i18n namespace (EN + PL)"
affects: [05-04, 05-05, 06-approval-workflow]

tech-stack:
  added: []
  patterns: ["Invoice status badge config with icon per status", "Match status dot indicator", "Collapsible upload area toggled by toolbar CTA"]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx
    - apps/web/src/components/invoices/invoice-table/columns.tsx
    - apps/web/src/components/invoices/invoice-table/data-table.tsx
    - apps/web/src/components/invoices/invoice-table/data-table-toolbar.tsx
    - apps/web/src/components/invoices/invoice-table/data-table-filters.tsx
    - apps/web/src/components/invoices/invoice-table/data-table-pagination.tsx
    - apps/web/src/components/invoices/invoice-table/use-invoice-filters.ts
    - apps/web/src/components/invoices/status-chip-bar.tsx
    - apps/web/src/components/invoices/invoice-side-panel.tsx
    - apps/web/src/components/invoices/invoice-upload-area.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Mirrored contract-table pattern exactly for invoice-table consistency"
  - "Status chip bar filters by matchStatus URL param, not invoice status"
  - "Upload area uses inline useDropzone (not DropZone component) for custom per-file progress and invoice.create integration"

patterns-established:
  - "Invoice status badge config map with Lucide icon per status enum value"
  - "Match status 8px colored dot indicator pattern"
  - "Collapsible upload area controlled by toolbar CTA button"

requirements-completed: [INV-01, INV-08, INV-10]

duration: 7min
completed: 2026-03-21
---

# Phase 05 Plan 03: Invoice List Page Summary

**Invoice list page with TanStack Table (11 columns), status chip bar with live counts, slide-out side panel, and multi-file PDF upload area with per-file progress**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T20:36:58Z
- **Completed:** 2026-03-21T20:43:58Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Invoice TanStack Table with 11 columns (monospace invoice #, contractor link, currency formatting, status badges with icons, match status dots, source icons), server-side pagination/sorting/filtering, and overdue row highlighting
- Status chip bar with 8 chips showing live counts from trpc.invoice.statusCounts, URL-synced via nuqs
- Invoice side panel (480px Sheet) with amounts, dates, matching sections, and "Open invoice" CTA
- Multi-file PDF upload area with per-file presigned URL upload, progress bars, retry on failure, and invoice draft creation
- Full Invoices i18n namespace in EN and PL with all copy from UI-SPEC

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice TanStack Table with columns, filters, pagination, status chip bar** - `4441255` (feat)
2. **Task 2: Invoice page, side panel, upload area** - `1ec8c26` (feat)

## Files Created/Modified
- `apps/web/src/components/invoices/invoice-table/use-invoice-filters.ts` - nuqs URL state for invoice filters
- `apps/web/src/components/invoices/invoice-table/columns.tsx` - 11 column definitions with status badges, match dots, source icons
- `apps/web/src/components/invoices/invoice-table/data-table.tsx` - TanStack Table with server-side data, overdue highlighting
- `apps/web/src/components/invoices/invoice-table/data-table-toolbar.tsx` - Search (300ms debounce), filters, upload CTA
- `apps/web/src/components/invoices/invoice-table/data-table-filters.tsx` - Status and source multi-select filters
- `apps/web/src/components/invoices/invoice-table/data-table-pagination.tsx` - Page size (10/25/50), prev/next navigation
- `apps/web/src/components/invoices/status-chip-bar.tsx` - Clickable status chips with live counts
- `apps/web/src/components/invoices/invoice-side-panel.tsx` - 480px Sheet with invoice summary
- `apps/web/src/components/invoices/invoice-upload-area.tsx` - Multi-file PDF upload with progress and retry
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` - Invoice list page with Suspense
- `apps/web/messages/en.json` - Added Invoices namespace (EN)
- `apps/web/messages/pl.json` - Added Invoices namespace (PL)

## Decisions Made
- Mirrored contract-table pattern exactly for invoice-table (same file structure, component patterns, styling)
- Status chip bar filters by matchStatus URL param rather than invoice status, since chips represent the matching pipeline stages
- Used inline useDropzone instead of reusing DropZone component because the upload area needs custom per-file progress tracking and automatic invoice.create mutation after each upload

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `resend-inbound/route.ts` (from parallel plan 05-02) -- not caused by this plan's changes, excluded from verification

## Known Stubs
None - all components are fully wired to tRPC queries and mutations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Invoice list page is the main entry point for invoice management
- Plans 04-05 can build invoice detail page and contractor profile tab on top of this
- Side panel links to /invoices/[id] which will be built in plan 04

---
## Self-Check: PASSED

All 10 created files verified present. Both commits (4441255, 1ec8c26) verified in git log.

---
*Phase: 05-invoice-intake-matching*
*Completed: 2026-03-21*
