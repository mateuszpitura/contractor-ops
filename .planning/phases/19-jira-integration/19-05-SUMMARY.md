---
phase: 19-jira-integration
plan: 05
subsystem: ui, api
tags: [jira, react, trpc, integration, gap-closure]

requires:
  - phase: 19-jira-integration
    provides: "JiraTaskConfig component, jira-issue-sync service, task-card.tsx template builder"
provides:
  - "JiraTaskConfig mounted in task-card.tsx — JIRA-02 UI path functional"
  - "Hardened siteUrl derivation with null fallback instead of placeholder"
affects: []

tech-stack:
  added: []
  patterns:
    - "Conditional integration UI rendering based on persisted entity ID"
    - "Cascading URL derivation: stored field -> computed field -> null fallback"

key-files:
  created: []
  modified:
    - "apps/web/src/components/workflows/template-builder/task-card.tsx"
    - "packages/api/src/services/jira-issue-sync.ts"

key-decisions:
  - "JiraTaskConfig only renders for saved tasks with persisted ID (new unsaved tasks cannot have server-side Jira config)"
  - "siteUrl null fallback produces empty ExternalLink URL instead of fake URL — JiraIssueChip handles missing URLs gracefully"

patterns-established: []

requirements-completed: [JIRA-02]

duration: 2min
completed: 2026-03-29
---

# Phase 19 Plan 05: Gap Closure Summary

**Mounted orphaned JiraTaskConfig in task-card.tsx and hardened siteUrl derivation removing 'your-site' placeholder fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-29T20:53:39Z
- **Completed:** 2026-03-29T20:55:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- JiraTaskConfig is now imported and rendered in task-card.tsx expanded section for saved tasks, closing the JIRA-02 orphaned component gap
- siteUrl derivation in jira-issue-sync.ts uses stored siteUrl field first, then siteName, with null as final fallback instead of a placeholder string
- ExternalLink records created with empty URL when site info is missing (JiraIssueChip handles this gracefully)

## Task Commits

Each task was committed atomically:

1. **Task 1: Mount JiraTaskConfig in task-card.tsx expanded section** - `64d3f53` (feat)
2. **Task 2: Harden siteUrl derivation in jira-issue-sync.ts** - `7a41863` (fix)

## Files Created/Modified
- `apps/web/src/components/workflows/template-builder/task-card.tsx` - Added JiraTaskConfig import and conditional render for saved tasks
- `packages/api/src/services/jira-issue-sync.ts` - Updated JiraConnectionConfig interface with optional siteName/siteUrl fields; replaced placeholder siteUrl derivation with cascading fallback

## Decisions Made
- JiraTaskConfig only renders for saved tasks with persisted ID — new unsaved tasks cannot have server-side Jira config
- siteUrl null fallback produces empty ExternalLink URL instead of fake URL — JiraIssueChip already handles missing URLs gracefully by conditionally rendering the anchor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12/12 truths from 19-VERIFICATION.md are now verified
- JIRA-02 UI path is functional: admins can enable auto-issue-creation per task template
- Phase 19 gap closure complete

---
*Phase: 19-jira-integration*
*Completed: 2026-03-29*
