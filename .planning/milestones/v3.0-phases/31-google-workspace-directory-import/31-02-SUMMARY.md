---
phase: 31-google-workspace-directory-import
plan: 02
subsystem: ui
tags: [google-workspace, directory-import, wizard, tanstack-table, dialog, i18n, trpc]

# Dependency graph
requires:
  - phase: 31-01
    provides: tRPC router with listDirectory, listUserGroups, bulkImport, triggerSync, syncStatus
provides:
  - GoogleWorkspaceProviderSection with connect/disconnect and sync controls
  - DirectoryImportWizard 3-step dialog (preview/roles/confirm)
  - DirectoryPreviewTable with TanStack Table, selection, search, org unit filter, pagination
  - DirectorySummaryBar with live counts
  - RoleAssignmentControls and GroupRoleMappingStep for role assignment
  - ImportConfirmStep with role breakdown
  - Complete en/pl i18n translations
affects: [31-03, 31-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [base-ui render prop for TooltipTrigger, indeterminate checkbox prop for select-all]

key-files:
  created:
    - apps/web/src/components/integrations/google-workspace-provider-section.tsx
    - apps/web/src/components/integrations/google-workspace-logo.tsx
    - apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx
    - apps/web/src/components/integrations/google-workspace/directory-preview-table.tsx
    - apps/web/src/components/integrations/google-workspace/directory-summary-bar.tsx
    - apps/web/src/components/integrations/google-workspace/role-assignment-controls.tsx
    - apps/web/src/components/integrations/google-workspace/group-role-mapping-step.tsx
    - apps/web/src/components/integrations/google-workspace/import-confirm-step.tsx
    - apps/web/src/components/integrations/google-workspace/sync-status-section.tsx
  modified:
    - apps/web/src/components/settings/integrations-tab.tsx
    - apps/web/messages/en.json
    - apps/web/messages/pl.json

key-decisions:
  - "base-ui TooltipTrigger uses render prop (not asChild) for custom trigger elements"
  - "base-ui Checkbox uses indeterminate prop for mixed select-all state"
  - "Role options use full Better Auth role enum (8 roles) consistent with Plan 01 backend"

patterns-established:
  - "render prop pattern for base-ui Trigger components with custom render elements"
  - "Map<string, DirectoryRole> for group-to-role mappings in wizard state"

requirements-completed: [GOOG-01, GOOG-02, GOOG-03, GOOG-04]

# Metrics
duration: 6min
completed: 2026-04-02
---

# Phase 31 Plan 02: UI Components Summary

**Complete Google Workspace directory import UI: 9 components with 3-step wizard, TanStack Table with selection/search/filter, role assignment with group mapping, and en/pl i18n**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-02T15:28:22Z
- **Completed:** 2026-04-02T15:35:15Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- 9 UI components from UI-SPEC component inventory created and wired
- 3-step import wizard (Preview -> Roles -> Confirm) with full tRPC integration
- TanStack Table with checkbox selection, 300ms debounced search, org unit filter, 20-row pagination
- Role assignment with group-to-role mapping supporting all 8 Better Auth system roles
- Complete en.json and pl.json translations under GoogleWorkspace namespace

## Task Commits

Each task was committed atomically:

1. **Task 1: Provider section, logo, sync status, and integrations tab wiring** - `23e6f64` (feat)
2. **Task 2: Multi-step import wizard with preview table, role mapping, and i18n** - `c1e5e04` (feat)

## Files Created/Modified
- `apps/web/src/components/integrations/google-workspace-logo.tsx` - 4-color Google G SVG brand icon
- `apps/web/src/components/integrations/google-workspace-provider-section.tsx` - Provider card with D-04 auto-open on OAuth redirect
- `apps/web/src/components/integrations/google-workspace/sync-status-section.tsx` - Sync controls with manual trigger
- `apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx` - 3-step wizard dialog orchestrator
- `apps/web/src/components/integrations/google-workspace/directory-preview-table.tsx` - TanStack Table with selection, search, filter
- `apps/web/src/components/integrations/google-workspace/directory-summary-bar.tsx` - Live counts bar with aria-live
- `apps/web/src/components/integrations/google-workspace/role-assignment-controls.tsx` - Default role picker
- `apps/web/src/components/integrations/google-workspace/group-role-mapping-step.tsx` - Group-to-role mapping cards
- `apps/web/src/components/integrations/google-workspace/import-confirm-step.tsx` - Confirmation with role breakdown
- `apps/web/src/components/settings/integrations-tab.tsx` - Added GoogleWorkspaceProviderSection
- `apps/web/messages/en.json` - GoogleWorkspace namespace + Settings.integrations.googleWorkspace
- `apps/web/messages/pl.json` - Full Polish translations with diacritics

## Decisions Made
- Used base-ui `render` prop pattern for TooltipTrigger (base-ui does not support `asChild`)
- Used `indeterminate` prop on base-ui Checkbox for mixed select-all state
- Maintained full 8-role enum from Better Auth (matching Plan 01 backend) instead of simplified 3-role set from original plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TooltipTrigger API for base-ui**
- **Found during:** Task 2 (directory-preview-table)
- **Issue:** Plan specified `asChild` prop on TooltipTrigger, but base-ui uses `render` prop pattern
- **Fix:** Changed from `<TooltipTrigger asChild><Badge>` to `<TooltipTrigger render={<Badge />}>`
- **Files modified:** directory-preview-table.tsx
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** c1e5e04 (Task 2 commit)

**2. [Rule 3 - Blocking] Fixed Checkbox mixed state API for base-ui**
- **Found during:** Task 2 (directory-preview-table)
- **Issue:** Plan used `checked="mixed"` but base-ui Checkbox uses `indeterminate` prop
- **Fix:** Changed to `checked={allVisibleSelected} indeterminate={someVisibleSelected}`
- **Files modified:** directory-preview-table.tsx
- **Verification:** `tsc --noEmit` passes clean
- **Committed in:** c1e5e04 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for base-ui compatibility. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None - all components are fully wired to tRPC endpoints with real data flows.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All UI components ready for Plan 03 (sync service/notifications) and Plan 04 (testing)
- Wizard fully wired to all 5 tRPC procedures from Plan 01
- i18n complete for both en and pl

---
*Phase: 31-google-workspace-directory-import*
*Completed: 2026-04-02*
