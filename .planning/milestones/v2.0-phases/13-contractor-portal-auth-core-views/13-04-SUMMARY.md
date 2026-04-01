---
phase: 13-contractor-portal-auth-core-views
plan: 04
subsystem: ui
tags: [react, next.js, portal, trpc, dashboard, contracts, documents, payments, shadcn]

# Dependency graph
requires:
  - phase: 13-contractor-portal-auth-core-views
    plan: 02
    provides: "Portal tRPC router with 15 endpoints (overview, listContracts, getContract, listDocuments, listPayments, getSession)"
  - phase: 13-contractor-portal-auth-core-views
    plan: 03
    provides: "Portal layout, top bar, login flow, session management"
provides:
  - "Overview dashboard page with summary cards, quick actions, activity log"
  - "Contracts list page with card grid layout"
  - "Contract detail page with read-only fields and document downloads"
  - "Documents list page with table and download buttons"
  - "Payments list page with minimal info (no internal IDs)"
  - "SummaryCard and ContractCard reusable portal components"
affects: [13-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal pages use useQuery(trpc.portal.*.queryOptions()) pattern for data fetching"
    - "Grosze-to-currency formatting with Intl.NumberFormat across all portal money displays"
    - "SummaryCard and ContractCard as reusable portal components in components/portal/"

key-files:
  created:
    - apps/web/src/components/portal/summary-card.tsx
    - apps/web/src/components/portal/contract-card.tsx
    - apps/web/src/app/[locale]/(portal)/page.tsx
    - apps/web/src/app/[locale]/(portal)/contracts/page.tsx
    - apps/web/src/app/[locale]/(portal)/contracts/[id]/page.tsx
    - apps/web/src/app/[locale]/(portal)/documents/page.tsx
    - apps/web/src/app/[locale]/(portal)/payments/page.tsx
  modified: []

key-decisions:
  - "Built API package before TS check to generate portal router types (dist/index.d.ts)"
  - "Used Intl.NumberFormat for all currency formatting to respect locale and currency codes"

patterns-established:
  - "Portal page pattern: useQuery for tRPC data, loading skeletons, empty states with UI-SPEC copy"
  - "Contract status badge mapping: ACTIVE -> default, EXPIRING -> outline, EXPIRED -> secondary"
  - "DetailField sub-component pattern for read-only labeled field pairs"

requirements-completed: [PORT-02, PORT-04, PORT-05]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 13 Plan 04: Portal Content Pages Summary

**Overview dashboard with 4 summary cards and activity log, contracts list/detail with document downloads, documents table, and payments table -- all consuming portal tRPC router with loading skeletons and empty states**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T15:01:26Z
- **Completed:** 2026-03-23T15:05:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Overview dashboard with greeting, 4 metric summary cards (Active Contracts, Pending Invoices, Recent Payments, Next Deadline), quick action buttons, and recent activity list
- Contracts list with card grid (2 cols desktop, 1 col mobile) and contract detail with read-only fields, rate periods table, and document download section
- Documents table with name, type badge, file size, date, and download button per row
- Payments table with invoice number, amount, date, and "Paid" badge -- no internal IDs exposed (D-12 compliance)
- SummaryCard and ContractCard as reusable components with skeleton loading variants

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SummaryCard, ContractCard, and overview dashboard page** - `7b24574` (feat)
2. **Task 2: Create contracts list/detail, documents, and payments pages** - `7534cbe` (feat)

## Files Created/Modified
- `apps/web/src/components/portal/summary-card.tsx` - SummaryCard with icon/label/value display and SummaryCardSkeleton
- `apps/web/src/components/portal/contract-card.tsx` - ContractCard with status badge, date range, rate formatting, and ContractCardSkeleton
- `apps/web/src/app/[locale]/(portal)/page.tsx` - Overview dashboard with greeting, summary cards, quick actions, activity log
- `apps/web/src/app/[locale]/(portal)/contracts/page.tsx` - Contracts list with card grid and empty state
- `apps/web/src/app/[locale]/(portal)/contracts/[id]/page.tsx` - Contract detail with fields grid, rate periods, documents
- `apps/web/src/app/[locale]/(portal)/documents/page.tsx` - Documents table with download buttons and empty state
- `apps/web/src/app/[locale]/(portal)/payments/page.tsx` - Payments table with minimal columns and empty state

## Decisions Made
- Built API package (pnpm --filter @contractor-ops/api build) to regenerate dist types so portal router is visible to web app TypeScript
- Used Intl.NumberFormat with currency style for all grosze-to-display formatting, consistent across all portal money displays
- Used next/navigation useRouter for payments row click navigation (programmatic push) rather than wrapping table rows in Link

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Built API package to resolve portal router types**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** trpc.portal.* not recognized because API package dist/ was stale and didn't include the portal router added in plan 13-02
- **Fix:** Ran `pnpm --filter @contractor-ops/api build` to regenerate dist/index.d.ts with portal router types
- **Files modified:** packages/api/dist/ (generated build output)
- **Verification:** TypeScript compilation passes for all portal page files
- **Committed in:** Not committed (build artifacts in dist/)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard build step needed for type resolution in monorepo. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in login/verify pages (plan 13-03) related to Date type mismatch -- out of scope
- Pre-existing TypeScript errors in oauth callback, webhooks, import wizard -- out of scope

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all pages are fully wired to portal tRPC endpoints with real data queries.

## Next Phase Readiness
- All 5 portal content pages complete, ready for plan 13-05 (invoice submission flow)
- SummaryCard and ContractCard components available for reuse
- Portal tRPC router fully consumed: overview, listContracts, getContract, listDocuments, listPayments, getSession

## Self-Check: PASSED

- All 7 created files verified present on disk
- Both task commits (7b24574, 7534cbe) verified in git log

---
*Phase: 13-contractor-portal-auth-core-views*
*Completed: 2026-03-23*
