---
phase: 05-invoice-intake-matching
plan: 04
subsystem: ui
tags: [react, next-intl, react-hook-form, zod, date-fns, invoice-detail, match-card, duplicate-warning]

requires:
  - phase: 05-invoice-intake-matching
    provides: "invoiceRouter with getById, update, submitForMatching, manualMatch, voidInvoice, dismissDuplicate, searchContractors, contractsForContractor"
  - phase: 05-invoice-intake-matching
    provides: "Invoice list page with side panel linking to /invoices/[id]"
  - phase: 03-contracts-documents
    provides: "PdfPreview component, document.getDownloadUrl tRPC query, contract detail page pattern"
provides:
  - "Invoice detail page at /invoices/[id] with 60/40 PDF + metadata split layout"
  - "InvoiceMetadataForm with 14 editable fields, save draft, submit for matching, void invoice"
  - "MatchCard with confidence indicator, deviation display, flags, and manual matching UI"
  - "DuplicateWarning banner with dismiss and view original actions"
  - "Invoice detail i18n keys (EN + PL) for detail, match, and duplicate sections"
affects: [05-05, 06-approval-workflow]

tech-stack:
  added: []
  patterns: ["CurrencyInput grosze/PLN display conversion", "DatePicker with base-ui Popover + Calendar", "Contractor search Command picker with debounced query"]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx
    - apps/web/src/components/invoices/invoice-detail/invoice-detail-layout.tsx
    - apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx
    - apps/web/src/components/invoices/invoice-detail/match-card.tsx
    - apps/web/src/components/invoices/invoice-detail/duplicate-warning.tsx
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "base-ui render prop pattern for PopoverTrigger and DropdownMenuTrigger (not Radix asChild)"
  - "CurrencyInput sub-component for grosze<->PLN display conversion with controlled input state"
  - "Placeholder files for Task 2 components to avoid module resolution errors during Task 1 typecheck"

patterns-established:
  - "Invoice detail 60/40 split layout with sticky PDF left and scrollable panel right"
  - "CurrencyInput: stores integer grosze, displays as decimal PLN, converts on blur"
  - "Match confidence dot indicator: green (>=90), amber (50-89), red (<50)"

requirements-completed: [INV-03, INV-04, INV-05, INV-06, INV-07, INV-09, INV-10]

duration: 7min
completed: 2026-03-21
---

# Phase 05 Plan 04: Invoice Detail Page Summary

**Invoice detail page with 60/40 PDF split layout, editable metadata form (14 fields with grosze currency conversion), match card with confidence indicator and manual matching, and duplicate warning banner**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T20:46:55Z
- **Completed:** 2026-03-21T20:54:32Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Invoice detail page at /invoices/[id] with sticky PDF viewer (60%) and scrollable metadata panel (40%), responsive stacking below 1024px
- Editable metadata form with React Hook Form + Zod for 14 fields including currency inputs (grosze/PLN), date pickers, VAT rate select, and bank account IBAN
- Save draft and submit for matching CTAs with Sonner toasts, void invoice with AlertDialog confirmation
- Match card showing confidence indicator (colored dot + score), linked contractor/contract, deviation display with expected vs actual amounts, and flag badges
- Unmatched invoice state with contractor search picker (Command + debounced search) and contract picker for manual matching
- Duplicate warning banner with 3px destructive left border, view original link, and inline dismiss action
- Full i18n coverage for detail, match, and duplicate sections in EN and PL

## Task Commits

Each task was committed atomically:

1. **Task 1: Invoice detail layout, metadata form, and action bar** - `ee5eb9e` (feat)
2. **Task 2: Match card with confidence indicator and manual matching, duplicate warning banner** - `fbbf53e` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` - Invoice detail page route with breadcrumb, header, and layout composition
- `apps/web/src/components/invoices/invoice-detail/invoice-detail-layout.tsx` - 60/40 CSS grid layout with sticky PDF viewer and scrollable panel
- `apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx` - Editable metadata form with 14 fields, currency inputs, date pickers, action bar
- `apps/web/src/components/invoices/invoice-detail/match-card.tsx` - Match results display with confidence, deviation, flags, and manual matching UI
- `apps/web/src/components/invoices/invoice-detail/duplicate-warning.tsx` - Duplicate detection banner with dismiss and view original actions
- `apps/web/messages/en.json` - Added detail, match, and duplicate i18n keys
- `apps/web/messages/pl.json` - Added detail, match, and duplicate i18n keys (Polish)

## Decisions Made
- Used base-ui `render` prop pattern (not Radix `asChild`) for PopoverTrigger and DropdownMenuTrigger, consistent with Phase 2-4 base-ui convention
- Created CurrencyInput sub-component for grosze/PLN display conversion: stores integer grosze internally, displays as decimal PLN string, converts on blur
- Created placeholder files for Task 2 components during Task 1 to avoid module resolution errors during TypeScript verification

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed base-ui render prop pattern**
- **Found during:** Task 1 (metadata form implementation)
- **Issue:** Plan referenced `asChild` pattern on PopoverTrigger and DropdownMenuTrigger, but project uses base-ui which uses `render` prop pattern
- **Fix:** Changed all `asChild` to `render={<Button />}` pattern consistent with other components
- **Files modified:** apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** ee5eb9e (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed base-ui Select null value type**
- **Found during:** Task 1 (metadata form implementation)
- **Issue:** base-ui Select onValueChange callback returns `string | null`, but form fields expect `string | undefined` or `string`
- **Fix:** Added null coalescing (`?? undefined`) and null guard (`if (val)`) for Select onValueChange handlers
- **Files modified:** apps/web/src/components/invoices/invoice-detail/invoice-metadata-form.tsx
- **Verification:** tsc --noEmit passes
- **Committed in:** ee5eb9e (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for TypeScript type compatibility with base-ui components. No scope creep.

## Issues Encountered
None beyond the auto-fixed base-ui type issues documented above.

## Known Stubs
None - all components are fully wired to tRPC queries and mutations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Invoice detail page is the core processing screen, ready for Plan 05 (contractor profile tab and settings)
- Approval workflow (Phase 6) can build on invoice status transitions from this detail page
- Match card and duplicate warning are standalone components reusable in side panel if needed

---
## Self-Check: PASSED
