---
phase: 19-jira-integration
plan: 02
subsystem: api
tags: [jira, trpc, webhooks, workflow, bidirectional-sync, qstash]

# Dependency graph
requires:
  - phase: 19-jira-integration
    provides: Jira backend services (issue sync, webhook handler, status mapping, validators)
  - phase: 12-integration-foundation
    provides: BaseAdapter, webhook pipeline, credential encryption
provides:
  - Jira tRPC router with 11 procedures (8 queries + 3 mutations) mounted on appRouter
  - Jira webhook processing wired through unified pipeline via _process route dispatch
  - Outbound Jira transitions fired from workflow completeTask and skipTask
affects: [19-03-ui-components, 19-04-ui-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [dynamic-import-for-fire-and-forget, provider-dispatch-in-process-route]

key-files:
  created:
    - packages/api/src/routers/jira.ts
  modified:
    - packages/api/src/root.ts
    - packages/api/package.json
    - apps/web/src/app/api/webhooks/_process/route.ts
    - packages/api/src/routers/workflow.ts

key-decisions:
  - "All Jira procedures in single jiraRouter (not split across routers) for cohesion"
  - "Jira webhook dispatch in _process route (not JiraAdapter) to avoid circular dependency"
  - "Outbound sync uses fire-and-forget void async with try/catch to never block workflow operations"

patterns-established:
  - "Provider-specific dispatch in _process route: mirrors e-sign pattern for Jira webhook processing"
  - "Dynamic import for optional integrations: transitionJiraIssue imported at call site to avoid loading when unused"

requirements-completed: [JIRA-01, JIRA-02, JIRA-03, JIRA-04]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 19 Plan 02: Jira tRPC Router and Webhook Wiring Summary

**Jira tRPC router with 11 procedures (connection status, project/issue type listing, status mapping CRUD, task config, linked issues, recent activity, disconnect), webhook dispatch in _process route, and outbound Jira transitions from workflow task completion**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T11:00:07Z
- **Completed:** 2026-03-28T11:05:07Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Complete Jira tRPC router with 8 query procedures and 3 mutation procedures mounted on appRouter as `jira` namespace
- Jira webhook processing wired through unified pipeline: [provider] route -> QStash -> _process route -> processJiraWebhook (no circular dependency)
- Outbound Jira transitions fire-and-forget from both completeTask (DONE) and skipTask (SKIPPED) in workflow router

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Jira tRPC router with read queries and config mutations** - `fafe83f` (feat)
2. **Task 2: Wire Jira webhook dispatch and outbound sync into workflow** - `5eecdde` (feat)

## Files Created/Modified
- `packages/api/src/routers/jira.ts` - Jira tRPC router with 11 procedures (connectionStatus, listProjects, listIssueTypes, listProjectStatuses, getStatusMapping, getTaskConfig, linkedIssues, recentActivity, saveStatusMapping, saveTaskConfig, disconnect)
- `packages/api/src/root.ts` - Added jiraRouter import and mounted as `jira` namespace
- `packages/api/package.json` - Added jira-webhook-handler export path for _process route import
- `apps/web/src/app/api/webhooks/_process/route.ts` - Added Jira provider dispatch block calling processJiraWebhook
- `packages/api/src/routers/workflow.ts` - Injected fire-and-forget outbound Jira transitions in completeTask and skipTask

## Decisions Made
- Combined all queries and mutations in single jiraRouter for cohesion (following ksef/esign router patterns)
- Jira webhook dispatch placed in _process route (not JiraAdapter.handleWebhook) to avoid circular dependency between packages/integrations and packages/api
- Outbound sync uses `void (async () => { ... })()` pattern with dynamic import and try/catch to ensure Jira API failures never block workflow task completion
- Added `@contractor-ops/api/services/jira-webhook-handler` export path to package.json for the _process route dynamic import

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added jira-webhook-handler export path in API package.json**
- **Found during:** Task 1
- **Issue:** The _process route needs to import processJiraWebhook from @contractor-ops/api/services/jira-webhook-handler, but no export path existed
- **Fix:** Added the export mapping in package.json exports field
- **Files modified:** packages/api/package.json
- **Verification:** TypeScript resolves the import path correctly
- **Committed in:** fafe83f (Task 1 commit)

**2. [Rule 3 - Blocking] Root router is root.ts not _app.ts**
- **Found during:** Task 1
- **Issue:** Plan referenced _app.ts for mounting jiraRouter, but the actual app router file is root.ts
- **Fix:** Mounted jiraRouter in root.ts instead
- **Files modified:** packages/api/src/root.ts
- **Verification:** Import resolves correctly, router type exports updated
- **Committed in:** fafe83f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correct wiring. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in time.ts, time-entry.ts, and portal-time.ts (from parallel agent Phase 18 work) prevent full API package build, but all new Jira files compile without errors when checked independently.

## User Setup Required
None - no external service configuration required. Jira OAuth credentials already configured from Phase 18.

## Next Phase Readiness
- All tRPC procedures ready for Plan 03 (UI components) and Plan 04 (UI views) to consume
- Status mapping CRUD available for configuration UI
- Linked issues query available for Jira chips in workflow views
- Recent activity query available for contractor Workflows tab
- Webhook pipeline fully wired for inbound Jira status changes

---
*Phase: 19-jira-integration*
*Completed: 2026-03-28*
