---
phase: 47-vat-engine-wht-calculator-country-fields
plan: 06
subsystem: api
tags: [reverse-charge, vat, invoice-matching, cleanup]

# Dependency graph
requires:
  - phase: 47-05
    provides: "Canonical plural-directory UI components for VAT/WHT/country fields"
  - phase: 47-01
    provides: "reverse-charge.service.ts with applyReverseCharge function"
provides:
  - "Reverse charge auto-detection wired into invoice matching flow (submitForMatching + manualMatch)"
  - "Clean component file structure with no singular-directory duplicates"
affects: [48-zatca-fatoorah-integration, invoice-matching]

# Tech tracking
tech-stack:
  added: []
  patterns: [reverse-charge-on-match]

key-files:
  created: []
  modified:
    - packages/api/src/routers/invoice.ts

key-decisions:
  - "Reverse charge runs before transaction in both mutations to avoid holding DB locks during external lookups"
  - "submitForMatching passes reverseChargeOverride from existing invoice; manualMatch does not (fresh detection)"

patterns-established:
  - "reverse-charge-on-match: applyReverseCharge called whenever contractorId is assigned to an invoice"

requirements-completed: [TAX-02]

# Metrics
duration: 2min
completed: 2026-04-11
---

# Phase 47 Plan 06: Reverse Charge Wiring & Duplicate Cleanup Summary

**Wired applyReverseCharge into both auto-match and manual-match invoice flows, removed 5 duplicate singular-directory component files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-11T17:09:21Z
- **Completed:** 2026-04-11T17:11:30Z
- **Tasks:** 2
- **Files modified:** 1 modified, 5 deleted

## Accomplishments
- Reverse charge auto-detection now runs when invoices are matched to contractors (both auto and manual flows)
- TAX-02 gap closed: applyReverseCharge was imported but never called -- now active in both submitForMatching and manualMatch
- Removed 5 duplicate component files from singular directories (invoice/, contractor/, payment/) keeping only canonical plural versions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire applyReverseCharge into submitForMatching and manualMatch mutations** - `1804c0e` (feat)
2. **Task 2: Remove duplicate singular-directory component files** - `9d926ff` (chore)

## Files Created/Modified
- `packages/api/src/routers/invoice.ts` - Added applyReverseCharge calls in submitForMatching (with override) and manualMatch mutations
- `apps/web/src/components/invoice/vat-rate-selector.tsx` - Deleted (canonical: invoices/)
- `apps/web/src/components/invoice/reverse-charge-banner.tsx` - Deleted (canonical: invoices/)
- `apps/web/src/components/contractor/country-compliance-section.tsx` - Deleted (canonical: contractors/)
- `apps/web/src/components/payment/wht-summary-card.tsx` - Deleted (canonical: payments/)
- `apps/web/src/components/payment/wht-certificate-preview-dialog.tsx` - Deleted (canonical: payments/)

## Decisions Made
- Reverse charge detection runs before the Prisma transaction (not inside) to avoid holding transaction locks during async org/contractor lookups
- submitForMatching passes `reverseChargeOverride` from existing invoice data to respect user overrides; manualMatch does fresh detection without override

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reverse charge auto-detection is fully wired -- invoices matched to contractors will have isReverseCharge set automatically
- All component files are in canonical plural directories only -- no more import ambiguity

---
*Phase: 47-vat-engine-wht-calculator-country-fields*
*Completed: 2026-04-11*

## Self-Check: PASSED
