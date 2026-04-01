---
phase: 29-linear-integration
plan: 03
subsystem: ui
tags: [react, linear, trpc, i18n, integrations, shadcn]

# Dependency graph
requires:
  - phase: 29-01
    provides: Linear adapter, tRPC router, Zod schemas
  - phase: 29-02
    provides: Status mapping service, issue sync service, webhook handler
provides:
  - LinearProviderSection with post-OAuth mandatory mapping flow (D-03)
  - LinearStatusMappingDialog with smart defaults per team (D-02)
  - LinearIssueChip with purple branding and status dots
  - LinearTaskConfig for workflow template editor (D-05)
  - i18n strings in English and Polish for all Linear UI
affects: [29-linear-integration, workflow-views, integrations-settings]

# Tech tracking
tech-stack:
  added: [react-icons/si SiLinear]
  patterns: [Provider section + mapping dialog pattern mirrored from Jira, PENDING_MAPPING auto-open UX]

key-files:
  created:
    - apps/web/src/components/integrations/linear-logo.tsx
    - apps/web/src/components/integrations/linear-provider-section.tsx
    - apps/web/src/components/integrations/linear-status-mapping-dialog.tsx
    - apps/web/src/components/integrations/linear-issue-chip.tsx
    - apps/web/src/components/integrations/linear-task-config.tsx
  modified:
    - apps/web/src/components/integrations/brand-icons.tsx
    - apps/web/src/components/integrations/provider-icons.tsx
    - apps/web/src/components/settings/integrations-tab.tsx
    - apps/web/src/components/workflows/template-builder/task-card.tsx
    - apps/web/src/components/workflows/workflow-side-panel.tsx
    - apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json
    - packages/api/src/routers/linear.ts

key-decisions:
  - "Used SiLinear from react-icons/si for brand icon, consistent with existing Jira/Slack/Notion pattern"
  - "Added connectionStatus and linkedIssues tRPC endpoints to Linear router for UI queries"

patterns-established:
  - "Provider section + mapping dialog replication: mirror Jira pattern for new PM integrations"
  - "PENDING_MAPPING auto-open: useEffect opens mapping dialog when post-OAuth status is PENDING_MAPPING"

requirements-completed: [LIN-02, LIN-03, LIN-06]

# Metrics
duration: 11min
completed: 2026-04-02
---

# Phase 29 Plan 03: Linear Integration UI Summary

**Linear provider section with post-OAuth mandatory mapping flow, status mapping dialog with smart defaults, workflow template team selector, issue chips on workflow task views, and full EN/PL i18n**

## Performance

- **Duration:** 11 min
- **Started:** 2026-04-01T23:33:43Z
- **Completed:** 2026-04-01T23:44:43Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Linear provider section renders in integrations tab with PENDING_MAPPING auto-open for mandatory mapping flow (D-03)
- Status mapping dialog shows per-team Linear states with smart defaults algorithm matching by name keywords and state type (D-02)
- LinearIssueChip with oklch purple branding, status dots for 6 Linear state types, and accessible external link
- Linear task config (enable toggle + team selector) mounted in workflow template editor (D-05)
- All Linear UI copy internationalized in English and Polish (46 keys each)

## Task Commits

Each task was committed atomically:

1. **Task 1: Linear logo + provider section + status mapping dialog + task config** - `e1d0db8` (feat)
2. **Task 2: Linear issue chip + mount in workflow task views + i18n strings** - `35771d8` (feat)

## Files Created/Modified
- `apps/web/src/components/integrations/linear-logo.tsx` - Linear logo re-export from brand-icons
- `apps/web/src/components/integrations/linear-provider-section.tsx` - Provider section with PENDING_MAPPING flow
- `apps/web/src/components/integrations/linear-status-mapping-dialog.tsx` - Per-team status mapping with smart defaults
- `apps/web/src/components/integrations/linear-issue-chip.tsx` - Purple-branded issue chip with status dots
- `apps/web/src/components/integrations/linear-task-config.tsx` - Enable toggle and team selector for workflow templates
- `apps/web/src/components/integrations/brand-icons.tsx` - Added LinearBrandIcon using SiLinear
- `apps/web/src/components/integrations/provider-icons.tsx` - Added LinearIcon export
- `apps/web/src/components/settings/integrations-tab.tsx` - Added LinearProviderSection to grid
- `apps/web/src/components/workflows/template-builder/task-card.tsx` - Added LinearTaskConfig
- `apps/web/src/components/workflows/workflow-side-panel.tsx` - Added LinkedLinearIssuesSection
- `apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx` - Added RunLinearChips
- `apps/web/messages/en.json` - 46 Linear i18n keys
- `apps/web/messages/pl.json` - 46 Linear i18n keys with proper Polish diacritics
- `packages/api/src/routers/linear.ts` - Added connectionStatus and linkedIssues endpoints

## Decisions Made
- Used SiLinear from react-icons/si for the brand icon, consistent with how Jira (SiJira), Slack (SiSlack), and other providers use Simple Icons
- Added connectionStatus and linkedIssues tRPC endpoints to the Linear router -- the plan focused on UI but these API endpoints were needed for the components to function (Rule 3: blocking)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added connectionStatus endpoint to Linear tRPC router**
- **Found during:** Task 1 (LinearStatusMappingDialog needs connectionId for saveStatusMapping)
- **Issue:** Health endpoint does not return connectionId; mapping dialog needs it to call saveStatusMapping
- **Fix:** Added connectionStatus query to Linear router returning {id, status, configJson}
- **Files modified:** packages/api/src/routers/linear.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** e1d0db8 (Task 1 commit)

**2. [Rule 3 - Blocking] Added linkedIssues endpoint to Linear tRPC router**
- **Found during:** Task 1 (workflow-side-panel needs WORKFLOW_RUN-level linked issues query)
- **Issue:** Linear router only had getLinkedIssue (single task) and getLinkedIssues (batch by task IDs), but no workflow-run-level query matching Jira's linkedIssues pattern
- **Fix:** Added linkedIssues query mirroring Jira router's implementation for WORKFLOW_RUN and WORKFLOW_TASK_RUN entity types
- **Files modified:** packages/api/src/routers/linear.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** e1d0db8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both API endpoints were essential for the UI components to function. No scope creep -- these are the minimum backend queries needed for the planned UI.

## Issues Encountered
- TypeScript could not resolve trpc.linear namespace until API package was rebuilt (pnpm --filter @contractor-ops/api build) -- expected for monorepo with compiled packages

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Linear UI components are complete and type-safe
- Linear integration is fully wired: OAuth connect, mandatory mapping, workflow template config, issue display
- Phase 29 (Linear Integration) is complete across all 3 plans

---
*Phase: 29-linear-integration*
*Completed: 2026-04-02*
