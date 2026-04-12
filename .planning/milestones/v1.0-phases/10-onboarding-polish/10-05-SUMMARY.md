---
phase: 10-onboarding-polish
plan: 05
subsystem: ui
tags: [i18n, next-intl, translations, polish, english]

# Dependency graph
requires:
  - phase: 10-02
    provides: "Import wizard components"
  - phase: 10-03
    provides: "Onboarding checklist component"
  - phase: 10-04
    provides: "Command palette and empty state components"
  - phase: 01-04
    provides: "i18n infrastructure with next-intl, locale files"
provides:
  - "Import, Onboarding, EmptyStates, Search i18n namespaces in en.json and pl.json"
  - "All Phase 10 components wired to useTranslations"
  - "Full Polish translations for all Phase 10 surfaces"
affects: [i18n, localization, all-phases-using-locale-files]

# Tech tracking
tech-stack:
  added: []
  patterns: ["useTranslations with namespace isolation per feature area", "TranslateFn prop threading for sub-components"]

key-files:
  modified:
    - "apps/web/messages/en.json"
    - "apps/web/messages/pl.json"
    - "apps/web/src/components/onboarding/onboarding-checklist.tsx"
    - "apps/web/src/components/search/command-palette.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/payments/page.tsx"
    - "apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx"
    - "apps/web/src/components/notifications/notification-center.tsx"

key-decisions:
  - "Aligned translation keys with existing component usage patterns rather than forcing plan-specified keys"
  - "TranslateFn prop threading for onboarding StepItem and CollapsedBar sub-components"

patterns-established:
  - "Empty state i18n: useTranslations('EmptyStates') aliased as te in page components"
  - "Step key pattern: stepKey string maps to steps.{key}.title/description/cta namespace"

requirements-completed: [IMP-01, IMP-02, IMP-03, ONBD-01, ONBD-02, SRCH-01, SRCH-02]

# Metrics
duration: 9min
completed: 2026-03-23
---

# Phase 10 Plan 05: i18n Support Summary

**Full English + Polish i18n for all Phase 10 surfaces: import wizard, onboarding checklist, empty states, and command palette via 4 new translation namespaces**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-23T09:21:28Z
- **Completed:** 2026-03-23T09:30:13Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Added 4 new i18n namespaces (Import, Onboarding, EmptyStates, Search) to both en.json and pl.json with complete Polish translations from UI-SPEC copywriting contract
- Wired useTranslations into onboarding checklist and command palette, replacing all hardcoded English strings
- Connected EmptyStates namespace to 7 list pages (contractors, contracts, invoices, workflows, payments, approvals, notifications)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add i18n namespaces to locale files** - `1c1dfc9` (feat)
2. **Task 2: Wire i18n into all Phase 10 components** - `c0938cd` (feat)

## Files Created/Modified
- `apps/web/messages/en.json` - Added Import, Onboarding, EmptyStates, Search namespaces with all English copy
- `apps/web/messages/pl.json` - Added Import, Onboarding, EmptyStates, Search namespaces with all Polish copy
- `apps/web/src/components/onboarding/onboarding-checklist.tsx` - Replaced hardcoded strings with useTranslations("Onboarding")
- `apps/web/src/components/search/command-palette.tsx` - Replaced hardcoded strings with useTranslations("Search")
- `apps/web/src/app/[locale]/(dashboard)/contractors/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/app/[locale]/(dashboard)/contracts/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/app/[locale]/(dashboard)/invoices/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/app/[locale]/(dashboard)/payments/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/app/[locale]/(dashboard)/approvals/page.tsx` - EmptyStates i18n for empty state
- `apps/web/src/components/notifications/notification-center.tsx` - EmptyStates i18n for empty state

## Decisions Made
- Aligned translation keys in JSON with existing component key conventions (e.g., components use `t("title")` not `t("dialogTitle")`, `t("upload.dropHeading")` not `t("upload.heading")`). Added additional keys to cover all component usage while preserving the plan-specified namespace structure.
- Used TranslateFn prop pattern for onboarding sub-components (StepItem, CollapsedBar) to thread translations without each sub-component needing its own useTranslations call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added missing Import translation keys for component compatibility**
- **Found during:** Task 2 (Wire i18n into components)
- **Issue:** Import components use different key names than what the plan specified (e.g., `t("title")` vs `t("dialogTitle")`, `t("upload.dropHeading")` vs `t("upload.heading")`). Components also use keys not in the plan: actions.import, actions.next, actions.back, discard.title/description/keep/discard, upload.conversionError/tooLarge/invalidType/genericError/entityType, mapping.description/note, confirm.contractors/contracts/complete/created/updated/skipped/failed/viewEntities/importing/errorTitle/errorDescription/tryAgain/ready/newRecordsLabel/updatesLabel/skippedDuplicatesLabel/skippedErrorsLabel/importButton, duplicates.taxId/nameFromFile/nameExisting/action
- **Fix:** Deep-merged additional translation keys into both en.json and pl.json Import namespace to cover all keys used by existing components
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Verification:** All component translation keys resolve correctly, JSON remains valid
- **Committed in:** c0938cd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for i18n correctness -- components cannot render without matching translation keys. No scope creep.

## Issues Encountered
None

## Known Stubs
None - all translation keys are fully populated with real copy from the UI-SPEC copywriting contract.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 10 i18n coverage complete
- Phase 10 (Onboarding & Polish) is fully implemented across all 5 plans
- Ready for verification and UAT

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 10-onboarding-polish*
*Completed: 2026-03-23*
