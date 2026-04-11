---
phase: 47-vat-engine-wht-calculator-country-fields
plan: 07
subsystem: ui
tags: [trpc, vat-rate, reverse-charge, wht, country-compliance, dashboard, component-integration]

# Dependency graph
requires:
  - phase: 47-05
    provides: "Orphaned UI components (VatRateSelector, ReverseChargeBanner, WhtSummaryCard, TaxObligationsWidget, CountryComplianceSection)"
  - phase: 47-06
    provides: "Clean component file structure with no singular-directory duplicates"
provides:
  - "All Phase 47 UI components integrated into their parent pages"
  - "Broken tRPC and format imports fixed across all 6 components"
  - "VatRateSelector replaces hardcoded VAT dropdown in invoice form"
affects: [invoice-detail, payment-run, dashboard, contractor-profile]

# Tech tracking
tech-stack:
  added: []
  patterns: [component-integration-into-pages]

key-files:
  created: []
  modified:
    - apps/web/src/components/invoices/vat-rate-selector.tsx
    - apps/web/src/components/invoices/reverse-charge-banner.tsx
    - apps/web/src/components/payments/wht-summary-card.tsx
    - apps/web/src/components/payments/wht-certificate-preview-dialog.tsx
    - apps/web/src/components/dashboard/tax-obligations-widget.tsx
    - apps/web/src/components/contractors/country-compliance-section.tsx
    - apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - apps/web/src/components/payments/payment-run-side-panel.tsx
    - apps/web/src/app/[locale]/(dashboard)/page.tsx
    - apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx

key-decisions:
  - "Fixed all tRPC imports from @/lib/trpc and @/trpc/react to @/trpc/init (codebase standard)"
  - "Fixed formatMinorAmount to formatMinorUnits from @/lib/format-currency"
  - "VatRateSelector replaces hardcoded getVatRateOptions with dynamic country-specific rates"

patterns-established:
  - "Component integration: import + conditional render with self-hiding pattern (component returns null when data not applicable)"

requirements-completed: [TAX-01, TAX-02, TAX-03, TAX-04, TAX-05, PROF-01, PROF-02, PROF-03, PROF-04]

# Metrics
duration: 5min
completed: 2026-04-11
---

# Plan 47-07: UI Component Integration Summary

**Fixed broken imports in 6 orphaned components and wired all Phase 47 UI into parent pages — VatRateSelector in invoice form, ReverseChargeBanner on invoice detail, WhtSummaryCard in payment panel, TaxObligationsWidget on dashboard, CountryComplianceSection in contractor profile**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-11T13:09:24Z
- **Completed:** 2026-04-11T13:14:00Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments
- Fixed broken tRPC imports (`@/lib/trpc`, `@/trpc/react` → `@/trpc/init`) and format imports (`formatMinorAmount` → `formatMinorUnits`) in all 6 components
- VatRateSelector integrated into invoice metadata form, replacing hardcoded PL-only rate dropdown
- ReverseChargeBanner renders conditionally on invoice detail when isReverseCharge is true
- WhtSummaryCard renders in payment run side panel (self-hides when no WHT items)
- TaxObligationsWidget renders on main dashboard in right column
- CountryComplianceSection renders in contractor compliance tab (self-hides when no country fields)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix broken imports in all 6 orphaned components** - `dec02cf` (fix)
2. **Task 2: Integrate VatRateSelector into invoice metadata form** - `457c354` (feat)
3. **Task 3: Integrate ReverseChargeBanner, WhtSummaryCard, TaxObligationsWidget, CountryComplianceSection into pages** - `ee0c9b0` (feat)

## Files Created/Modified
- `apps/web/src/components/invoices/vat-rate-selector.tsx` - Fixed tRPC import, api→trpc rename
- `apps/web/src/components/invoices/reverse-charge-banner.tsx` - Fixed tRPC import
- `apps/web/src/components/payments/wht-summary-card.tsx` - Fixed tRPC and format imports
- `apps/web/src/components/payments/wht-certificate-preview-dialog.tsx` - Fixed format import
- `apps/web/src/components/dashboard/tax-obligations-widget.tsx` - Fixed tRPC import
- `apps/web/src/components/contractors/country-compliance-section.tsx` - Fixed tRPC import
- `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx` - Replaced hardcoded VAT dropdown with VatRateSelector
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - Added ReverseChargeBanner
- `apps/web/src/components/payments/payment-run-side-panel.tsx` - Added WhtSummaryCard
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` - Added TaxObligationsWidget
- `apps/web/src/components/contractors/contractor-profile/tab-compliance.tsx` - Added CountryComplianceSection

## Decisions Made
- All components use self-hiding pattern (return null when data not applicable) so they can be rendered unconditionally
- ReverseChargeBanner uses onToggle callback to invalidate invoice query after toggle

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 47 UI components are now visible to users in their correct locations
- Tax infrastructure is complete for PL/UAE/SA markets

## Self-Check: PASSED

All 11 modified files verified present. All 3 task commits verified (dec02cf, 457c354, ee0c9b0).

---
*Phase: 47-vat-engine-wht-calculator-country-fields*
*Completed: 2026-04-11*
