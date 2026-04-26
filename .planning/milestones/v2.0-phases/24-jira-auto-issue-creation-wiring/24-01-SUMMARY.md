---
phase: 24-jira-auto-issue-creation-wiring
plan: 01
subsystem: api
tags: [jira, workflow, fire-and-forget, tRPC, integration]

requires:
  - phase: 19-jira-integration
    provides: createJiraIssue service, JiraTaskConfig schema, Jira connection model
provides:
  - Fire-and-forget createJiraIssue wiring in startRun mutation
  - Automatic Jira issue creation for jira-enabled workflow task templates
affects: []

tech-stack:
  added: []
  patterns:
    - "jiraEligibleTaskRunIds Set built inside transaction, consumed after for fire-and-forget dispatch"

key-files:
  created: []
  modified:
    - packages/api/src/routers/workflow.ts

key-decisions:
  - "Reused existing transitionJiraIssue fire-and-forget pattern for consistency"

patterns-established:
  - "configJson jiraEnabled check via safeParse inside transaction to build eligible ID set"

requirements-completed: [JIRA-02]

duration: 1min
completed: 2026-03-30
---

# Phase 24 Plan 01: Jira Auto-Issue Creation Wiring Summary

**Wire createJiraIssue fire-and-forget into startRun so TODO tasks with jiraEnabled templates automatically create Jira issues**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-30T14:29:27Z
- **Completed:** 2026-03-30T14:30:47Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Wired createJiraIssue into startRun mutation with fire-and-forget pattern matching existing transitionJiraIssue
- Built jiraEligibleTaskRunIds Set inside transaction by parsing template configJson with jiraTaskConfigSchema
- Individual .catch() per task ensures one Jira failure does not block others or the workflow start
- TypeScript compilation verified clean with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire createJiraIssue fire-and-forget into startRun** - `e8c1344` (feat)
2. **Task 2: Verify TypeScript compilation** - verification only, no code changes

## Files Created/Modified
- `packages/api/src/routers/workflow.ts` - Added jiraTaskConfigSchema import, jiraEligibleTaskRunIds Set in transaction, fire-and-forget createJiraIssue block after TASK_ASSIGNED dispatch

## Decisions Made
- Reused existing transitionJiraIssue fire-and-forget pattern (void async, dynamic import, connection lookup) for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JIRA-02 requirement fully closed: service exists, UI displays issue chips, and now the trigger wiring connects them
- No follow-up work needed for this gap closure

---
*Phase: 24-jira-auto-issue-creation-wiring*
*Completed: 2026-03-30*
