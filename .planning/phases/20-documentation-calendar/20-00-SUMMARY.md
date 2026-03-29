---
phase: 20-documentation-calendar
plan: 00
subsystem: testing
tags: [vitest, test-stubs, notion, confluence, google-calendar, outlook-calendar]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: adapter pattern and test stub convention (ksef-sync.test.ts)
provides:
  - Wave 0 test stubs for all DOCS-01, DOCS-02, CAL-01, CAL-02 requirements
  - Nyquist-compliant test scaffolding for Phase 20 implementation plans
affects: [20-01, 20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [it.todo test stub pattern for Nyquist compliance]

key-files:
  created:
    - packages/integrations/src/adapters/__tests__/notion-adapter.test.ts
    - packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts
    - packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts
    - packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts
    - packages/api/src/services/__tests__/doc-link-service.test.ts
    - packages/api/src/services/__tests__/calendar-sync.test.ts
  modified: []

key-decisions:
  - "Followed exact ksef-sync.test.ts pattern for consistency across all test stub files"

patterns-established:
  - "it.todo stubs: every phase requirement has test placeholder before implementation"

requirements-completed: [DOCS-01, DOCS-02, CAL-01, CAL-02]

# Metrics
duration: 1min
completed: 2026-03-29
---

# Phase 20 Plan 00: Wave 0 Test Stubs Summary

**43 it.todo test stubs across 6 files covering Notion, Confluence, Google Calendar, Outlook Calendar adapters plus doc-link and calendar-sync services**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-29T22:01:28Z
- **Completed:** 2026-03-29T22:02:54Z
- **Tasks:** 1
- **Files modified:** 6

## Accomplishments
- Created 6 test stub files with 43 total it.todo entries
- All DOCS-01/DOCS-02/CAL-01/CAL-02 requirements have test coverage placeholders
- Both API and integrations test suites pass (todos are not failures)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test stubs for all Phase 20 services and adapters** - `b15dc5d` (test)

## Files Created/Modified
- `packages/integrations/src/adapters/__tests__/notion-adapter.test.ts` - 6 todos for Notion OAuth + page search
- `packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts` - 6 todos for Confluence OAuth + CQL search
- `packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts` - 6 todos for Google Calendar CRUD
- `packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts` - 6 todos for Outlook Calendar CRUD
- `packages/api/src/services/__tests__/doc-link-service.test.ts` - 8 todos for doc link attach/detach/search/refresh
- `packages/api/src/services/__tests__/calendar-sync.test.ts` - 17 todos across CalendarEventService, CalendarDeadlineSync, CalendarTaskEventService

## Decisions Made
- Followed exact ksef-sync.test.ts pattern for consistency across all test stub files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing ksef-xml-parser.test.ts failure due to @contractor-ops/validators package resolution (out of scope, not related to this plan)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All requirement test stubs in place for implementation plans 01-05
- Implementation plans can fill in test bodies as they build each adapter/service

---
*Phase: 20-documentation-calendar*
*Completed: 2026-03-29*
