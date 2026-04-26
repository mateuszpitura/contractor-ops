# Phase 4: Workflow Engine - Research

**Researched:** 2026-03-20
**Domain:** Workflow template builder, execution engine, task management, conditional logic, drag-and-drop reordering
**Confidence:** HIGH

## Summary

Phase 4 builds a workflow engine on top of a fully-defined Prisma schema (WorkflowTemplate, WorkflowTaskTemplate, WorkflowRun, WorkflowTaskRun, WorkflowComment, WorkflowAttachment) with all enums, indexes, and relationships already in place. The phase covers: (1) admin template builder with drag-to-reorder task list and inline expandable cards, (2) AND/OR conditional logic engine stored as JSON in configJson, (3) runtime workflow execution with role-based assignment resolution, (4) task management UI with complete/skip/reassign/comment/attach actions, and (5) overdue detection with visual-only indicators (notifications deferred to Phase 7).

The project uses a mature stack: Next.js 15, React 19, tRPC 11, TanStack Query/Table, React Hook Form + Zod, Prisma 7, shadcn/ui, next-intl, nuqs, date-fns 4. All UI primitives needed are already installed. The main new dependency is `@dnd-kit/sortable` (v10) for drag-to-reorder in the template builder. The codebase has well-established patterns for tRPC routers, validators, table pages, forms, and document components that should be followed exactly.

**Primary recommendation:** Follow existing codebase patterns exactly (tRPC router + validators + TanStack Table + React Hook Form). Use `@dnd-kit/sortable` for drag reorder. Implement conditional logic as a pure function evaluator against a JSON rule schema. Use `prisma.$transaction()` for all multi-step mutations (template save, workflow start, task completion with dependency resolution).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Ordered task list with drag-to-reorder -- vertical list of task cards, "Add task" button at bottom
- Inline expandable task cards -- click to expand and edit all fields, collapse on save, no modal/dialog
- No preview/test mode in v1 -- admin saves template and starts a real run to verify
- 2 pre-built starter templates shipped: Onboarding and Offboarding with common tasks pre-populated
- Template list managed via "Templates" tab on /workflows page (admin-only tab)
- Template status lifecycle: Draft -> Active -> Archived
- Checklist with progress bar -- vertical task list with status icons, progress bar at top showing X/Y tasks complete
- Standalone /workflows page with tabs: "Active runs" (default), "My tasks", "Templates" (admin only)
- Overdue tasks surfaced visually only (red badge, overdue filter, sidebar count badge). Notification delivery deferred to Phase 7
- Multiple entry points to start workflow run: contractor profile header, /workflows page, contractor bulk action
- Inline actions on each task card: Complete, Skip (requires reason popover), Reassign (user picker popover)
- Threaded comments inline below task card when expanded -- plain text, no rich text in v1
- File attachments reuse Phase 3 document components (DropZone + DocumentCard)
- AND/OR rule builder for conditional logic -- multiple conditions combined with AND/OR operators, stored as JSON in configJson
- Available condition fields: Contractor (type, status, billingModel, team, complianceRiskLevel) and Contract (type, status, billingModel, currency)
- Operators: equals, not equals (for enums), contains/starts with (for strings)
- Auto-skipped tasks during runs when condition is not met -- excluded from progress count

### Claude's Discretion
- Drag-and-drop library choice for task reordering
- Exact task card layout and spacing
- Template form field layout and validation
- Workflow run cancellation flow
- Task status transition validation rules
- "Start workflow" template picker design
- Overdue detection interval/mechanism
- Starter template task content details
- Empty states for workflow pages

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WKFL-01 | Admin can create workflow templates (onboarding, offboarding, document collection, custom) | Template builder page with form fields mapping to WorkflowTemplate model, WorkflowTemplateType enum already defined |
| WKFL-02 | Admin can define tasks within templates with: title, type, description, due date offset, assignee role, required flag | WorkflowTaskTemplate model has all fields, inline expandable task cards in sortable list |
| WKFL-03 | Admin can define task dependencies (task B blocked until task A completes) | dependsOnTaskTemplateId field on WorkflowTaskTemplate, select from sibling tasks in template |
| WKFL-04 | Admin can add conditional logic (e.g., include task only if contractor type = JDG) | AND/OR rule JSON schema stored in configJson, condition evaluator function at runtime |
| WKFL-05 | User can start a workflow run from a template for a specific contractor | Template picker dialog, runtime task instantiation from template to WorkflowTaskRun records |
| WKFL-06 | System resolves role-based task assignments to specific users at runtime | AssigneeMode enum (FIXED_USER, ROLE_BASED, CONTRACTOR_OWNER, etc.), resolver function queries org members |
| WKFL-07 | Assigned user can complete, skip, or reassign tasks | Inline task actions, status transition validation, skip requires reason |
| WKFL-08 | User can add comments and attachments to workflow tasks | WorkflowComment + WorkflowAttachment models, reuse Phase 3 DropZone/DocumentCard |
| WKFL-09 | System detects and flags overdue tasks with notifications | Visual-only overdue detection (Phase 7 for notifications), check dueAt < now() on query |
| WKFL-10 | User can view workflow progress (X/Y tasks complete, timeline) | Progress bar component, count DONE tasks vs total (excluding condition-skipped) |
| ORG-09 | Admin can manage workflow templates (create, edit, activate/deactivate) | Template CRUD with status transitions: Draft -> Active -> Archived |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.3.x | App framework, routing | Project standard |
| React | 19.x | UI library | Project standard |
| tRPC | 11.x | Type-safe API layer | Project standard |
| TanStack Query | 5.60.x | Server state management | Project standard |
| TanStack Table | 8.21.x | Data table for runs and templates lists | Project standard |
| React Hook Form | 7.71.x | Form state management | Project standard |
| Zod | 3.23.x | Schema validation | Project standard |
| Prisma | 7.x | Database ORM | Project standard |
| shadcn/ui | 4.x | UI component primitives | Project standard |
| date-fns | 4.1.x | Date manipulation, due date calculations | Already used in Phase 3 |
| next-intl | 4.8.x | i18n | Project standard |
| nuqs | 2.8.x | URL state for table filters/pagination | Project standard |
| Lucide React | 0.577.x | Icons | Project standard |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @dnd-kit/core | 6.3.1 | Drag-and-drop primitives | Foundation for sortable task list |
| @dnd-kit/sortable | 10.0.0 | Sortable list preset | Task reordering in template builder |
| @dnd-kit/utilities | 3.2.2 | CSS utility transforms | Transform helpers for drag animations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @dnd-kit/sortable | @dnd-kit/react (v0.3.2) | Newer rewrite but pre-1.0, not production-ready. Stick with stable v10 |
| @dnd-kit/sortable | react-beautiful-dnd | Deprecated by Atlassian, not maintained. dnd-kit is the community standard |
| @dnd-kit/sortable | @hello-pangea/dnd | Fork of react-beautiful-dnd. Less flexible than dnd-kit for custom drag handles |

**Installation:**
```bash
pnpm add @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 --filter @contractor-ops/web
```

## Architecture Patterns

### Recommended Project Structure
```
packages/
├── api/src/routers/
│   └── workflow.ts              # All workflow tRPC procedures
├── validators/src/
│   └── workflow.ts              # Zod schemas for workflow CRUD, task actions
├── db/prisma/schema/
│   └── workflow.prisma          # Already defined - no changes needed

apps/web/src/
├── app/[locale]/(dashboard)/
│   ├── workflows/
│   │   ├── page.tsx             # /workflows - tabs: Active runs, My tasks, Templates
│   │   ├── [id]/
│   │   │   └── page.tsx         # /workflows/[id] - run detail page
│   │   └── templates/
│   │       ├── new/
│   │       │   └── page.tsx     # /workflows/templates/new
│   │       └── [id]/
│   │           └── page.tsx     # /workflows/templates/[id] - edit template
├── components/workflows/
│   ├── workflow-runs-table/     # TanStack Table for active runs (mirrors contract-table pattern)
│   │   ├── columns.tsx
│   │   ├── data-table.tsx
│   │   ├── data-table-toolbar.tsx
│   │   ├── data-table-filters.tsx
│   │   ├── data-table-pagination.tsx
│   │   └── use-workflow-filters.ts
│   ├── template-builder/        # Template editing
│   │   ├── template-form.tsx    # Template header form (name, type, description)
│   │   ├── sortable-task-list.tsx  # dnd-kit sortable container
│   │   ├── task-card.tsx        # Collapsible task card (expanded = edit form)
│   │   ├── condition-builder.tsx   # AND/OR rule builder
│   │   └── use-template-form.ts   # React Hook Form + dirty tracking
│   ├── workflow-run/            # Run detail components
│   │   ├── run-header.tsx       # Progress bar, contractor info, metadata
│   │   ├── task-checklist.tsx   # Vertical task list
│   │   ├── task-card-run.tsx    # Task with inline actions
│   │   ├── task-comments.tsx    # Comment thread
│   │   └── task-attachments.tsx # Reuses Phase 3 DropZone/DocumentCard
│   ├── template-picker-dialog.tsx  # Start workflow dialog
│   ├── my-tasks-list.tsx        # My tasks tab content
│   ├── templates-table.tsx      # Templates tab table
│   ├── workflow-side-panel.tsx  # Sheet for run preview
│   └── workflow-nav-badge.tsx   # Overdue count badge for sidebar
```

### Pattern 1: tRPC Router Structure (follow contract.ts exactly)
**What:** Single workflow router with all CRUD + action procedures
**When to use:** Always -- all workflow API endpoints in one router file
**Example:**
```typescript
// packages/api/src/routers/workflow.ts
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

export const workflowRouter = router({
  // Template CRUD (admin only)
  createTemplate: tenantProcedure
    .use(requirePermission({ workflow: ["create"] }))
    .input(templateCreateSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // Workflow run operations
  startRun: tenantProcedure
    .use(requirePermission({ workflow: ["create"] }))
    .input(startRunSchema)
    .mutation(async ({ ctx, input }) => {
      // Use $transaction for atomic template->run instantiation
      return prisma.$transaction(async (tx) => { /* ... */ });
    }),

  // Task actions
  completeTask: tenantProcedure
    .use(requirePermission({ workflow: ["update"] }))
    .input(z.object({ taskRunId: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),
});
```

### Pattern 2: Conditional Logic Schema and Evaluator
**What:** JSON schema for AND/OR rules stored in configJson, pure function evaluator
**When to use:** Template task conditions, runtime auto-skip resolution
**Example:**
```typescript
// Condition schema stored in WorkflowTaskTemplate.configJson
interface ConditionRule {
  field: string;      // e.g. "contractor.type", "contract.status"
  operator: "equals" | "notEquals" | "contains" | "startsWith";
  value: string;
}

interface ConditionGroup {
  combinator: "AND" | "OR";
  rules: ConditionRule[];
}

// Pure evaluator function
function evaluateCondition(
  condition: ConditionGroup | null,
  context: { contractor: Contractor; contract?: Contract }
): boolean {
  if (!condition || condition.rules.length === 0) return true;

  const results = condition.rules.map((rule) => {
    const fieldValue = getNestedValue(context, rule.field);
    switch (rule.operator) {
      case "equals": return fieldValue === rule.value;
      case "notEquals": return fieldValue !== rule.value;
      case "contains": return String(fieldValue).includes(rule.value);
      case "startsWith": return String(fieldValue).startsWith(rule.value);
    }
  });

  return condition.combinator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}
```

### Pattern 3: Assignee Resolution at Runtime
**What:** Resolve AssigneeMode to a specific userId when creating WorkflowTaskRun records
**When to use:** When starting a workflow run (WKFL-06)
**Example:**
```typescript
async function resolveAssignee(
  task: WorkflowTaskTemplate,
  contractor: Contractor,
  contract: Contract | null,
  orgId: string,
  tx: PrismaTransactionClient
): Promise<string | null> {
  switch (task.assigneeMode) {
    case "FIXED_USER":
      return task.assigneeUserId;
    case "ROLE_BASED":
      // Find first active user with matching role in org
      const member = await tx.member.findFirst({
        where: { organizationId: orgId, role: task.assigneeRole, user: { banned: false } },
      });
      return member?.userId ?? null;
    case "CONTRACTOR_OWNER":
      return contractor.internalOwnerUserId;
    case "CONTRACT_OWNER":
      return contract?.internalOwnerUserId ?? null;
    case "PROJECT_MANAGER":
      // Resolve via project assignment
      return null; // fallback
  }
}
```

### Pattern 4: Task Status Transition Validation
**What:** Enforce valid status transitions to prevent invalid states
**When to use:** Every task action (complete, skip, reassign)
**Example:**
```typescript
const TASK_TRANSITIONS: Record<string, string[]> = {
  TODO: ["IN_PROGRESS", "SKIPPED", "CANCELLED"],
  IN_PROGRESS: ["DONE", "SKIPPED", "CANCELLED"],
  BLOCKED: ["TODO"],  // unblocked by dependency completion
  DONE: [],            // terminal
  SKIPPED: [],         // terminal
  CANCELLED: [],       // terminal
  OVERDUE: ["DONE", "SKIPPED", "CANCELLED"], // can still be completed
};

function validateTransition(current: string, target: string): boolean {
  return (TASK_TRANSITIONS[current] ?? []).includes(target);
}
```

### Pattern 5: Progress Calculation (excluding auto-skipped)
**What:** Calculate progress excluding condition-skipped tasks from total
**When to use:** Progress bar display, run-level progressPercent
**Example:**
```typescript
function calculateProgress(tasks: WorkflowTaskRun[]): { done: number; total: number; percent: number } {
  // Condition-skipped tasks have resultJson.skipReason === "condition_not_met"
  const activeTasks = tasks.filter((t) => {
    if (t.status === "SKIPPED" && (t.resultJson as any)?.skipReason === "condition_not_met") {
      return false; // exclude from both numerator and denominator
    }
    return true;
  });

  const done = activeTasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED").length;
  const total = activeTasks.length;
  return { done, total, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}
```

### Anti-Patterns to Avoid
- **Putting business logic in React components:** All status transitions, condition evaluation, assignee resolution must be in tRPC procedures (server-side). UI only calls mutations.
- **Nested tRPC calls:** Do not call one tRPC procedure from another. Extract shared logic into helper functions.
- **Client-side date calculations for overdue:** Always compute overdue status server-side using database queries. Client receives the computed state.
- **Separate API calls per task when starting a run:** Use a single `prisma.$transaction()` to atomically create the run and all task runs together.
- **Using configJson for non-condition data:** configJson is specifically for conditional logic rules. Other task metadata has dedicated columns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom mouse/touch event handlers | @dnd-kit/sortable | Accessibility (keyboard DnD), touch support, smooth animations, collision detection |
| Sort order management | Manual index arithmetic | sortOrder Int field + bulk update on reorder | Prisma handles atomic reorder via $transaction |
| Date offset calculations | Manual date math | date-fns addDays/addHours | Timezone-safe, handles DST, well-tested |
| File attachments | Custom upload flow | Phase 3 DropZone + DocumentCard + document router | Already built and tested, consistent UX |
| Table with sort/filter/pagination | Custom list rendering | TanStack Table + nuqs URL state | Established pattern from Phase 2/3, mirrors contract table |
| Form validation | Manual validation | React Hook Form + Zod resolver | Project standard, type-safe |
| Optimistic updates | Manual state management | TanStack Query mutation + invalidation | Already established pattern |

**Key insight:** This phase is largely a composition of existing patterns (tRPC router, TanStack Table, React Hook Form) with domain-specific business logic (condition evaluation, assignee resolution, dependency tracking). The only truly new UI concern is drag-to-reorder with dnd-kit.

## Common Pitfalls

### Pitfall 1: Circular Task Dependencies
**What goes wrong:** Admin creates task A depends on B, then B depends on A. Workflow run gets permanently blocked.
**Why it happens:** No validation on dependency selection in template builder.
**How to avoid:** When setting dependsOnTaskTemplateId, filter the select options to exclude: (1) the current task, (2) any task that transitively depends on the current task. A simple forward-only rule: a task can only depend on a task with a lower sortOrder.
**Warning signs:** All tasks in a run stuck in BLOCKED status.

### Pitfall 2: Race Conditions in Task Completion
**What goes wrong:** Two users simultaneously complete the last two tasks. Both trigger "check if all tasks done -> mark run complete" logic. Run completion runs twice.
**Why it happens:** Non-atomic read-check-update pattern.
**How to avoid:** Use `prisma.$transaction()` with serializable isolation or an atomic UPDATE ... WHERE pattern. Check run status within the transaction.
**Warning signs:** Duplicate completion timestamps, race in progressPercent updates.

### Pitfall 3: Stale Assignee Resolution
**What goes wrong:** Template uses ROLE_BASED assignment for IT_ADMIN. No user has that role at run start. Task is created with null assignee.
**Why it happens:** Role-based assignment assumes at least one user exists for each role.
**How to avoid:** Return the unresolved task with assigneeRole still set but assigneeUserId = null. Show "Unassigned (no IT Admin found)" in UI. Allow reassignment. Do NOT fail the entire run start.
**Warning signs:** Tasks with no assignee in active runs.

### Pitfall 4: Template Edit While Runs Are Active
**What goes wrong:** Admin edits a template while active runs exist. Changes affect in-progress runs unexpectedly.
**Why it happens:** Runs reference template by FK, not snapshot.
**How to avoid:** WorkflowTaskRun copies title, description, taskType, required from template at instantiation time. Runs are decoupled from template changes after creation. The workflowTaskTemplateId FK is nullable for this reason -- it is a reference back, not a live dependency.
**Warning signs:** Task titles in runs changing unexpectedly.

### Pitfall 5: Progress Bar Flicker on Condition Evaluation
**What goes wrong:** Progress shows 0/12 briefly, then condition evaluation skips 2 tasks, progress jumps to 0/10.
**Why it happens:** Conditions evaluated client-side after initial data load.
**How to avoid:** Evaluate all conditions server-side when starting the run. Auto-skipped tasks are created with status=SKIPPED and resultJson.skipReason="condition_not_met" at creation time. Progress is always consistent from first render.
**Warning signs:** Progress bar jumping on page load.

### Pitfall 6: dnd-kit Drag Handle Not Working in Collapsible Cards
**What goes wrong:** Entire card becomes draggable or drag conflicts with click-to-expand.
**Why it happens:** useSortable activeDragOverlay vs inline drag handling conflicts with Collapsible click events.
**How to avoid:** Use the `activatorEvent` config on useSortable to restrict drag initiation to the GripVertical handle element only. Use a DragOverlay for the visual drag feedback so the original card stays in place.
**Warning signs:** Cards expanding when trying to drag, drag initiating when trying to click.

## Code Examples

### dnd-kit Sortable Task List
```typescript
// Source: @dnd-kit/sortable documentation
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"; // optional

function SortableTaskList({ tasks, onReorder }: Props) {
  const taskIds = tasks.map((t) => t.id);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = taskIds.indexOf(active.id as string);
      const newIndex = taskIds.indexOf(over.id as string);
      onReorder(arrayMove(tasks, oldIndex, newIndex));
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        {tasks.map((task) => (
          <SortableTaskCard key={task.id} task={task} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableTaskCard({ task }: { task: TaskTemplate }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Only the grip handle gets drag listeners */}
      <button {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="h-4 w-4" />
      </button>
      {/* Rest of the card content -- click to expand, no drag interference */}
      <TaskCardContent task={task} />
    </div>
  );
}
```

### Workflow Validator Schemas
```typescript
// packages/validators/src/workflow.ts
import { z } from "zod";

const workflowTemplateTypeEnum = z.enum([
  "ONBOARDING", "OFFBOARDING", "DOCUMENT_COLLECTION", "COMPLIANCE_REVIEW", "CUSTOM"
]);
const workflowTemplateStatusEnum = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
const workflowTaskTypeEnum = z.enum([
  "DOCUMENT_COLLECTION", "APPROVAL", "ACCESS_GRANT", "ACCESS_REVOKE",
  "FINANCE_SETUP", "EQUIPMENT", "KNOWLEDGE_TRANSFER", "MEETING", "MANUAL", "NOTIFICATION"
]);
const assigneeModeEnum = z.enum([
  "FIXED_USER", "ROLE_BASED", "CONTRACTOR_OWNER", "CONTRACT_OWNER", "PROJECT_MANAGER"
]);

const conditionRuleSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(["equals", "notEquals", "contains", "startsWith"]),
  value: z.string().min(1),
});

const conditionGroupSchema = z.object({
  combinator: z.enum(["AND", "OR"]),
  rules: z.array(conditionRuleSchema).min(1),
});

const taskTemplateInputSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  taskType: workflowTaskTypeEnum,
  sortOrder: z.number().int().nonnegative(),
  required: z.boolean(),
  assigneeMode: assigneeModeEnum,
  assigneeRole: z.string().optional(),  // UserRole enum value
  assigneeUserId: z.string().optional(),
  dueOffsetDays: z.number().int().nonnegative().optional(),
  dueOffsetHours: z.number().int().nonnegative().optional(),
  dependsOnTaskTemplateId: z.string().optional(),
  externalUrl: z.string().url().optional(),
  conditions: conditionGroupSchema.nullable().optional(),
});

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  type: workflowTemplateTypeEnum,
  description: z.string().optional(),
  tasks: z.array(taskTemplateInputSchema),
});

export const templateUpdateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  type: workflowTemplateTypeEnum.optional(),
  description: z.string().nullable().optional(),
  status: workflowTemplateStatusEnum.optional(),
  tasks: z.array(taskTemplateInputSchema.extend({
    id: z.string().optional(), // existing tasks have id, new ones don't
  })).optional(),
});

export const startRunSchema = z.object({
  templateId: z.string().min(1),
  contractorId: z.string().min(1),
  contractId: z.string().optional(),
});

export const workflowRunListSchema = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(10).max(50).default(25),
  search: z.string().optional(),
  sortBy: z.enum(["createdAt", "dueAt", "status", "startedAt"]).default("dueAt"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
  contractorId: z.string().optional(),
  filters: z.object({
    status: z.array(z.string()).optional(),
    templateId: z.array(z.string()).optional(),
    overdueOnly: z.boolean().optional(),
  }).optional(),
});

export const taskActionSchema = z.object({
  taskRunId: z.string().min(1),
});

export const skipTaskSchema = z.object({
  taskRunId: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export const reassignTaskSchema = z.object({
  taskRunId: z.string().min(1),
  newAssigneeUserId: z.string().min(1),
});

export const addCommentSchema = z.object({
  workflowRunId: z.string().min(1),
  workflowTaskRunId: z.string().optional(),
  body: z.string().min(1).max(5000),
});
```

### Overdue Detection Pattern
```typescript
// Server-side: query overdue tasks for sidebar badge
// Use in a tRPC query, called on page load / polling interval
const overdueTasks = await prisma.workflowTaskRun.count({
  where: {
    organizationId: ctx.organizationId,
    assigneeUserId: ctx.user.id,
    status: { in: ["TODO", "IN_PROGRESS"] },
    dueAt: { lt: new Date() },
  },
});
```

### Atomic Workflow Run Start
```typescript
// Inside startRun mutation
const run = await prisma.$transaction(async (tx) => {
  const template = await tx.workflowTemplate.findUniqueOrThrow({
    where: { id: input.templateId, organizationId: ctx.organizationId, status: "ACTIVE" },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });

  const contractor = await tx.contractor.findUniqueOrThrow({
    where: { id: input.contractorId, organizationId: ctx.organizationId },
  });

  const contract = input.contractId
    ? await tx.contract.findUnique({ where: { id: input.contractId } })
    : null;

  // Create run
  const workflowRun = await tx.workflowRun.create({
    data: {
      organizationId: ctx.organizationId,
      workflowTemplateId: template.id,
      entityType: "CONTRACTOR",
      entityId: contractor.id,
      contractorId: contractor.id,
      contractId: contract?.id ?? null,
      status: "IN_PROGRESS",
      startedByUserId: ctx.user.id,
      startedAt: new Date(),
    },
  });

  // Create task dependency ID mapping (template ID -> run ID)
  const taskIdMap = new Map<string, string>();

  // Create task runs
  for (const taskTemplate of template.tasks) {
    const condition = taskTemplate.configJson as ConditionGroup | null;
    const conditionMet = evaluateCondition(condition, { contractor, contract });

    const assigneeUserId = conditionMet
      ? await resolveAssignee(taskTemplate, contractor, contract, ctx.organizationId, tx)
      : null;

    const dueAt = conditionMet && taskTemplate.dueOffsetDays
      ? addDays(workflowRun.startedAt, taskTemplate.dueOffsetDays)
      : null;

    const dependsOnRunId = taskTemplate.dependsOnTaskTemplateId
      ? taskIdMap.get(taskTemplate.dependsOnTaskTemplateId) ?? null
      : null;

    const taskRun = await tx.workflowTaskRun.create({
      data: {
        organizationId: ctx.organizationId,
        workflowRunId: workflowRun.id,
        workflowTaskTemplateId: taskTemplate.id,
        title: taskTemplate.title,
        description: taskTemplate.description,
        taskType: taskTemplate.taskType,
        required: taskTemplate.required,
        assigneeUserId,
        assigneeRole: taskTemplate.assigneeRole,
        dueAt,
        dependsOnTaskRunId: dependsOnRunId,
        status: !conditionMet ? "SKIPPED" : dependsOnRunId ? "BLOCKED" : "TODO",
        resultJson: !conditionMet ? { skipReason: "condition_not_met" } : null,
      },
    });

    taskIdMap.set(taskTemplate.id, taskRun.id);
  }

  return workflowRun;
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-beautiful-dnd | @dnd-kit/sortable | 2022+ | react-beautiful-dnd deprecated by Atlassian. dnd-kit is the community standard |
| Custom workflow engines (Temporal, Inngest) | Database-driven state machine | N/A | For 5-50 org tool, external workflow engine is overkill. Prisma status fields + transitions suffice |
| Graph-based workflow editors | Linear task list with dependencies | N/A | User decision: ordered list, not visual graph. Simpler UX for 5-20 task workflows |

**Not used (by design):**
- Temporal/Inngest/BullMQ: External workflow orchestrators are overkill for this use case. The workflow engine is a simple state machine driven by user actions, not automated background processes.
- BPMN/visual graph editors: User explicitly chose ordered list with dependencies over visual graph.

## Open Questions

1. **Overdue detection mechanism**
   - What we know: Visual-only indicators, no notifications in Phase 4. dueAt field exists on WorkflowTaskRun.
   - What's unclear: Whether to compute overdue on every page load (query-time) or use a periodic job to update status to OVERDUE.
   - Recommendation: Compute at query time. Add a `isOverdue` computed field in the tRPC response. Avoid a separate OVERDUE status in the database -- use the existing TODO/IN_PROGRESS status + dueAt comparison. This avoids the need for a cron job in Phase 4 and keeps the system simpler. The WorkflowRunStatus.OVERDUE and WorkflowTaskStatus.OVERDUE enums exist in the schema, so optionally a periodic update could be added later, but for Phase 4 visual-only, query-time computation is sufficient.

2. **Bulk workflow launch concurrency**
   - What we know: Admin can select multiple contractors and launch a workflow for all of them.
   - What's unclear: Whether to create runs sequentially or in parallel within a transaction.
   - Recommendation: Sequential within a single transaction would be too long. Create runs in parallel with Promise.all, each in its own transaction. Report individual failures gracefully.

3. **Starter template seeding**
   - What we know: 2 pre-built templates (Onboarding, Offboarding) in DRAFT status.
   - What's unclear: Seed at org creation vs first visit to /workflows.
   - Recommendation: Seed via a Prisma seed script or on first visit to Templates tab with a "no templates" detection. The org creation flow (Phase 1) should not know about workflow specifics. Use a "seed if empty" pattern in the template list query.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework currently configured in the project |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WKFL-01 | Template CRUD | unit | N/A | No |
| WKFL-02 | Task template fields | unit | N/A | No |
| WKFL-03 | Task dependencies | unit | N/A | No |
| WKFL-04 | Conditional logic evaluation | unit | N/A | No |
| WKFL-05 | Start workflow run | integration | N/A | No |
| WKFL-06 | Role-based assignee resolution | unit | N/A | No |
| WKFL-07 | Task actions (complete/skip/reassign) | unit | N/A | No |
| WKFL-08 | Comments and attachments | integration | N/A | No |
| WKFL-09 | Overdue detection | unit | N/A | No |
| WKFL-10 | Progress calculation | unit | N/A | No |
| ORG-09 | Template management | integration | N/A | No |

### Sampling Rate
- No test framework configured. Validation is manual via browser.

### Wave 0 Gaps
- No test infrastructure exists in the project. Setting up a test framework is outside Phase 4 scope unless explicitly requested.
- Manual testing via browser is the current validation approach for all prior phases.

## Sources

### Primary (HIGH confidence)
- Project codebase: `packages/db/prisma/schema/workflow.prisma` -- complete schema with all models, enums, indexes
- Project codebase: `packages/api/src/routers/contract.ts` -- reference pattern for tRPC router structure
- Project codebase: `packages/validators/src/contract.ts` -- reference pattern for Zod validators
- Project codebase: `apps/web/src/components/contracts/contract-table/` -- reference pattern for TanStack Table
- npm registry: @dnd-kit/core@6.3.1, @dnd-kit/sortable@10.0.0, @dnd-kit/utilities@3.2.2 (verified 2026-03-20)

### Secondary (MEDIUM confidence)
- [dnd-kit sortable documentation](https://docs.dndkit.com/presets/sortable) -- API patterns for SortableContext, useSortable
- UI-SPEC at `.planning/phases/04-workflow-engine/04-UI-SPEC.md` -- visual and interaction contracts

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries are already in use in the project, only dnd-kit is new (verified on npm)
- Architecture: HIGH -- follows established project patterns (tRPC routers, validators, TanStack Table, React Hook Form)
- Pitfalls: HIGH -- derived from understanding the data model, common workflow engine failure modes, and dnd-kit integration experience

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days -- stable stack, no fast-moving dependencies)
