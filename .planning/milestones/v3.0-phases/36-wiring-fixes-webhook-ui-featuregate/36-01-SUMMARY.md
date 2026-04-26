---
phase: 36-wiring-fixes-webhook-ui-featuregate
plan: 01
subsystem: api
tags: [linear, jira, webhook, qstash, bidirectional-sync, workflow]

requires:
  - phase: 29-linear-integration
    provides: "Linear webhook handler, issue sync, status mapping services"
provides:
  - "Linear inbound webhook dispatch in QStash processor"
  - "Outbound CANCELLED sync for Linear and Jira in cancelRun mutation"
affects: [workflow, integrations, linear, jira]

tech-stack:
  added: []
  patterns: ["Fire-and-forget outbound sync in cancelRun matching completeTask/skipTask pattern"]

key-files:
  created: []
  modified:
    - apps/web/src/app/api/webhooks/_process/route.ts
    - packages/api/src/routers/workflow.ts

key-decisions:
  - "Fixed transitionJiraIssue call to use 5-arg signature with connection lookup (plan had incorrect 3-arg call)"

patterns-established:
  - "cancelRun outbound sync: filter run.tasks for CANCELLED status, fire-and-forget sync for each external ref type"

requirements-completed: [LIN-04, LIN-05]

duration: 3min
completed: 2026-04-05
---

# Phase 36 Plan 01: Linear Webhook Wiring and Cancel Sync Summary

**Bidirectional Linear sync wired via QStash webhook dispatch and outbound CANCELLED status sync in cancelRun for both Linear and Jira**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T13:11:26Z
- **Completed:** 2026-04-05T13:14:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Wired Linear inbound webhook dispatch in QStash _process/route.ts, mirroring existing Jira pattern
- Added outbound CANCELLED status sync for both Linear and Jira in cancelRun mutation
- Both sync paths use fire-and-forget pattern with proper error logging

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire Linear inbound webhook dispatch in _process/route.ts** - `1c10158` (feat)
2. **Task 2: Wire outbound CANCELLED sync for Linear and Jira in cancelRun** - `d15acb8` (feat)

## Files Created/Modified
- `apps/web/src/app/api/webhooks/_process/route.ts` - Added Linear provider dispatch block after Jira block, calling processLinearWebhook via dynamic import
- `packages/api/src/routers/workflow.ts` - Added fire-and-forget outbound sync loop in cancelRun for CANCELLED tasks with Linear or Jira external refs

## Decisions Made
- Fixed transitionJiraIssue call signature: plan specified 3 args but actual function requires 5 (prisma, organizationId, connectionId, taskRunId, status) with connection lookup -- matched completeTask pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed transitionJiraIssue call signature in cancelRun**
- **Found during:** Task 2 (Wire outbound CANCELLED sync)
- **Issue:** Plan code passed 3 arguments to transitionJiraIssue but function requires 5 (prisma, organizationId, connectionId, taskRunId, newWorkflowStatus)
- **Fix:** Added integrationConnection lookup and passed all 5 arguments, matching the existing completeTask/skipTask pattern
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** TypeScript error TS2554 resolved; pattern matches completeTask at lines ~1365-1385
- **Committed in:** d15acb8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness -- function would have failed at runtime with wrong argument count. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Linear bidirectional sync fully wired (inbound webhook dispatch + outbound cancel sync)
- Ready for Plan 02 (UI fixes) and Plan 03 (feature gate wiring)

---
*Phase: 36-wiring-fixes-webhook-ui-featuregate*
*Completed: 2026-04-05*
