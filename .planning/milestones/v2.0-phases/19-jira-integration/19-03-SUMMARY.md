---
phase: 19-jira-integration
plan: 03
subsystem: ui
tags: [jira, react, shadcn, dialog, status-mapping, provider-card]

# Dependency graph
requires:
  - phase: 19-jira-integration
    provides: Jira tRPC router with 11 procedures (connection status, projects, issue types, status mapping CRUD, task config)
  - phase: 12-integration-foundation
    provides: ProviderConnectionCard, integration health queries
provides:
  - JiraLogo SVG component with Jira brand blue
  - JiraProviderSection with OAuth connect, scope expansion warning, and mapping CTA
  - JiraStatusMappingDialog for per-project bidirectional status mapping
  - JiraProjectMappingDialog for per-task-template Jira project/issue type configuration
affects: [19-04-ui-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [provider-section-with-custom-dialog, two-column-mapping-table]

key-files:
  created:
    - apps/web/src/components/integrations/jira-logo.tsx
    - apps/web/src/components/integrations/jira-provider-section.tsx
    - apps/web/src/components/integrations/jira-status-mapping-dialog.tsx
    - apps/web/src/components/integrations/jira-project-mapping-dialog.tsx
  modified:
    - apps/web/src/components/settings/integrations-tab.tsx

key-decisions:
  - "JiraProviderSection follows KsefProviderSection pattern: custom wrapper around ProviderConnectionCard with additional controls"
  - "Status mapping dialog uses project selector + two-column table (WorkflowStatus vs Jira Transition) with unmapped warnings"
  - "Rebuilt API package types with noEmitOnError false to work around pre-existing time-entry.ts errors from parallel Phase 18 agent"

patterns-established:
  - "Provider section pattern: ProviderConnectionCard + custom controls wrapper for providers needing extra UI beyond standard OAuth connect/disconnect"
  - "Mapping dialog pattern: project-scoped configuration with Select + Table layout for status mapping UIs"

requirements-completed: [JIRA-01, JIRA-02, JIRA-03]

# Metrics
duration: 8min
completed: 2026-03-28
---

# Phase 19 Plan 03: Jira Integration Settings UI Summary

**Jira provider card with OAuth connect, scope expansion detection, status mapping dialog with per-project two-column table, and project/issue type mapping dialog for task templates**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T13:12:40Z
- **Completed:** 2026-03-28T13:20:40Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- JiraLogo SVG component with Jira brand blue (#0052CC) and gradient overlapping triangles
- JiraProviderSection with ProviderConnectionCard, scope expansion re-auth warning, and "Configure Status Mapping" button
- JiraStatusMappingDialog with project selector, six workflow statuses mapped to Jira transitions via Select dropdowns, unmapped row warnings with AlertTriangle + Tooltip
- JiraProjectMappingDialog with project picker, issue type picker, and "Create Jira issue when task activates" Switch
- IntegrationsTab updated with Jira provider in grid alongside Slack and KSeF

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JiraLogo, JiraProviderSection, and wire into IntegrationsTab** - `f9a8c20` (feat)
2. **Task 2: Create JiraStatusMappingDialog and JiraProjectMappingDialog** - `11c0816` (feat)

## Files Created/Modified
- `apps/web/src/components/integrations/jira-logo.tsx` - Jira SVG logo component with brand blue fill and gradient overlapping triangles
- `apps/web/src/components/integrations/jira-provider-section.tsx` - Provider section wrapping ProviderConnectionCard with scope expansion warning and status mapping CTA
- `apps/web/src/components/integrations/jira-status-mapping-dialog.tsx` - Dialog with project selector, WorkflowStatus-to-Jira-Transition two-column mapping table, unmapped warnings, save mutation
- `apps/web/src/components/integrations/jira-project-mapping-dialog.tsx` - Dialog with project/issue type pickers, auto-create Switch, save task config mutation
- `apps/web/src/components/settings/integrations-tab.tsx` - Added Jira to PROVIDER_CONFIG, filtered from standard providers, rendered JiraProviderSection in grid

## Decisions Made
- Followed KsefProviderSection pattern for JiraProviderSection: custom wrapper around standard ProviderConnectionCard with additional controls rendered below
- Used base-ui Select with `string | null` onValueChange signatures, casting where needed for compatibility
- Built API package types with `noEmitOnError false` workaround since pre-existing time-entry.ts errors from parallel Phase 18 agent prevented normal type emission

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] API package types not emitted due to pre-existing errors**
- **Found during:** Task 1
- **Issue:** `trpc.jira.*` not available in web app because API package build failed on pre-existing time-entry.ts errors (from parallel Phase 18 work), preventing type emission with `noEmitOnError: true`
- **Fix:** Ran `npx tsc --noEmitOnError false` in packages/api to emit types despite pre-existing errors
- **Files modified:** None (dist output only)
- **Verification:** Web app TypeScript compiles with zero errors on all Jira files
- **Committed in:** No commit needed (build artifact only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Workaround necessary for type availability. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in time-entry.ts, time-source-badge.tsx, and timesheet-header.tsx (from parallel Phase 18 agent) prevent full monorepo build, but all new Jira files compile without errors when checked independently

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All four UI components ready for Plan 04 (UI views) to consume
- JiraStatusMappingDialog can be opened from JiraProviderSection when connected
- JiraProjectMappingDialog available for workflow task template editor integration
- Status mapping and task config mutations wired to Plan 02 tRPC procedures

---
*Phase: 19-jira-integration*
*Completed: 2026-03-28*
