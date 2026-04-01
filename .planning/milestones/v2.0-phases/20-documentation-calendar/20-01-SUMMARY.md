---
phase: 20-documentation-calendar
plan: 01
subsystem: integrations
tags: [notion, confluence, google-calendar, outlook, oauth, prisma, zod]

# Dependency graph
requires:
  - phase: 12-integration-foundation
    provides: BaseAdapter, registerAdapter, credential store, OAuth pipeline
provides:
  - NOTION, CONFLUENCE, GOOGLE_CALENDAR, OUTLOOK_CALENDAR provider enum values
  - IntegrationConnection.userId field for per-user connections
  - NotionAdapter with HTTP Basic auth and page search
  - ConfluenceAdapter with CQL search and cloud ID discovery
  - GoogleCalendarAdapter with event CRUD and etag concurrency
  - OutlookCalendarAdapter with MS Graph event CRUD
  - Zod validators for doc link metadata and calendar event config
affects: [20-02, 20-03, 20-04, 20-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [notion-basic-auth-token-exchange, etag-concurrency-control, per-user-connection-model]

key-files:
  created:
    - packages/integrations/src/adapters/notion-adapter.ts
    - packages/integrations/src/adapters/confluence-adapter.ts
    - packages/integrations/src/adapters/google-calendar-adapter.ts
    - packages/integrations/src/adapters/outlook-calendar-adapter.ts
    - packages/validators/src/docs.ts
    - packages/validators/src/calendar.ts
  modified:
    - packages/db/prisma/schema/integration.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/integrations/src/adapters/register-all.ts
    - packages/validators/src/index.ts

key-decisions:
  - "Outlook token exchange uses application/x-www-form-urlencoded (Microsoft Identity Platform requirement)"
  - "Notion adapter uses HTTP Basic auth for token exchange per API requirement (not JSON body credentials)"

patterns-established:
  - "Per-user connection: userId field on IntegrationConnection, null = org-level, set = personal"
  - "Calendar adapter CRUD: createEvent/updateEvent/deleteEvent methods on adapter class"
  - "Doc adapter search: searchPages method returning normalized result arrays"

requirements-completed: [DOCS-01, DOCS-02, CAL-01, CAL-02]

# Metrics
duration: 5min
completed: 2026-03-30
---

# Phase 20 Plan 01: Doc/Calendar Foundation Summary

**Four OAuth adapters (Notion, Confluence, Google Calendar, Outlook Calendar) with Prisma schema changes, Zod validators, and per-user connection support**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-29T22:01:31Z
- **Completed:** 2026-03-29T22:06:25Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Added 4 new IntegrationProvider enum values and userId field to IntegrationConnection for per-user connections
- Created 4 adapter classes following JiraAdapter pattern with OAuth flows, provider-specific API methods, and health status checks
- Created 2 validator files with all doc/calendar Zod schemas exported from package index

## Task Commits

Each task was committed atomically:

1. **Task 1: DB schema migration + Zod validators** - `971f544` (feat)
2. **Task 2: Create four integration adapters and register them** - `90fa950` (feat)

## Files Created/Modified
- `packages/db/prisma/schema/integration.prisma` - Added 4 provider enums, userId field, composite index
- `packages/db/prisma/schema/auth.prisma` - Added personalConnections relation to User model
- `packages/validators/src/docs.ts` - Notion/Confluence page metadata, search result, attach doc schemas
- `packages/validators/src/calendar.ts` - Calendar task config, event metadata, deadline type schemas
- `packages/validators/src/index.ts` - Re-exports for docs and calendar validators
- `packages/integrations/src/adapters/notion-adapter.ts` - Notion OAuth with Basic auth and page search
- `packages/integrations/src/adapters/confluence-adapter.ts` - Confluence OAuth with CQL search and cloud ID discovery
- `packages/integrations/src/adapters/google-calendar-adapter.ts` - Google Calendar OAuth with event CRUD and If-Match etag
- `packages/integrations/src/adapters/outlook-calendar-adapter.ts` - Outlook Calendar OAuth with MS Graph event CRUD
- `packages/integrations/src/adapters/register-all.ts` - Registered all 4 new adapters

## Decisions Made
- Outlook token exchange uses `application/x-www-form-urlencoded` content type (Microsoft Identity Platform requires form-encoded POST, not JSON)
- Notion adapter uses HTTP Basic auth for token exchange per Notion API requirement (Pitfall 1 from RESEARCH)
- Added `personalConnections` relation to User model in auth.prisma to support the new userId field on IntegrationConnection

## Deviations from Plan

None - plan executed exactly as written.

## User Setup Required

External services require manual configuration. See plan frontmatter `user_setup` section for:
- NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, NOTION_ENCRYPTION_KEY
- CONFLUENCE_CLIENT_ID, CONFLUENCE_CLIENT_SECRET, CONFLUENCE_ENCRYPTION_KEY
- GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_ENCRYPTION_KEY
- OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, OUTLOOK_ENCRYPTION_KEY

## Next Phase Readiness
- All 4 adapters registered and type-safe, ready for doc linking tRPC router (20-02)
- Calendar adapters ready for deadline sync service (20-03)
- Zod validators ready for API input validation in subsequent plans

## Self-Check: PASSED

All 6 created files verified present. Both task commits (971f544, 90fa950) verified in git log.

---
*Phase: 20-documentation-calendar*
*Completed: 2026-03-30*
