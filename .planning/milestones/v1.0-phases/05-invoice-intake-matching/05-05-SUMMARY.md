---
phase: 05-invoice-intake-matching
plan: 05
subsystem: ui
tags: [react, next-intl, trpc, tanstack-table, i18n, settings]

requires:
  - phase: 05-03
    provides: Invoice table components, columns, data-table, toolbar, pagination
  - phase: 05-04
    provides: Invoice side panel, detail form, match card, duplicate warning
provides:
  - Contractor profile Invoices tab with pre-filtered invoice table
  - Settings Invoice Matching section with email inbox and deviation threshold
  - Full EN+PL translations for all invoice UI components
affects: [06-approval-workflow, 08-payments]

tech-stack:
  added: []
  patterns:
    - "Contractor tab as prop-injected content (invoicesContent prop on ProfileTabs)"
    - "Settings card pattern reused for invoice matching section"
    - "getInvoiceSettings/updateInvoiceSettings procedures for settingsJson"

key-files:
  created:
    - apps/web/src/components/contractors/contractor-profile/tabs/invoices-tab.tsx
    - apps/web/src/components/settings/invoice-matching-settings.tsx
  modified:
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - packages/api/src/routers/settings.ts
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Contractor invoices tab follows prop-injection pattern (invoicesContent) consistent with other tabs"
  - "Settings router extended with getInvoiceSettings/updateInvoiceSettings for settingsJson deviation threshold"
  - "Org slug exposed in settings.get for invoice email address generation"

patterns-established:
  - "Settings card pattern: Card with query+mutation for settingsJson sub-keys (ExpiryReminderDefaults, InvoiceMatchingSettings)"

requirements-completed: [INV-10, INV-06]

duration: 6min
completed: 2026-03-21
---

# Phase 05 Plan 05: Invoice UI Integration and i18n Summary

**Contractor invoices tab with pre-filtered table, settings invoice matching section with copyable email and deviation threshold, full EN+PL translations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T21:17:00Z
- **Completed:** 2026-03-21T21:23:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Contractor profile Invoices tab replaces TabPlaceholder with pre-filtered invoice table and upload dialog
- Settings page Invoice Matching section with one-click copyable email inbox address and configurable deviation threshold
- Full i18n coverage for invoice tab and settings section in both EN and PL

## Task Commits

Each task was committed atomically:

1. **Task 1: Contractor profile Invoices tab and Settings invoice matching section** - `3373685` (feat)
2. **Task 2: Full i18n translations for all invoice UI (EN + PL)** - `a200d2d` (feat)

## Files Created/Modified
- `apps/web/src/components/contractors/contractor-profile/tabs/invoices-tab.tsx` - Contractor profile Invoices tab with pre-filtered table and upload dialog
- `apps/web/src/components/settings/invoice-matching-settings.tsx` - Settings Invoice Matching card with email inbox copy and deviation threshold
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - Added invoicesContent prop, removed TabPlaceholder for invoices
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Pass InvoicesTab as invoicesContent prop
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added InvoiceMatchingSettings to general tab
- `packages/api/src/routers/settings.ts` - Added getInvoiceSettings/updateInvoiceSettings procedures, exposed slug in get
- `apps/web/messages/en.json` - Added Invoices.tab namespace and Settings invoice matching keys
- `apps/web/messages/pl.json` - Added Invoices.tab namespace and Settings invoice matching keys (Polish)

## Decisions Made
- Contractor invoices tab follows the existing prop-injection pattern (invoicesContent prop on ProfileTabs) consistent with contracts, documents, workflows tabs
- Settings router extended with dedicated getInvoiceSettings/updateInvoiceSettings procedures for clean settingsJson access
- Org slug exposed in settings.get response for generating the invoice email address (invoices@{slug}.contractorhub.io)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added getInvoiceSettings/updateInvoiceSettings procedures to settings router**
- **Found during:** Task 1 (Settings invoice matching section)
- **Issue:** Plan referenced trpc.settings.update for deviation threshold but existing settings.update uses Better Auth org metadata, not settingsJson
- **Fix:** Added dedicated getInvoiceSettings/updateInvoiceSettings procedures following the same pattern as getExpiryReminderDefaults/updateExpiryReminderDefaults
- **Files modified:** packages/api/src/routers/settings.ts
- **Verification:** TypeScript compiles clean, procedure accessible from web app
- **Committed in:** 3373685 (Task 1 commit)

**2. [Rule 3 - Blocking] Exposed org slug in settings.get response**
- **Found during:** Task 1 (Settings invoice matching section)
- **Issue:** Invoice email requires org slug but settings.get only returned id, name, metadata
- **Fix:** Added slug to settings.get return object
- **Files modified:** packages/api/src/routers/settings.ts
- **Verification:** TypeScript compiles clean
- **Committed in:** 3373685 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for the settings section to function. No scope creep.

## Issues Encountered
- API package dist needed rebuild after settings router changes for web app type inference to pick up new procedures

## Known Stubs
None - all components are wired to real data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 05 complete: invoice intake, matching, detail views, and integration all done
- Ready for Phase 06 (Approval Workflow) which builds on invoice status pipeline

---
*Phase: 05-invoice-intake-matching*
*Completed: 2026-03-21*
