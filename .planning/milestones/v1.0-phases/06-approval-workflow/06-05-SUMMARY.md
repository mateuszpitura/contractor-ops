---
phase: 06-approval-workflow
plan: 05
subsystem: ui
tags: [next-intl, i18n, translations, approval-workflow, sla-breach]

# Dependency graph
requires:
  - phase: 06-02
    provides: Approval queue page with columns, toolbar, side panel components
  - phase: 06-03
    provides: Chain tracker and audit timeline components
  - phase: 06-04
    provides: Settings approval chains tab, chain editor dialog, condition builder
provides:
  - Complete EN + PL i18n coverage for all approval workflow UI surfaces
  - Settings.approvals namespace with full chain editor translations
  - SLA breach events verified in getAuditTrail API for Phase 7 consumption
affects: [07-notifications, i18n]

# Tech tracking
tech-stack:
  added: []
  patterns: [labelKey pattern for static config objects with i18n, TranslateFn type for passing t() to sub-components]

key-files:
  created: []
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - apps/web/src/components/approvals/chain-tracker.tsx
    - apps/web/src/components/approvals/audit-timeline.tsx
    - apps/web/src/components/settings/approval-chains-tab.tsx
    - apps/web/src/components/settings/chain-editor-dialog.tsx
    - apps/web/src/components/settings/condition-builder.tsx

key-decisions:
  - "labelKey pattern for static DECISION_CONFIG and FIELD_OPTIONS/OPERATOR_OPTIONS objects to defer i18n resolution to render time"
  - "TranslateFn type alias for sub-components that accept t() with simpler signature than useTranslations return type"
  - "SLA breach events already implemented correctly in Plan 01 getAuditTrail -- no changes needed"

patterns-established:
  - "labelKey pattern: static config objects store i18n key strings, resolved at render via t(config.labelKey)"
  - "TranslateFn prop pattern: sub-components receive t as prop instead of calling useTranslations when deeply nested"

requirements-completed: [APPR-06]

# Metrics
duration: 10min
completed: 2026-03-21
---

# Phase 06 Plan 05: i18n + SLA Breach Verification Summary

**Complete EN + PL i18n for all approval workflow UI (queue, chain tracker, audit timeline, settings) with SLA breach events verified in audit trail API**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-21T22:36:53Z
- **Completed:** 2026-03-21T22:47:30Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Added chainTracker and auditTrail sub-namespaces to Approvals i18n (EN + PL)
- Added complete Settings.approvals namespace with 70+ keys for chain editor, condition builder, and settings tab
- Wired chain-tracker.tsx and audit-timeline.tsx to useTranslations with t() for all user-visible strings
- Wired approval-chains-tab.tsx, chain-editor-dialog.tsx, and condition-builder.tsx to useTranslations("Settings")
- Verified SLA breach events in getAuditTrail API response (canonical shape confirmed from Plan 01)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Approvals i18n namespace and update Settings namespace** - `48c5325` (feat)
2. **Task 2: Wire approval queue and detail components to use i18n keys** - `03b8770` (feat)
3. **Task 3: Wire settings components to i18n and verify SLA breach events** - `1c1c194` (feat)

## Files Created/Modified
- `apps/web/messages/en.json` - Added chainTracker, auditTrail, Settings.tabs.approvals, Settings.approvals namespace
- `apps/web/messages/pl.json` - Matching Polish translations for all new keys
- `apps/web/src/components/approvals/chain-tracker.tsx` - Added useTranslations, replaced hardcoded heading and chain label
- `apps/web/src/components/approvals/audit-timeline.tsx` - Added useTranslations, replaced DECISION_CONFIG labels, system event labels, show more/less, heading, empty state
- `apps/web/src/components/settings/approval-chains-tab.tsx` - Added useTranslations, replaced all hardcoded strings in empty state, header, chain cards, delete dialog, toasts
- `apps/web/src/components/settings/chain-editor-dialog.tsx` - Added useTranslations, replaced dialog title/description, form labels, placeholders, toast messages
- `apps/web/src/components/settings/condition-builder.tsx` - Added useTranslations, replaced field/operator/value labels and placeholders, add/remove buttons, help text

## Decisions Made
- Used labelKey pattern for static config objects (DECISION_CONFIG, FIELD_OPTIONS, OPERATOR_OPTIONS) to defer i18n resolution to render time
- Used TranslateFn type alias for passing t() to sub-components (HumanEntry, SystemEntry, CommentText) instead of calling useTranslations in each
- SLA breach events already correctly implemented in Plan 01's getAuditTrail -- covers both acted-after-deadline and currently-overdue-pending cases

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added noUsersFound translation key**
- **Found during:** Task 3 (chain editor dialog i18n)
- **Issue:** UserPicker had hardcoded "No users found." but no corresponding i18n key existed
- **Fix:** Added Settings.approvals.editor.noUsersFound to both EN and PL locale files
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 1c1c194 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor gap-fill adding one missing translation key. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 06 (Approval Workflow) is now complete with full i18n coverage
- SLA breach events are surfaced in getAuditTrail API for Phase 7 notification consumption
- All approval UI surfaces render via next-intl in both EN and PL

---
*Phase: 06-approval-workflow*
*Completed: 2026-03-21*
