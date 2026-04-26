---
phase: 20-documentation-calendar
plan: 05
subsystem: ui
tags: [google-calendar, outlook-calendar, calendar-settings, workflow-task-config, integrations, notion, confluence]

# Dependency graph
requires:
  - phase: 20-03
    provides: "tRPC calendar router with connection management, deadline sync, task config CRUD"
  - phase: 20-04
    provides: "Provider icon components (NotionIcon, ConfluenceIcon, GoogleCalendarIcon, OutlookCalendarIcon)"
provides:
  - "My Calendar personal settings page at /settings/calendar"
  - "CalendarTaskConfig component for workflow task template editor"
  - "CalendarEventConfigDialog for per-task calendar event configuration"
  - "OrgCalendarSection for shared org calendar in integrations"
  - "Notion and Confluence provider cards in integrations tab"
affects: [20-documentation-calendar]

# Tech tracking
tech-stack:
  added: []
  patterns: ["personal calendar settings page pattern", "calendar event config dialog with local useState"]

key-files:
  created:
    - "apps/web/src/app/[locale]/(dashboard)/settings/calendar/page.tsx"
    - "apps/web/src/components/settings/my-calendar-section.tsx"
    - "apps/web/src/components/settings/org-calendar-section.tsx"
    - "apps/web/src/components/workflow/calendar-task-config.tsx"
    - "apps/web/src/components/workflow/calendar-event-config-dialog.tsx"
  modified:
    - "apps/web/src/components/settings/integrations-tab.tsx"
    - "apps/web/messages/en.json"
    - "apps/web/messages/pl.json"

key-decisions:
  - "Inlined CalendarTaskConfig type locally to avoid cross-package build dependency in parallel execution (precedent: Phase 16 NIP validation)"
  - "CalendarEventConfigDialog uses local useState pattern matching OcrReviewPanel precedent from Phase 16"
  - "base-ui Select onValueChange null fallback to default duration value"

patterns-established:
  - "Personal calendar settings page: separate from org integrations, per-user OAuth connection"
  - "Calendar provider card: reuses ProviderConnectionCard visual pattern with custom disconnect copy"

requirements-completed: [CAL-01, CAL-02]

# Metrics
duration: 6min
completed: 2026-03-30
---

# Phase 20 Plan 05: Calendar UI Summary

**My Calendar settings page with Google/Outlook provider cards, per-task calendar event config dialog, org calendar section, and Notion/Confluence cards in integrations tab**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T22:17:45Z
- **Completed:** 2026-03-29T22:24:02Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- My Calendar settings page at /settings/calendar with Google/Outlook personal connection cards, disconnect confirmation dialogs, and active synced events count display
- CalendarTaskConfig component with switch toggle, config summary, and CalendarEventConfigDialog for title template, duration, and attendees configuration
- OrgCalendarSection with shared org-level calendar cards for Google and Outlook
- Notion and Confluence provider cards added to integrations tab alongside existing Slack/KSeF/Jira

## Task Commits

Each task was committed atomically:

1. **Task 1: My Calendar settings page with personal calendar connection cards** - `859c853` (feat)
2. **Task 2: CalendarTaskConfig, CalendarEventConfigDialog, org calendar section, and integrations tab updates** - `5e03b06` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/settings/calendar/page.tsx` - My Calendar personal settings page
- `apps/web/src/components/settings/my-calendar-section.tsx` - Personal calendar connection cards with Google/Outlook
- `apps/web/src/components/settings/org-calendar-section.tsx` - Org shared calendar section for integrations
- `apps/web/src/components/workflow/calendar-task-config.tsx` - Calendar event toggle in workflow task template
- `apps/web/src/components/workflow/calendar-event-config-dialog.tsx` - Calendar event configuration dialog
- `apps/web/src/components/settings/integrations-tab.tsx` - Updated with Notion, Confluence, and OrgCalendarSection
- `apps/web/messages/en.json` - CalendarSettings i18n keys (EN)
- `apps/web/messages/pl.json` - CalendarSettings i18n keys (PL)

## Decisions Made
- Inlined CalendarTaskConfig type locally instead of importing from @contractor-ops/validators to avoid cross-package build dependency in parallel execution (same approach as Phase 16 NIP validation inlining)
- CalendarEventConfigDialog uses local useState for form state (matching OcrReviewPanel precedent from Phase 16)
- base-ui Select onValueChange handler uses null fallback to default "1h" duration value since base-ui passes `string | null`

## Deviations from Plan

None - plan executed exactly as written. Type inlining was a parallel execution accommodation, not a functional deviation.

## Issues Encountered
- TypeScript compilation shows `trpc.calendar` not found errors - this is the same worktree environment issue documented in Plan 03 SUMMARY where API package types are not built in the worktree. Import patterns match existing code exactly and will resolve after API package rebuild.
- @contractor-ops/validators module not found in worktree - resolved by inlining the CalendarTaskConfig type locally.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Calendar UI surfaces are complete: personal settings, org settings, and workflow task configuration
- All components wired to trpc.calendar router procedures from Plan 03
- Ready for integration testing once API package types are rebuilt

## Self-Check: PASSED

- All 5 created files verified on disk
- Commit 859c853 (Task 1) verified in git log
- Commit 5e03b06 (Task 2) verified in git log
- All acceptance criteria verified (content present in files or i18n keys)

---
*Phase: 20-documentation-calendar*
*Completed: 2026-03-30*
