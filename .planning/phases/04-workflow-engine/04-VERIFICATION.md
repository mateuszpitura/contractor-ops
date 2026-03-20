---
phase: 04-workflow-engine
verified: 2026-03-20T00:00:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
---

# Phase 4: Workflow Engine Verification Report

**Phase Goal:** Admins can build workflow templates with task dependencies and conditional logic, and users can run workflows that auto-assign tasks, track progress, and flag overdue items
**Verified:** 2026-03-20
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Workflow template CRUD works via tRPC with tenant isolation and RBAC | VERIFIED | `workflowRouter` in `packages/api/src/routers/workflow.ts` exports `createTemplate`, `updateTemplate`, `getTemplate`, `listTemplates`, `deleteTemplate`, `duplicateTemplate` — all behind `tenantProcedure` + `requirePermission` |
| 2 | Workflow run can be started from a template; tasks instantiated with resolved assignees and evaluated conditions | VERIFIED | `startRun` procedure at line 556 uses `evaluateCondition` (line 80) and `resolveAssignee` (line 123) inside a `$transaction`; `dependsOnTaskTemplateId` is mapped to `dependsOnTaskRunId` via `taskIdMap` |
| 3 | Task actions (complete, skip, reassign) enforce valid status transitions and unblock dependents | VERIFIED | `TASK_TRANSITIONS` map at line 198; `completeTask`, `skipTask` unblock dependents by updating status from `BLOCKED` to `TODO`; `isValidTransition` helper enforces the map |
| 4 | Comments and attachments can be added to workflow tasks | VERIFIED | `addComment` (line 1167), `listComments` procedures in router; `task-comments.tsx` and `task-attachments.tsx` wire to them; `task-attachments.tsx` reuses Phase 3 `DropZone` and `DocumentCard` |
| 5 | Overdue tasks are detectable via query-time dueAt comparison | VERIFIED | `overdueCount` procedure (line 1243) queries `dueAt lt new Date()`; `getRun` adds computed `isOverdue` field; UI components show `AlertCircle` with destructive styling |
| 6 | Admin can create/edit templates with drag-and-drop task reordering | VERIFIED | `template-form.tsx` calls `trpc.workflow.createTemplate/updateTemplate`; `sortable-task-list.tsx` uses `@dnd-kit/core` + `@dnd-kit/sortable` (installed at 6.3.1/10.0.0/3.2.2) |
| 7 | Admin can build AND/OR conditional rules per task | VERIFIED | `condition-builder.tsx` has `ConditionGroup` interface with `combinator: "AND" \| "OR"` and multi-rule rows; `conditionGroupSchema` in validators |
| 8 | User can view active workflow runs in sortable, filterable table | VERIFIED | `data-table.tsx` queries `trpc.workflow.listRuns`; `use-workflow-filters.ts` uses `useQueryStates` with `overdueOnly`, `status`, `templateId` URL params |
| 9 | User can view their assigned tasks in My Tasks tab | VERIFIED | `my-tasks-list.tsx` calls `trpc.workflow.myTasks`; overdue sorted to top with `AlertCircle` icon |
| 10 | User can start a workflow via template picker from multiple entry points | VERIFIED | `template-picker-dialog.tsx` calls `trpc.workflow.startRun`; wired in: main `/workflows` page, contractor profile header (`profile-header.tsx` with `preFilterType`), contractor profile Workflows tab, bulk actions |
| 11 | User can view workflow run detail with progress bar and task checklist | VERIFIED | `/workflows/[id]/page.tsx` fetches `trpc.workflow.getRun`; `run-header.tsx` renders `Progress` component; `task-checklist.tsx` renders `TaskCardRun` list |
| 12 | Assigned user can complete, skip, and reassign tasks inline | VERIFIED | `task-card-run.tsx` calls `trpc.workflow.completeTask`, `skipTask`, `reassignTask`; collapsible card with status-based action visibility |
| 13 | Workflow can be cancelled via header action with confirmation | VERIFIED | `run-header.tsx` has `AlertDialog` with "Cancel workflow" + calls `trpc.workflow.cancelRun` (line 133) |
| 14 | Contractor profile Workflows tab is functional (not a placeholder) | VERIFIED | `WorkflowsTab` imported in contractor `[id]/page.tsx` (line 27/161); `profile-tabs.tsx` accepts `workflowsContent` prop; `WorkflowsTab` calls `trpc.workflow.listRuns` with `contractorId` |
| 15 | Sidebar shows overdue count badge with 60s polling | VERIFIED | `workflow-nav-badge.tsx` calls `trpc.workflow.overdueCount` with `refetchInterval: 60_000`; `nav-items.tsx` imports and renders `WorkflowNavBadge` for the workflows nav item |
| 16 | Starter Onboarding and Offboarding templates are seeded on first Templates tab visit | VERIFIED | `seedStarterTemplates` procedure in router (line 1266) creates "Contractor Onboarding" (7 tasks) and "Contractor Offboarding" (5 tasks) when no templates exist |
| 17 | All Phase 4 UI strings are available in English and Polish | VERIFIED | `en.json` and `pl.json` both contain `Workflows` namespace with 175 keys each; key parity confirmed; `Procesy` present in PL; includes `pageTitle`, `emptyRunsHeading`, `toastTemplateSaved`, `conditionBadge` |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/validators/src/workflow.ts` | All Zod schemas for workflow domain | VERIFIED | Exports: `templateCreateSchema`, `conditionGroupSchema`, `startRunSchema`, `workflowRunListSchema`, `taskActionSchema`, `skipTaskSchema`, `reassignTaskSchema`, `addCommentSchema`, `cancelRunSchema`, `myTasksListSchema`, `TemplateCreateInput` type |
| `packages/api/src/routers/workflow.ts` | Complete workflow tRPC router | VERIFIED | Exports `workflowRouter`; 13+ procedures including all plan-specified ones + `seedStarterTemplates` |
| `packages/api/src/root.ts` | Root router with workflow registered | VERIFIED | Line 8: `import { workflowRouter }...`; line 28: `workflow: workflowRouter` |
| `apps/web/src/components/workflows/template-builder/template-form.tsx` | Template header form with lifecycle actions | VERIFIED | Calls `trpc.workflow.createTemplate` and `trpc.workflow.updateTemplate` |
| `apps/web/src/components/workflows/template-builder/sortable-task-list.tsx` | dnd-kit sortable container | VERIFIED | Uses `SortableContext`, `DndContext`, `@dnd-kit/utilities` |
| `apps/web/src/components/workflows/template-builder/task-card.tsx` | Collapsible task card with all fields | VERIFIED | Uses `Collapsible`, `GripVertical`; all fields present |
| `apps/web/src/components/workflows/template-builder/condition-builder.tsx` | AND/OR rule builder | VERIFIED | `ConditionGroup` interface with `combinator` field |
| `apps/web/src/components/workflows/template-builder/use-template-form.ts` | Form state management hook | VERIFIED | `useFieldArray`, `beforeunload` listener |
| `apps/web/src/app/[locale]/(dashboard)/workflows/templates/new/page.tsx` | New template page | VERIFIED | Renders `TemplateForm` without `templateId` |
| `apps/web/src/app/[locale]/(dashboard)/workflows/templates/[id]/page.tsx` | Edit template page | VERIFIED | Fetches `trpc.workflow.getTemplate`; renders `TemplateForm` with `templateId` |
| `apps/web/src/app/[locale]/(dashboard)/workflows/page.tsx` | Main workflows page with 3 tabs | VERIFIED | `Tabs` component, "Active runs", "My tasks", "Templates" tabs; wrapped in `Suspense` |
| `apps/web/src/components/workflows/workflow-runs-table/data-table.tsx` | TanStack Table for workflow runs | VERIFIED | `useReactTable`; queries `trpc.workflow.listRuns` |
| `apps/web/src/components/workflows/my-tasks-list.tsx` | My tasks flat list | VERIFIED | Calls `trpc.workflow.myTasks`; `AlertCircle` for overdue |
| `apps/web/src/components/workflows/templates-table.tsx` | Templates management table | VERIFIED | Calls `trpc.workflow.listTemplates` |
| `apps/web/src/components/workflows/template-picker-dialog.tsx` | Template picker dialog | VERIFIED | `Dialog` component; calls `trpc.workflow.startRun` |
| `apps/web/src/components/workflows/workflow-side-panel.tsx` | Run summary side panel | VERIFIED | `Sheet` component; `Progress` bar; calls `trpc.workflow.getRun` |
| `apps/web/src/app/[locale]/(dashboard)/workflows/[id]/page.tsx` | Workflow run detail page | VERIFIED | Calls `trpc.workflow.getRun` (SSR prefetch) |
| `apps/web/src/components/workflows/workflow-run/run-header.tsx` | Run header with progress and cancel | VERIFIED | `Progress`, `AlertDialog`, `cancelRun` mutation |
| `apps/web/src/components/workflows/workflow-run/task-card-run.tsx` | Task card with inline actions | VERIFIED | `completeTask`, `skipTask`, `reassignTask` mutations; `Collapsible`; `AlertCircle`, `CheckCircle2` |
| `apps/web/src/components/workflows/workflow-run/task-comments.tsx` | Inline comment thread | VERIFIED | `trpc.workflow.addComment`; `formatDistanceToNow` |
| `apps/web/src/components/workflows/workflow-run/task-attachments.tsx` | Inline attachments | VERIFIED | Imports `DropZone` and `DocumentCard` from Phase 3 |
| `apps/web/src/components/contractors/contractor-profile/workflows-tab.tsx` | Workflows tab for contractor profile | VERIFIED | `trpc.workflow.listRuns` with `contractorId`; `TemplatePicker` |
| `apps/web/src/components/workflows/workflow-nav-badge.tsx` | Overdue count badge | VERIFIED | `trpc.workflow.overdueCount`; `refetchInterval: 60_000` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/api/src/routers/workflow.ts` | `packages/validators/src/workflow.ts` | `import from @contractor-ops/validators` | WIRED | Line 16: imports all schemas |
| `packages/api/src/root.ts` | `packages/api/src/routers/workflow.ts` | router registration | WIRED | `workflow: workflowRouter` at line 28 |
| `template-form.tsx` | workflow router | `trpc.workflow.createTemplate/updateTemplate` | WIRED | Lines 116, 129 call mutations |
| `sortable-task-list.tsx` | `@dnd-kit/sortable` | SortableContext, useSortable | WIRED | Line 15 imports `SortableContext` |
| `data-table.tsx` | workflow router | `trpc.workflow.listRuns` | WIRED | Line 76 uses `listRuns.queryOptions` |
| `template-picker-dialog.tsx` | workflow router | `trpc.workflow.startRun` | WIRED | Line 114 uses `startRun.mutationOptions` |
| `task-card-run.tsx` | workflow router | `trpc.workflow.completeTask/skipTask/reassignTask` | WIRED | Lines 162, 235, 340 |
| `task-attachments.tsx` | `documents/drop-zone.tsx` | DropZone component import | WIRED | Line 10: `import { DropZone } from "@/components/documents/drop-zone"` |
| `workflows-tab.tsx` | workflow router | `trpc.workflow.listRuns` with contractorId | WIRED | Lines 66-67 |
| `workflow-nav-badge.tsx` | workflow router | `trpc.workflow.overdueCount` | WIRED | Line 14 |
| `nav-items.tsx` | `workflow-nav-badge.tsx` | WorkflowNavBadge rendered for workflows nav item | WIRED | Line 50: `{item.key === "workflows" && <WorkflowNavBadge />}` |
| `profile-header.tsx` | `template-picker-dialog.tsx` | TemplatePicker with preFilterType | WIRED | Lines 279, 283: `preFilterType={pickerType}`; ONBOARDING/OFFBOARDING types set on button click |
| `contractor [id]/page.tsx` | `workflows-tab.tsx` | WorkflowsTab via workflowsContent slot | WIRED | Lines 27, 161: WorkflowsTab passed as workflowsContent prop |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WKFL-01 | 04-01, 04-02 | Admin can create workflow templates | SATISFIED | `createTemplate` tRPC procedure + template builder UI at `/workflows/templates/new` |
| WKFL-02 | 04-01, 04-02 | Admin can define tasks with title, type, due offset, assignee role, required flag | SATISFIED | `taskTemplateInputSchema` covers all fields; `task-card.tsx` exposes all in UI |
| WKFL-03 | 04-01, 04-02 | Admin can define task dependencies | SATISFIED | `dependsOnTaskTemplateId` in schema; dependency Select in task card; `dependsOnTaskRunId` mapped at run start |
| WKFL-04 | 04-01, 04-02 | Admin can add conditional logic | SATISFIED | `conditionGroupSchema`, `evaluateCondition` helper; `condition-builder.tsx` UI |
| WKFL-05 | 04-01, 04-03, 04-04, 04-05 | User can start a workflow run from a template | SATISFIED | `startRun` procedure; `template-picker-dialog.tsx` wired in profile header, profile tab, bulk actions, /workflows page |
| WKFL-06 | 04-01 | System resolves role-based task assignments at runtime | SATISFIED | `resolveAssignee` function handles FIXED_USER, ROLE_BASED, CONTRACTOR_OWNER, CONTRACT_OWNER, PROJECT_MANAGER modes |
| WKFL-07 | 04-01, 04-04 | Assigned user can complete, skip, or reassign tasks | SATISFIED | `completeTask`, `skipTask`, `reassignTask` procedures + `task-card-run.tsx` inline actions |
| WKFL-08 | 04-01, 04-04 | User can add comments and attachments to workflow tasks | SATISFIED | `addComment`/`listComments` procedures; `task-comments.tsx` and `task-attachments.tsx` |
| WKFL-09 | 04-01, 04-03, 04-04, 04-05 | System detects and flags overdue tasks | SATISFIED | `overdueCount` + `isOverdue` computed field; `AlertCircle` destructive styling; sidebar badge with 60s polling |
| WKFL-10 | 04-01, 04-03, 04-04 | User can view workflow progress (X/Y tasks complete) | SATISFIED | `calculateProgress` helper; `progressPercent` on run; `Progress` component in run header and side panel |
| ORG-09 | 04-01, 04-02, 04-05 | Admin can manage workflow templates (create, edit, activate/deactivate) | SATISFIED | Full template CRUD with activate/archive status mutations; `seedStarterTemplates` for starter templates |

All 11 requirement IDs are satisfied. No orphaned requirements found for Phase 4 in REQUIREMENTS.md.

---

### Anti-Patterns Found

No blockers or warnings found.

- `return null` at lines 152/154 of `workflow.ts` router: intentional fallback returns in the `resolveAssignee` switch statement for `PROJECT_MANAGER` and default cases — not a stub.
- All `TODO` string occurrences in the router are workflow status enum values (`"TODO"` as task status), not code comments.
- TypeScript compilation: clean (0 errors) in validators, api, and web packages.

---

### Human Verification Required

The following behaviors need manual testing as they cannot be verified programmatically:

#### 1. Drag-to-reorder tasks in template builder

**Test:** Open `/workflows/templates/new`, add 3+ tasks, drag the GripVertical handle of task 2 above task 1.
**Expected:** Task order updates immediately; `sortOrder` values reflect the new order on save.
**Why human:** DOM drag events cannot be simulated via grep/file checks.

#### 2. Conditional logic evaluation at run start

**Test:** Create a template with task that has condition `contractor.type = JDG`. Start a run for a non-JDG contractor. Verify the task is auto-skipped.
**Expected:** Task appears with status SKIPPED and `resultJson.skipReason = "condition_not_met"`; excluded from progress count.
**Why human:** Requires live tRPC call with a real database record.

#### 3. Dependent task unblocking flow

**Test:** Start a run with task B depending on task A. Complete task A. Verify task B moves from BLOCKED to TODO.
**Expected:** Task B status changes to TODO immediately; action buttons appear.
**Why human:** Requires live transaction execution and UI reactivity.

#### 4. Sidebar overdue badge appearance

**Test:** Have at least one overdue task assigned to the logged-in user. Navigate to the sidebar.
**Expected:** Red circle badge with count appears on the Workflows nav item.
**Why human:** Visual rendering requires a browser with live tRPC data.

#### 5. Starter template seeding on first Templates tab visit

**Test:** Log in to a fresh org with no workflow templates. Navigate to `/workflows?tab=templates`.
**Expected:** Two templates ("Contractor Onboarding" and "Contractor Offboarding") appear automatically.
**Why human:** Requires runtime mutation trigger from `templates-table.tsx` on mount.

---

### Gaps Summary

No gaps found. All 17 observable truths are verified, all artifacts exist and are substantively implemented, all key links are wired, all 11 requirement IDs are satisfied, and TypeScript compiles clean in all three packages.

One implementation note: the sidebar badge is wired in `nav-items.tsx` rather than `sidebar.tsx` as the plan specified. This is the correct location (sidebar delegates nav rendering to nav-items) and the integration is fully functional.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
