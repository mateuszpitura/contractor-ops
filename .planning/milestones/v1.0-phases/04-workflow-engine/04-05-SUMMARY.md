---
phase: 04-workflow-engine
plan: 05
subsystem: ui, api
tags: [trpc, react, workflow, sidebar-badge, template-seeding, bulk-action, contractor-profile]

# Dependency graph
requires:
  - phase: 04-01
    provides: Workflow router with listRuns, startRun, overdueCount, listTemplates
  - phase: 04-03
    provides: Workflows page with runs table, templates table, template picker dialog
provides:
  - Contractor profile Workflows tab with run list and Start workflow CTA
  - Profile header Start onboarding/offboarding buttons wired to TemplatePicker
  - Bulk action Launch workflow for single or multiple contractors
  - Sidebar overdue count badge (60s polling)
  - Starter template seeding (Onboarding + Offboarding) on first Templates tab visit
affects: [05-invoice-pipeline, 07-notifications]

# Tech tracking
tech-stack:
  added: []
  patterns: [auto-seed on first visit, sidebar badge polling, bulk workflow launch]

key-files:
  created:
    - apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx
    - apps/web/src/components/workflows/workflow-nav-badge.tsx
  modified:
    - apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx
    - apps/web/src/components/contractors/contractor-profile/profile-header.tsx
    - apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx
    - apps/web/src/components/layout/nav-items.tsx
    - apps/web/src/components/workflows/templates-table.tsx
    - packages/api/src/routers/workflow.ts
    - apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx

key-decisions:
  - "Start onboarding/offboarding as explicit header buttons (not just dropdown lifecycle actions) for workflow entry point visibility"
  - "Starter templates use ROLE_BASED assignees with domain-appropriate roles (OPS_MANAGER, LEGAL_VIEWER, IT_ADMIN, FINANCE_ADMIN, TEAM_MANAGER)"
  - "Seed-if-empty pattern: seedStarterTemplates is no-op when templates exist, called on Templates tab mount"

patterns-established:
  - "Sidebar badge component pattern: client component with refetchInterval polling, renders nothing when count is 0"
  - "Bulk workflow launch: TemplatePicker accepts contractorIds array for multi-contractor runs"

requirements-completed: [WKFL-05, WKFL-09, ORG-09]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 4 Plan 5: Integration Points Summary

**Workflow engine fully connected: contractor profile Workflows tab, header Start onboarding/offboarding buttons, bulk Launch workflow, sidebar overdue badge, and auto-seeded starter templates**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T16:41:34Z
- **Completed:** 2026-03-20T16:49:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Contractor profile Workflows tab replaces TabPlaceholder, showing run list with status badges and Start workflow CTA
- Profile header has visible Start onboarding/offboarding buttons that open TemplatePicker with type pre-filter
- Bulk action Launch workflow wired for single and multi-contractor selection
- Sidebar Workflows nav item shows overdue count red badge (polls every 60s)
- Two starter templates (Onboarding: 7 tasks, Offboarding: 5 tasks) seeded in DRAFT status on first Templates tab visit

## Task Commits

Each task was committed atomically:

1. **Task 1: Contractor profile Workflows tab and header buttons** - `7f351d9` (feat)
2. **Task 2: Bulk action, sidebar badge, and starter templates** - `04de045` (feat)

## Files Created/Modified
- `apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx` - New Workflows tab with listRuns query and TemplatePicker
- `apps/web/src/components/contractors/contractor-profile/profile-tabs.tsx` - Replaced TabPlaceholder for workflows with WorkflowsTab content
- `apps/web/src/components/contractors/contractor-profile/profile-header.tsx` - Added Start onboarding/offboarding buttons with TemplatePicker
- `apps/web/src/app/[locale]/(dashboard)/contractors/[id]/page.tsx` - Passes workflowsContent prop to ProfileTabs
- `apps/web/src/components/contractors/contractor-table/data-table-bulk-actions.tsx` - Wired Launch workflow with TemplatePicker
- `apps/web/src/components/workflows/workflow-nav-badge.tsx` - Overdue count badge with 60s polling
- `apps/web/src/components/layout/nav-items.tsx` - Added WorkflowNavBadge to workflows nav item
- `apps/web/src/components/workflows/templates-table.tsx` - Added seedStarterTemplates call on mount
- `packages/api/src/routers/workflow.ts` - Added seedStarterTemplates mutation with Onboarding + Offboarding templates

## Decisions Made
- Start onboarding/offboarding added as explicit buttons in profile header (visible per lifecycle stage) rather than modifying existing lifecycle dropdown actions -- clearer separation between lifecycle transitions and workflow starts
- Starter templates use proper role-based assignments (OPS_MANAGER, LEGAL_VIEWER, IT_ADMIN, FINANCE_ADMIN, TEAM_MANAGER) per plan spec
- Seed-if-empty pattern: mutation checks template count first, no-op if any exist, preventing duplicate seeding

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript enum type narrowing for task types**
- **Found during:** Task 2 (seedStarterTemplates)
- **Issue:** String literals not assignable to Prisma WorkflowTaskType and UserRole enums
- **Fix:** Added `as const` assertions to taskType and assigneeRole literals
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** TypeScript compilation succeeds
- **Committed in:** 04de045 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed role values to match UserRole enum**
- **Found during:** Task 2 (seedStarterTemplates)
- **Issue:** Plan originally used "admin" as role which isn't a valid UserRole enum value
- **Fix:** Updated to proper role enum values per plan spec (OPS_MANAGER, LEGAL_VIEWER, IT_ADMIN, etc.)
- **Files modified:** packages/api/src/routers/workflow.ts
- **Verification:** API TypeScript compilation succeeds
- **Committed in:** 04de045 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for TypeScript correctness. No scope creep.

## Issues Encountered
- TypeScript composite project reference required API package build (`tsc -b`) before web app could see new `seedStarterTemplates` procedure type -- resolved by building API declarations first

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow engine Phase 4 fully complete -- all 5 plans executed
- All workflow entry points wired (profile tab, header buttons, bulk action, /workflows page)
- Sidebar badge provides overdue visibility
- Starter templates give admins a starting point to customize
- Ready for Phase 5 (Invoice Pipeline) or Phase 7 (Notifications)

---
*Phase: 04-workflow-engine*
*Completed: 2026-03-20*
