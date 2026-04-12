---
phase: 04-workflow-engine
plan: 04
subsystem: ui
tags: [react, next.js, trpc, collapsible, progress, workflow, comments, attachments]

requires:
  - phase: 04-01
    provides: "Workflow tRPC router with getRun, completeTask, skipTask, reassignTask, cancelRun, addComment, listComments"
  - phase: 04-03
    provides: "Workflows page shell, runs table, side panel, template picker"
  - phase: 03-02
    provides: "DropZone and DocumentCard components for file upload and display"
provides:
  - "Workflow run detail page at /workflows/[id] with progress bar, breadcrumb, error/loading states"
  - "RunHeader with status badge, contractor/template links, metadata, cancel workflow dialog"
  - "TaskChecklist rendering ordered task cards with condition-skipped opacity"
  - "TaskCardRun with collapsible detail, inline Complete/Skip/Reassign actions"
  - "TaskComments with flat thread, relative timestamps, keyboard submit"
  - "TaskAttachments reusing Phase 3 DropZone and DocumentCard"
affects: [04-05, 05-workflow-integration]

tech-stack:
  added: []
  patterns: [collapsible-card-with-inline-actions, popover-mutation-pattern, reused-document-upload-flow]

key-files:
  created:
    - apps/web/src/app/[locale]/(dashboard)/workflows/[id]/page.tsx
    - apps/web/src/components/workflows/workflow-run/run-header.tsx
    - apps/web/src/components/workflows/workflow-run/task-checklist.tsx
    - apps/web/src/components/workflows/workflow-run/task-card-run.tsx
    - apps/web/src/components/workflows/workflow-run/task-comments.tsx
    - apps/web/src/components/workflows/workflow-run/task-attachments.tsx
  modified: []

key-decisions:
  - "Popover pattern for Skip/Reassign actions to keep task list compact while providing inline editing"
  - "Reused Phase 3 DropZone/DocumentCard for attachments with WORKFLOW_TASK_RUN entity type"
  - "calculateRunProgress helper duplicated in RunHeader (client-side) matching backend logic for consistency"

patterns-established:
  - "Collapsible card with inline action buttons pattern for task interactions"
  - "Popover-based mutation forms (Skip reason, Reassign user picker) for compact inline editing"
  - "Keyboard shortcut (Cmd+Enter) for comment submission"

requirements-completed: [WKFL-05, WKFL-06, WKFL-07, WKFL-08, WKFL-09, WKFL-10]

duration: 6min
completed: 2026-03-20
---

# Phase 4 Plan 04: Workflow Run Detail Summary

**Workflow run detail page with progress bar, task checklist, inline Complete/Skip/Reassign actions, threaded comments, and file attachments using Phase 3 document components**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T16:41:33Z
- **Completed:** 2026-03-20T16:47:35Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Complete workflow run detail page at /workflows/[id] with breadcrumb, progress bar, error/loading states
- RunHeader with status badge, contractor/template links, cancel workflow AlertDialog, overdue indicator
- TaskCardRun with collapsible expansion, all status/type icons per UI-SPEC, inline action buttons
- Skip popover with reason textarea, Reassign popover with user select, Complete button with mutation
- TaskComments with flat thread display, relative timestamps via date-fns, Cmd+Enter keyboard submit
- TaskAttachments reusing Phase 3 DropZone and DocumentCard with toggle visibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Create workflow run detail page and header components** - `07a4d56` (feat)
2. **Task 2: Create task card with inline actions, comments, and attachments** - `4a9b8dd` (feat)

## Files Created/Modified
- `apps/web/src/app/[locale]/(dashboard)/workflows/[id]/page.tsx` - Workflow run detail page with breadcrumb, error states, loading skeleton
- `apps/web/src/components/workflows/workflow-run/run-header.tsx` - Header with progress bar, status badge, metadata, cancel workflow dialog
- `apps/web/src/components/workflows/workflow-run/task-checklist.tsx` - Vertical task list with condition-skipped opacity handling
- `apps/web/src/components/workflows/workflow-run/task-card-run.tsx` - Collapsible task card with status/type icons, inline actions (Complete, Skip, Reassign)
- `apps/web/src/components/workflows/workflow-run/task-comments.tsx` - Flat comment thread with relative timestamps and inline post form
- `apps/web/src/components/workflows/workflow-run/task-attachments.tsx` - Attachments section reusing Phase 3 DropZone and DocumentCard

## Decisions Made
- Popover pattern for Skip/Reassign actions keeps task list compact while providing inline editing without full dialogs
- Reused Phase 3 DropZone/DocumentCard for attachments with WORKFLOW_TASK_RUN entity type cast
- Client-side progress calculation mirrors backend calculateProgress logic for UI consistency

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Select onValueChange type mismatch**
- **Found during:** Task 2 (Reassign popover)
- **Issue:** base-ui Select onValueChange passes `string | null` but React setState expects `string`
- **Fix:** Wrapped with null coalescing: `(val) => setSelectedUserId(val ?? "")`
- **Files modified:** task-card-run.tsx
- **Verification:** TypeScript compilation succeeds
- **Committed in:** 4a9b8dd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type fix for base-ui compatibility. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Workflow run detail page complete, ready for contractor profile integration (04-05)
- All WKFL-05 through WKFL-10 requirements addressed
- Pre-existing TypeScript error in templates-table.tsx (seedStarterTemplates) is unrelated to this plan

## Self-Check: PASSED

All 6 created files verified on disk. Both task commits (07a4d56, 4a9b8dd) verified in git log.

---
*Phase: 04-workflow-engine*
*Completed: 2026-03-20*
