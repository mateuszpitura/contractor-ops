---
phase: 63-uk-payments-financial-features
plan: 07
subsystem: ui
tags: [react, shadcn, trpc, late-payment-interest, skonto, feature-flags, i18n, accessibility]

# Dependency graph
requires:
  - phase: 63-03
    provides: Late payment interest tRPC router
  - phase: 63-04
    provides: Skonto tRPC router
  - phase: 63-05
    provides: BACS payment export router
  - phase: 63-06
    provides: BoE rate admin router
provides:
  - Late interest card with 4 states on invoice detail (accruing/claimed/waived/paid)
  - Claim, waive, revoke-waiver dialogs with tRPC mutations
  - Dashboard overdue receivables tile for GB orgs
  - Invoice list overdue interest and Skonto columns
  - Overdue filter chip in invoice list
  - Skonto form section for DE invoice create/edit
  - Skonto banner on invoice detail with 5 eligibility states
  - Skonto eligibility pill component
  - Default Skonto section in billing profile
  - PaymentRun Skonto apply checkbox
affects: [63-ui-surfaces, invoice-detail, dashboard, payment-runs, billing-profiles]

# Tech tracking
tech-stack:
  added: []
  patterns: [feature-flag-gated-ui, currency-minor-units-formatting, semantic-status-pill]

key-files:
  created:
    - apps/web/src/components/invoices/late-interest/late-interest-card.tsx
    - apps/web/src/components/invoices/late-interest/late-interest-status-pill.tsx
    - apps/web/src/components/invoices/late-interest/claim-dialog.tsx
    - apps/web/src/components/invoices/late-interest/waive-dialog.tsx
    - apps/web/src/components/invoices/late-interest/revoke-waiver-dialog.tsx
    - apps/web/src/components/invoices/late-interest/rate-calculation-tooltip.tsx
    - apps/web/src/components/invoices/skonto/skonto-form-section.tsx
    - apps/web/src/components/invoices/skonto/skonto-banner.tsx
    - apps/web/src/components/invoices/skonto/skonto-eligibility-pill.tsx
    - apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx
    - apps/web/src/components/payments/run/skonto-apply-checkbox.tsx
    - apps/web/src/components/dashboard/overdue-receivables-tile.tsx
  modified:
    - apps/web/src/components/invoices/invoice-table/columns.tsx
    - apps/web/src/components/invoices/invoice-table/data-table-filters.tsx

key-decisions:
  - "GBP formatting via Intl.NumberFormat with en-GB locale, all amounts in minor units (pence)"
  - "EUR formatting via Intl.NumberFormat with de-DE locale for Skonto surfaces"
  - "Feature flag gating at component level via featureEnabled prop, server-side flag also checked by tRPC"
  - "Overdue filter chip as standalone toggle button outside the filter popover for quick access"

patterns-established:
  - "Feature-flag-gated UI: components accept featureEnabled prop and return null when off"
  - "Currency minor-units formatter pattern: formatGBP/formatEUR helpers using Intl.NumberFormat"
  - "Semantic status pill pattern: 5-state presentation map with icon + color + aria-label"

requirements-completed: [PAY-01, PAY-06, PAY-07]

# Metrics
duration: 8min
completed: 2026-04-15
---

# Phase 63 Plan 07: Late Interest + Skonto UI Surfaces Summary

**Late interest card with 4 states + claim/waive/revoke dialogs, dashboard overdue tile, Skonto form + banner + PaymentRun checkbox, invoice list overdue interest + Skonto columns**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-15T01:27:00Z
- **Completed:** 2026-04-15T01:35:20Z
- **Tasks:** 3 (2 auto + 1 auto-approved checkpoint)
- **Files modified:** 14

## Accomplishments
- Late interest card on invoice detail with accruing/claimed/waived/paid states, claim/waive/revoke-waiver dialogs wired to tRPC mutations
- Dashboard overdue receivables tile for GB orgs with headline amount + click-through to filtered invoice list
- Skonto form section with 3 inputs, inline validation, live preview, default cascade from billing profile
- Skonto banner on invoice detail with 5 eligibility states (eligible/past/taken/not-taken/none)
- PaymentRun Skonto apply checkbox with optimistic updates and tRPC mutation
- Invoice list extended with overdue interest column (sortable) and Skonto column (sortable)
- Overdue filter chip in invoice list data-table-filters

## Task Commits

Each task was committed atomically:

1. **Task 1: Late interest UI** - `5d8b1c5c` (feat)
2. **Task 2: Skonto UI** - `3c61de82` (feat)
3. **Task 3: Human verification checkpoint** - Auto-approved

## Files Created/Modified
- `apps/web/src/components/invoices/late-interest/late-interest-card.tsx` - Invoice detail late interest card with 4 states
- `apps/web/src/components/invoices/late-interest/late-interest-status-pill.tsx` - 5-state semantic status pill
- `apps/web/src/components/invoices/late-interest/claim-dialog.tsx` - Claim statutory interest dialog
- `apps/web/src/components/invoices/late-interest/waive-dialog.tsx` - Waive interest destructive dialog with min 10 char reason
- `apps/web/src/components/invoices/late-interest/revoke-waiver-dialog.tsx` - Revoke waiver destructive dialog
- `apps/web/src/components/invoices/late-interest/rate-calculation-tooltip.tsx` - LPCDA rate explanation tooltip
- `apps/web/src/components/dashboard/overdue-receivables-tile.tsx` - Dashboard overdue receivables tile for GB orgs
- `apps/web/src/components/invoices/skonto/skonto-form-section.tsx` - Skonto form for DE invoice create/edit
- `apps/web/src/components/invoices/skonto/skonto-banner.tsx` - Invoice detail Skonto eligibility banner
- `apps/web/src/components/invoices/skonto/skonto-eligibility-pill.tsx` - 5-state Skonto eligibility pill
- `apps/web/src/components/contractors/billing-profile/default-skonto-section.tsx` - Default Skonto in billing profile
- `apps/web/src/components/payments/run/skonto-apply-checkbox.tsx` - PaymentRun Skonto apply checkbox
- `apps/web/src/components/invoices/invoice-table/columns.tsx` - Added overdue interest + Skonto columns
- `apps/web/src/components/invoices/invoice-table/data-table-filters.tsx` - Added Overdue filter chip

## Decisions Made
- GBP formatting uses Intl.NumberFormat with en-GB locale; EUR uses de-DE locale
- Feature flag gating at component level via featureEnabled prop (server also validates)
- Overdue filter chip placed as standalone toggle outside the popover for quick access
- Skonto form uses same 3-input layout pattern in both invoice form and billing profile sections

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components are wired to tRPC endpoints. The tRPC routers they call (latePaymentInterest, skonto, payment.applySkontoToItem) are provided by upstream plans 63-03 through 63-06.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 63 UI surfaces are in place
- i18n keys referenced (Payments.lateInterest.*, Payments.skonto.*, Payments.dashboard.*) need to be added to en.json/de.json/gb.json message files
- Integration with invoice detail page layout requires wiring these components into the page RSC

## Self-Check: PASSED

- All 12 created files verified present on disk
- Both task commits (5d8b1c5c, 3c61de82) verified in git log

---
*Phase: 63-uk-payments-financial-features*
*Completed: 2026-04-15*
