---
phase: 09-dashboard-reports
plan: 05
subsystem: i18n
tags: [next-intl, i18n, translations, polish, english, dashboard, reports, audit-log]

requires:
  - phase: 09-02
    provides: Dashboard components (KPI cards, spend chart, widgets)
  - phase: 09-03
    provides: Reports components (sidebar, filters, 5 report types)
  - phase: 09-04
    provides: Audit log components (tab, table, diff viewer)
provides:
  - Complete EN/PL translations for Dashboard namespace (KPI, spend, deadlines, approvals, activity)
  - All hardcoded strings externalized in Phase 9 dashboard components
  - Full i18n coverage for dashboard, reports, and audit log surfaces
affects: []

tech-stack:
  added: []
  patterns:
    - "labelKey pattern for static config objects with i18n keys resolved at render time (extended to SLA badges, deadline badges)"
    - "Inline t() interpolation for dynamic action/resource type lookups via computed key strings"

key-files:
  created: []
  modified:
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - apps/web/src/components/dashboard/approval-queue-widget.tsx
    - apps/web/src/components/dashboard/deadlines-widget.tsx
    - apps/web/src/components/dashboard/activity-feed.tsx
    - apps/web/src/app/[locale]/(dashboard)/page.tsx

key-decisions:
  - "Adapted translation key structure to match component usage (flat spend.*, kpi.*, etc.) rather than plan-specified nested structure"
  - "Locale files at apps/web/messages/ not apps/web/src/locales/ as plan referenced"

patterns-established:
  - "SLA_LABEL_KEYS record pattern for mapping enum values to i18n keys in approval-queue-widget"
  - "DEADLINE_BADGE_CONFIG record pattern for mapping deadline types to i18n keys and styles"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06, ORG-10]

duration: 6min
completed: 2026-03-22
---

# Phase 09 Plan 05: i18n Translations Summary

**Complete EN/PL translations for Dashboard (KPI, spend, deadlines, approvals, activity), with all hardcoded strings externalized from Phase 9 components**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T14:04:48Z
- **Completed:** 2026-03-22T14:11:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Added Dashboard namespace translations (kpi, spend, deadlines, approvals, activity, errors) to EN and PL locale files
- Externalized all hardcoded English strings from Phase 9 dashboard components (SLA labels, badge labels, action labels, group labels, resource type labels, error messages)
- Verified Reports and Settings.auditLog namespaces already complete from prior plans
- TypeScript compiles clean with all translation changes

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Dashboard and Reports i18n translations (EN + PL)** - `15c57c7` (feat)
2. **Task 2: Add Settings audit log i18n translations and verify all strings externalized** - `e7065b7` (feat)

## Files Created/Modified
- `apps/web/messages/en.json` - Added Dashboard namespace with kpi, spend, deadlines, approvals, activity, errors keys; added activity action/resource labels
- `apps/web/messages/pl.json` - Added Polish translations for all new Dashboard keys
- `apps/web/src/components/dashboard/approval-queue-widget.tsx` - Replaced hardcoded SLA labels with t() calls via SLA_LABEL_KEYS record
- `apps/web/src/components/dashboard/deadlines-widget.tsx` - Replaced hardcoded badge labels with t() calls via DEADLINE_BADGE_CONFIG record
- `apps/web/src/components/dashboard/activity-feed.tsx` - Replaced hardcoded ACTION_LABELS dict, group labels, resource type labels, and system actor with t() calls
- `apps/web/src/app/[locale]/(dashboard)/page.tsx` - Replaced hardcoded error text in WidgetErrorFallback with t() call

## Decisions Made
- Adapted translation key structure to match actual component usage patterns (flat keys like `spend.title`, `kpi.activeContractors`) rather than the nested structure specified in the plan, since components were already built with these key paths
- Locale files are at `apps/web/messages/` not `apps/web/src/locales/` as referenced in the plan -- followed existing project convention
- Reports namespace and Settings.auditLog namespace were already complete from Plans 03 and 04 -- no additions needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Externalized hardcoded English strings in dashboard components**
- **Found during:** Task 2 (verification scan)
- **Issue:** approval-queue-widget had hardcoded SLA labels ("On track", "Approaching", "Breached"), deadlines-widget had hardcoded badge labels ("Contract", "Task", "Invoice"), activity-feed had hardcoded ACTION_LABELS dictionary, group labels ("TODAY"/"YESTERDAY"/"EARLIER"), and resource type label function producing English output, dashboard page had hardcoded error text
- **Fix:** Added translation keys for all hardcoded strings to both locale files, refactored components to use t() calls with record-based key lookups
- **Files modified:** All 6 files listed above
- **Verification:** grep scan confirms no remaining hardcoded English strings in Phase 9 dashboard components; TypeScript compiles clean
- **Committed in:** e7065b7

**2. [Rule 3 - Blocking] Locale file path differs from plan**
- **Found during:** Task 1 (reading source files)
- **Issue:** Plan referenced `apps/web/src/locales/en.json` but actual path is `apps/web/messages/en.json`
- **Fix:** Used correct path `apps/web/messages/` matching project convention
- **Files modified:** apps/web/messages/en.json, apps/web/messages/pl.json
- **Verification:** Files exist and are loaded by next-intl correctly

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both deviations necessary for correctness. String externalization improves i18n quality. Path correction follows project convention.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full i18n coverage for all Phase 9 surfaces (dashboard, reports, audit log)
- Phase 09 is complete with all 6 plans executed
- Ready for Phase 10 or verification

---
*Phase: 09-dashboard-reports*
*Completed: 2026-03-22*
