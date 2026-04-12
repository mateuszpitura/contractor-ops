---
phase: 08-payments
plan: 03
subsystem: ui
tags: [react, tanstack-table, i18n, next-intl, react-hook-form, zod, trpc]

# Dependency graph
requires:
  - phase: 08-01
    provides: payment router with listByContractor procedure and payment run CRUD
provides:
  - Contractor profile Payments tab with filtered payment history mini table
  - Transfer title template editor in settings with live preview
  - Full i18n Payments namespace (144 keys) in EN and PL
affects: [08-04, 09-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [mini-table-with-client-pagination, template-preview-editor]

key-files:
  created:
    - apps/web/src/components/contractors/contractor-profile/tab-payments.tsx
    - apps/web/src/components/settings/transfer-title-settings.tsx
  modified:
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx
    - apps/web/src/app/[locale]/(dashboard)/settings/page.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "Adapted i18n to project single-file locale structure (en.json/pl.json) instead of plan's separate file approach"
  - "Transfer title settings uses settingsJson merge via settings.update mutation"

patterns-established:
  - "Template preview editor: resolvePreview helper with example values for placeholder replacement"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 08 Plan 03: Contractor Payments Tab, Transfer Title Settings, and Full i18n Summary

**Contractor profile Payments tab with mini TanStack Table, settings transfer title template editor with live preview, and 144-key EN/PL i18n namespace covering all payment UI surfaces**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T11:36:25Z
- **Completed:** 2026-03-22T11:42:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Contractor profile Payments tab replaces placeholder with filtered payment history using listByContractor (Run #, Date, Invoice #, Amount, Status, Reference columns)
- Transfer title template editor in settings with live preview, Zod validation, and settingsJson persistence
- Full Payments i18n namespace with 144 keys covering all UI-SPEC surfaces (page, dialogs, side panel, bank statement, contractor tab, settings, errors, toasts, validation)

## Task Commits

Each task was committed atomically:

1. **Task 1: Contractor profile Payments tab and Settings transfer title template editor** - `22c2d05` (feat)
2. **Task 2: Full i18n translations (EN + PL) for all payment surfaces** - `d48dfe8` (feat)

## Files Created/Modified
- `apps/web/src/components/contractors/contractor-profile/tab-payments.tsx` - Contractor-scoped payment history mini table with client-side pagination
- `apps/web/src/components/settings/transfer-title-settings.tsx` - Transfer title template editor card with live preview
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - Replaced TabPlaceholder with paymentsContent prop
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Wired TabPayments into profile page
- `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` - Added TransferTitleSettings to general tab
- `apps/web/messages/en.json` - Added Payments namespace (144 keys)
- `apps/web/messages/pl.json` - Added Payments namespace (144 keys)

## Decisions Made
- Adapted i18n to project single-file locale structure (en.json/pl.json nested namespaces) instead of plan's separate file/import approach -- project uses dynamic import of single locale JSON per language
- Transfer title settings uses settings.update mutation with settingsJson merge pattern consistent with other settings components

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted i18n file structure to match project conventions**
- **Found during:** Task 2
- **Issue:** Plan specified separate files (apps/web/src/messages/en/Payments.json) and locale index imports (apps/web/src/messages/en.ts), but project uses single monolithic JSON files per locale (apps/web/messages/en.json)
- **Fix:** Added Payments namespace directly to existing en.json and pl.json files
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Verification:** JSON valid, 144 keys per locale
- **Committed in:** d48dfe8

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation to actual project structure. No scope creep.

## Issues Encountered
- Pre-existing TypeScript compilation errors in payment-run-side-panel.tsx and other Plan 08-02 files due to api package build failure (integration.ts has "slack" vs "SLACK" enum case mismatch). These are not caused by this plan and affect all payment UI components equally.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All payment UI surfaces have i18n translations ready
- Contractor profile Payments tab wired to listByContractor procedure
- Transfer title settings ready for bank export configuration
- Ready for Plan 08-04 (verification/polish)

---
*Phase: 08-payments*
*Completed: 2026-03-22*
