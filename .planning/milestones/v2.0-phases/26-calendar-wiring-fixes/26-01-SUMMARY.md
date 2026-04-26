---
phase: 26-calendar-wiring-fixes
plan: 01
subsystem: api, integrations, ui
tags: [oauth, calendar, google-calendar, outlook-calendar, trpc, workflow]

requires:
  - phase: 20-documentation-calendar
    provides: Calendar adapters, OAuth configs, calendar event service
  - phase: 21-api-build-fixes
    provides: Fixed TypeScript compilation for API package
  - phase: 22-component-mounting
    provides: CalendarTaskConfig wired in template builder

provides:
  - Fixed OAuth URL construction with space-separated scopes and response_type=code
  - extraAuthParams support in OAuthConfig type for provider-specific OAuth parameters
  - Calendar event fire-and-forget creation in startRun for calendar-enabled tasks
  - calendarTaskCount in startRun mutation response with frontend toast
  - tRPC-based OAuth URL fetching in calendar settings (replaces hardcoded callbacks)

affects: []

tech-stack:
  added: []
  patterns:
    - "extraAuthParams on OAuthConfig for provider-specific OAuth query parameters"
    - "calendarConfigMap pattern matching jiraEligibleTaskRunIds for fire-and-forget integration"

key-files:
  created:
    - packages/api/src/routers/__tests__/integration.test.ts
    - packages/api/src/routers/__tests__/workflow.test.ts
  modified:
    - packages/integrations/src/types/provider.ts
    - packages/integrations/src/adapters/google-calendar-adapter.ts
    - packages/api/src/routers/integration.ts
    - packages/api/src/routers/workflow.ts
    - apps/web/src/components/settings/my-calendar-section.tsx
    - apps/web/src/components/workflows/template-picker-dialog.tsx

key-decisions:
  - "Used queryClient.fetchQuery for on-demand OAuth URL fetch instead of useQuery with enabled:false + refetch"
  - "Calendar fire-and-forget block placed after Jira block, matching D-02 separate block pattern"
  - "Plain English toast string for calendarTaskCount since i18n key not yet created"

patterns-established:
  - "extraAuthParams on OAuthConfig: optional Record<string,string> appended to authorization URL"
  - "calendarConfigMap: Map<taskRunId, CalendarTaskConfig> built from template configJson safeParse"

requirements-completed: [CAL-01, CAL-02]

duration: 7min
completed: 2026-03-30
---

# Phase 26 Plan 01: Calendar Wiring Fixes Summary

**Fixed OAuth URL construction (space scopes, response_type=code, extraAuthParams) and wired createTaskCalendarEvent fire-and-forget into startRun with calendarTaskCount response toast**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-30T21:41:29Z
- **Completed:** 2026-03-30T21:49:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Fixed calendar OAuth connect flow: space-separated scopes, response_type=code, extraAuthParams for Google offline access
- Replaced hardcoded callback URLs with tRPC getOAuthUrlGeneric queries in calendar settings
- Wired createTaskCalendarEvent fire-and-forget into startRun for calendar-enabled template tasks
- Added calendarTaskCount to startRun response with informational frontend toast

## Task Commits

Each task was committed atomically:

1. **Task 0: Create test stubs for CAL-01 and CAL-02** - `1c4cc43` (test)
2. **Task 1: Fix calendar OAuth connect flow** - `d73dd07` (feat)
3. **Task 2: Wire createTaskCalendarEvent into startRun** - `5912396` (feat)

## Files Created/Modified
- `packages/api/src/routers/__tests__/integration.test.ts` - Test stubs for OAuth URL construction (5 todo)
- `packages/api/src/routers/__tests__/workflow.test.ts` - Test stubs for calendar event creation (5 todo)
- `packages/integrations/src/types/provider.ts` - Added extraAuthParams optional field to OAuthConfig
- `packages/integrations/src/adapters/google-calendar-adapter.ts` - Moved extra params into OAuthConfig, deprecated standalone export
- `packages/api/src/routers/integration.ts` - Fixed scope separator, added response_type, appended extraAuthParams
- `packages/api/src/routers/workflow.ts` - Calendar fire-and-forget block, calendarConfigMap, calendarTaskCount response
- `apps/web/src/components/settings/my-calendar-section.tsx` - tRPC-based OAuth URL fetching
- `apps/web/src/components/workflows/template-picker-dialog.tsx` - Informational toast for calendar events

## Decisions Made
- Used queryClient.fetchQuery for on-demand OAuth URL fetch (imperative fetch on button click) instead of useQuery with enabled:false + refetch pattern
- Calendar fire-and-forget block placed after Jira block as separate dedicated block per D-02
- Used plain English toast string for calendarTaskCount since i18n key not yet in message files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Web build fails on pre-existing react-pdf CSS import issue (unrelated to this plan, out of scope)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CAL-01 and CAL-02 requirements closed
- Calendar OAuth connect and event creation fully wired
- Test stub files ready for future test implementation

## Self-Check: PASSED

All 8 files verified present. All 3 task commits verified (1c4cc43, d73dd07, 5912396).

---
*Phase: 26-calendar-wiring-fixes*
*Completed: 2026-03-30*
