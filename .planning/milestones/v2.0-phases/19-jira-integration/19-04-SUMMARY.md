---
phase: 19-jira-integration
plan: 04
subsystem: ui
tags: [react, jira, chips, workflow, tRPC, tanstack-query]

# Dependency graph
requires:
  - phase: 19-02
    provides: tRPC jira router with linkedIssues, recentActivity, getTaskConfig, connectionStatus, saveTaskConfig queries/mutations
  - phase: 19-03
    provides: JiraProjectMappingDialog, JiraProviderSection, JiraStatusMappingDialog components
provides:
  - JiraIssueChip component for displaying linked Jira issues as clickable chips
  - JiraActivitySummary component for contractor Workflows tab
  - JiraTaskConfig inline configuration for task templates
  - Linked Issues section in workflow side panel
  - Inline Jira chips on workflow run rows with overflow handling
affects: [19-05-jira-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [status-category-color-mapping, inline-jira-chips-with-overflow, self-hiding-components]

key-files:
  created:
    - apps/web/src/components/integrations/jira-issue-chip.tsx
    - apps/web/src/components/integrations/jira-activity-summary.tsx
    - apps/web/src/components/integrations/jira-task-config.tsx
  modified:
    - apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx
    - apps/web/src/components/workflows/workflow-side-panel.tsx

key-decisions:
  - "JiraIssueChip uses Tooltip wrapping for full summary on hover per UI-SPEC"
  - "RunJiraChips helper component per run row with onClick stopPropagation to prevent Link navigation"
  - "LinkedIssuesSection self-hides when Jira not connected via connectionStatus with staleTime Infinity"
  - "Type assertions via unknown for tRPC response types matching parallel execution pattern"

patterns-established:
  - "Self-hiding Jira components: return null when no connection or no data, avoiding conditional rendering in parent"
  - "Inline chip overflow: max 3 visible chips with +N more Badge for overflow"
  - "Status category color map: new->muted-foreground, indeterminate->info, done->success"

requirements-completed: [JIRA-02, JIRA-04]

# Metrics
duration: 5min
completed: 2026-03-28
---

# Phase 19 Plan 04: Jira UI Components & View Integration Summary

**JiraIssueChip, JiraActivitySummary, and JiraTaskConfig components wired into contractor Workflows tab and workflow side panel with status-colored chips and overflow handling**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-28T14:23:23Z
- **Completed:** 2026-03-28T14:28:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- JiraIssueChip renders linked Jira issues as clickable chips with colored status dots (new/in-progress/done), issue key, and tooltip showing full summary
- JiraActivitySummary displays up to 5 recent Jira issues for a contractor with relative timestamps, self-hides when no data
- JiraTaskConfig provides inline toggle and mapping summary for task template Jira configuration with immediate save on toggle
- Contractor Workflows tab shows Jira activity summary above the runs list and inline chips on each workflow run row
- Workflow side panel shows Linked Issues section with chips and empty state text

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JiraIssueChip, JiraActivitySummary, and JiraTaskConfig components** - `a53cf71` (feat)
2. **Task 2: Wire Jira components into workflows tab and workflow side panel** - `dcb2ce5` (feat)

## Files Created/Modified
- `apps/web/src/components/integrations/jira-issue-chip.tsx` - Reusable chip showing issue key with colored status dot, opens Jira in new tab
- `apps/web/src/components/integrations/jira-activity-summary.tsx` - Recent Jira activity card for contractor Workflows tab
- `apps/web/src/components/integrations/jira-task-config.tsx` - Inline task template Jira config toggle with mapping summary
- `apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx` - Added JiraActivitySummary at top, inline JiraIssueChips on run rows
- `apps/web/src/components/workflows/workflow-side-panel.tsx` - Added Linked Issues section with JiraIssueChip rendering

## Decisions Made
- JiraIssueChip uses base-ui Tooltip component for summary hover rather than title attribute for consistent UX
- RunJiraChips uses onClick stopPropagation to prevent Link navigation when clicking chip anchors
- All Jira sections conditionally render based on connectionStatus query with staleTime Infinity to avoid re-fetching per row
- Used `unknown` intermediate type assertion for tRPC response types (consistent with parallel execution pattern from Phases 16, 18)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict type assertion for recentActivity response**
- **Found during:** Task 1 (JiraActivitySummary)
- **Issue:** Direct `as RecentActivityItem[]` cast failed because tRPC return type has `JsonValue` for metadataJson
- **Fix:** Used `as unknown as RecentActivityItem[]` double assertion (matches existing codebase pattern)
- **Files modified:** apps/web/src/components/integrations/jira-activity-summary.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** a53cf71 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal - standard type assertion pattern already used throughout codebase.

## Issues Encountered
- Pre-existing build failure in `packages/api/src/services/time-entry.ts` (loosely typed PrismaClient from Phase 18) prevents full turbo build. Verified our files compile correctly via targeted `tsc --noEmit` on the web app. This is out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all components wire to real tRPC queries from Plan 02.

## Next Phase Readiness
- All display components complete and wired into views
- Ready for Plan 05 (final verification/polish)

---
*Phase: 19-jira-integration*
*Completed: 2026-03-28*
