---
phase: 20-documentation-calendar
plan: 02
subsystem: api
tags: [trpc, notion, confluence, external-link, doc-search]

requires:
  - phase: 20-documentation-calendar/01
    provides: "Notion/Confluence adapters with searchPages, doc validator schemas"
provides:
  - "Doc link service with attach/detach/list/search/refreshMetadata"
  - "tRPC docs router with 5 tenant-scoped procedures"
  - "Search proxy aggregating Notion + Confluence results"
affects: [20-documentation-calendar/03, 20-documentation-calendar/04]

tech-stack:
  added: []
  patterns: ["Doc link CRUD via ExternalLink entity with WORKFLOW_TASK_RUN scoping", "Multi-provider search aggregation with graceful degradation"]

key-files:
  created:
    - packages/api/src/services/doc-link-service.ts
    - packages/api/src/routers/docs.ts
  modified:
    - packages/api/src/root.ts

key-decisions:
  - "Singleton adapter instances for Notion/Confluence search (no registry lookup overhead)"
  - "Graceful degradation: missing provider connections return empty results, no error"
  - "App router in root.ts not _app.ts (plan referenced _app.ts but codebase uses root.ts)"

patterns-established:
  - "Doc link attach/detach via ExternalLink with entityType WORKFLOW_TASK_RUN"
  - "Multi-provider search with per-provider result cap (10) and merged output"

requirements-completed: [DOCS-01, DOCS-02]

duration: 3min
completed: 2026-03-29
---

# Phase 20 Plan 02: Doc Link Backend Summary

**Doc link service and tRPC router for attaching/detaching Notion and Confluence pages to workflow steps, with multi-provider search proxy**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-29T22:09:39Z
- **Completed:** 2026-03-29T22:12:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Doc link service with 5 exported functions covering full CRUD lifecycle (attach, detach, list), search aggregation across Notion and Confluence, and 24-hour staleness-based metadata refresh
- tRPC docs router with tenant-scoped procedures for all 5 operations, mounted on the app router
- Search proxy gracefully handles missing provider connections (returns empty, no error) with 10 results per provider cap

## Task Commits

Each task was committed atomically:

1. **Task 1: Doc link service with attach, detach, list, search, and metadata refresh** - `7db5811` (feat)
2. **Task 2: tRPC docs router with attach, detach, list, search procedures + mount on app router** - `44b852e` (feat)

## Files Created/Modified
- `packages/api/src/services/doc-link-service.ts` - Service layer with attachDocLink, detachDocLink, getDocLinks, searchDocs, refreshDocMetadata
- `packages/api/src/routers/docs.ts` - tRPC router with 5 tenant-scoped procedures (attach, detach, list, search, refreshMetadata)
- `packages/api/src/root.ts` - Added docs router to appRouter

## Decisions Made
- Used singleton adapter instances (NotionAdapter, ConfluenceAdapter) instead of registry lookup for search — simpler and avoids unnecessary abstraction for two known providers
- Graceful degradation on search: missing provider connections return empty arrays instead of throwing errors, matching user expectations for optional integrations
- Plan referenced `_app.ts` for app router but codebase uses `root.ts` — adapted accordingly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] App router file is root.ts not _app.ts**
- **Found during:** Task 2
- **Issue:** Plan specified updating `packages/api/src/routers/_app.ts` but the codebase uses `packages/api/src/root.ts`
- **Fix:** Updated root.ts instead to mount the docs router
- **Files modified:** packages/api/src/root.ts
- **Verification:** TypeScript compilation passes, router mounted correctly
- **Committed in:** 44b852e (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** File path correction only. No scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Doc link backend fully operational, ready for frontend integration (Plan 03/04)
- All 5 tRPC procedures accessible via `trpc.docs.*`
- Search proxy ready for Cmd+K integration

---
*Phase: 20-documentation-calendar*
*Completed: 2026-03-29*
