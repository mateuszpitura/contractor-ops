---
phase: 03-contracts-documents
plan: 03
subsystem: ui
tags: [tanstack-table, nuqs, trpc, react, next-intl, sheet, side-panel]

# Dependency graph
requires:
  - phase: 03-01
    provides: Contract tRPC router with list, create, bulkTransition endpoints
  - phase: 02-02
    provides: Contractor table pattern (columns, data-table, toolbar, filters, pagination, bulk actions, column toggle, nuqs filters hook)
provides:
  - Contract list page at /contracts with TanStack Table
  - Contract side panel component for row-click summary
  - URL-synced contract filter state via nuqs
  - Contract table columns, toolbar, filters, pagination, bulk actions, column toggle
affects: [03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [contract-table mirroring contractor-table pattern, contract side panel mirroring contractor side panel]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx
    - apps/web/src/components/contracts/contract-table/columns.tsx
    - apps/web/src/components/contracts/contract-table/data-table.tsx
    - apps/web/src/components/contracts/contract-table/data-table-toolbar.tsx
    - apps/web/src/components/contracts/contract-table/data-table-filters.tsx
    - apps/web/src/components/contracts/contract-table/data-table-pagination.tsx
    - apps/web/src/components/contracts/contract-table/data-table-bulk-actions.tsx
    - apps/web/src/components/contracts/contract-table/data-table-column-toggle.tsx
    - apps/web/src/components/contracts/contract-table/use-contract-filters.ts
    - apps/web/src/components/contracts/contract-side-panel.tsx
  modified: []

key-decisions:
  - "Mirrored contractor table pattern exactly for consistency across the codebase"
  - "End date tooltip shows days remaining/expired with color coding for at-a-glance status"
  - "Export bulk action shows toast placeholder (export router not yet implemented)"

patterns-established:
  - "Contract table follows identical structure to contractor table (columns, data-table, toolbar, filters, pagination, bulk actions, column toggle)"
  - "Status badge colors per UI-SPEC: Draft=muted, Active=green, Expiring=amber, Expired=red, Terminated=muted, Superseded=muted/50%"

requirements-completed: [CNTR-01, CNTR-03]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 3 Plan 3: Contract List Page Summary

**Contract list page with TanStack Table (12 columns, FTS search, multi-facet filters, pagination, bulk actions) and slide-out side panel on row click**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T14:10:12Z
- **Completed:** 2026-03-20T14:16:47Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Full contract list page at /contracts with 12-column TanStack Table (select, title, contractor, type, status, start date, end date, rate, currency, billing cycle, owner, compliance risk)
- URL-synced filter state via nuqs with server-side pagination, sorting, and multi-facet filtering
- Slide-out side panel (480px) with contract summary, key dates with days-remaining, and "Open contract" CTA
- Bulk actions toolbar with export dropdown and terminate confirmation dialog

## Task Commits

Each task was committed atomically:

1. **Task 1: Contract TanStack Table with columns, filters, pagination, bulk actions, and URL state** - `008394c` (feat)
2. **Task 2: Contract side panel with summary and Open contract CTA** - `13097ac` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx` - Contract list page route with Suspense boundary
- `apps/web/src/components/contracts/contract-table/columns.tsx` - 12 column definitions with status badges, rate formatting, date tooltips
- `apps/web/src/components/contracts/contract-table/data-table.tsx` - TanStack Table with manualPagination/Sorting/Filtering via tRPC
- `apps/web/src/components/contracts/contract-table/data-table-toolbar.tsx` - Search (300ms debounce), filters, "New contract" CTA
- `apps/web/src/components/contracts/contract-table/data-table-filters.tsx` - Popover with multi-select for status, type, billing model, owner, risk + date range
- `apps/web/src/components/contracts/contract-table/data-table-pagination.tsx` - Page size (10/25/50), prev/next, page indicator
- `apps/web/src/components/contracts/contract-table/data-table-bulk-actions.tsx` - Export CSV/XLSX + terminate with confirmation
- `apps/web/src/components/contracts/contract-table/data-table-column-toggle.tsx` - Column visibility dropdown
- `apps/web/src/components/contracts/contract-table/use-contract-filters.ts` - nuqs useQueryStates hook for URL-synced filters
- `apps/web/src/components/contracts/contract-side-panel.tsx` - Sheet side panel with contract summary and CTA

## Decisions Made
- Mirrored contractor table pattern exactly for codebase consistency
- End date column has tooltip showing days remaining (or days expired with color)
- Export bulk action renders as placeholder toast since export router is not yet implemented for contracts
- Rebuilt API package to ensure contract router types propagate to web app

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rebuilt API package for type resolution**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `trpc.contract` was not resolving because the API dist types did not include the contract router from Plan 03-01
- **Fix:** Ran `pnpm --filter @contractor-ops/api build` to regenerate dist types
- **Files modified:** packages/api/dist/ (generated)
- **Verification:** TypeScript compilation passes cleanly for all new files
- **Committed in:** N/A (build artifact)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for type safety. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in contract-wizard files (Plan 03-04) — not related to this plan, ignored per scope boundary rule

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Contract list page ready for integration with wizard (Plan 03-04)
- Side panel ready for row click interaction
- All i18n keys referenced but not yet added (deferred to Plan 03-06)

## Self-Check: PASSED

All 10 created files verified present. Both task commits (008394c, 13097ac) verified in git log.

---
*Phase: 03-contracts-documents*
*Completed: 2026-03-20*
