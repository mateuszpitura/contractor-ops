# Phase 4: Workflow Engine - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Workflow template builder for admins to create reusable automation workflows (onboarding, offboarding, document collection, custom). Execution engine that resolves role-based assignments at runtime, handles task dependencies and conditional logic (AND/OR rules), tracks progress, and flags overdue items. Users can complete, skip, reassign tasks, add comments and attachments. Includes "My Tasks" view for personal task management. This phase does NOT include notifications (Phase 7) — overdue detection surfaces visually only.

</domain>

<decisions>
## Implementation Decisions

### Template builder UX
- Ordered task list with drag-to-reorder — vertical list of task cards, "Add task" button at bottom
- Inline expandable task cards — click to expand and edit all fields (title, type, description, assignee mode/role, due offset, required, dependency, condition). Collapse on save. No modal/dialog needed
- No preview/test mode in v1 — admin saves template and starts a real run to verify
- 2 pre-built starter templates shipped: Onboarding and Offboarding with common tasks pre-populated. Admin can duplicate and customize
- Template list managed via "Templates" tab on /workflows page (admin-only tab)
- Template status lifecycle: Draft → Active → Archived

### Workflow run & progress view
- Checklist with progress bar — vertical task list with status icons (done, in progress, blocked, overdue, skipped), progress bar at top showing X/Y tasks complete
- Standalone /workflows page with tabs: "Active runs" (default), "My tasks" (current user's assigned tasks across all workflows), "Templates" (admin only)
- Overdue tasks surfaced via: red badge on task in checklist, overdue filter in runs list, overdue count badge on sidebar nav item. Notification delivery deferred to Phase 7
- Multiple entry points to start a workflow run: contractor profile header "Start workflow" button, /workflows page, contractor bulk action "Launch workflow". All open template picker then start run
- Workflow run detail page at /workflows/[id] with checklist view, contractor info, and run metadata

### Task interaction
- Inline actions on each task card: Complete, Skip (requires reason popover), Reassign (user picker popover). Actions happen inline — no separate page or dialog
- Threaded comments inline below task card when expanded — author, timestamp, plain text. Collapse when not focused. No rich text in v1
- File attachments reuse Phase 3 document components (DropZone + DocumentCard). Files linked via DocumentLink with entityType=WORKFLOW_TASK_RUN. Consistent UX
- "My tasks" filter/tab on /workflows page showing all tasks assigned to current user across all workflows — quick access to personal workload

### Conditional logic
- AND/OR rule builder — multiple conditions combined with AND/OR operators. More powerful than single field matching. Stored as JSON in WorkflowTaskTemplate.configJson
- Available condition fields: Contractor (type, status, billingModel, team, complianceRiskLevel) and Contract (type, status, billingModel, currency)
- Operators: equals, not equals (for enums), contains/starts with (for strings)
- Inline badge on collapsed task card: "Only if: type = JDG" or "Only if: 2 conditions". Click to edit
- Auto-skipped tasks during runs when condition is not met — marked "Skipped (condition not met)", grayed out in checklist, excluded from progress count (5/10 not 5/12)

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements & data model
- `prd.md` — Full PRD with workflow engine requirements (section 11.3), API contracts (section 15), UI views
- `db-schema.md` — Complete database schema including WorkflowTemplate, WorkflowTaskTemplate, WorkflowRun, WorkflowTaskRun, WorkflowComment, WorkflowAttachment models

### Phase requirements
- `.planning/REQUIREMENTS.md` — Phase 4 requirements: WKFL-01 through WKFL-10, ORG-09
- `.planning/ROADMAP.md` — Phase 4 plans: template builder, dependencies/conditions, execution engine, task management, overdue/progress

### Prior phase decisions
- `.planning/phases/01-foundation-auth/01-CONTEXT.md` — App shell, Stripe Dashboard aesthetic, RBAC hidden items, 8 roles
- `.planning/phases/02-contractor-registry/02-CONTEXT.md` — TanStack Table patterns, side panel, multi-step wizard, contractor profile tabs
- `.planning/phases/03-contracts-documents/03-CONTEXT.md` — Document upload/download components, DropZone, signed URLs, inline PDF preview

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/db/prisma/schema/workflow.prisma` — Full WorkflowTemplate, WorkflowTaskTemplate, WorkflowRun, WorkflowTaskRun, WorkflowComment, WorkflowAttachment models with all fields, enums, indexes, and relationships already defined
- `apps/web/src/components/documents/drop-zone.tsx` — Reusable DropZone for task file attachments
- `apps/web/src/components/documents/document-card.tsx` — Reusable DocumentCard for attachment display
- `apps/web/src/components/ui/badge.tsx` — Badge component for status chips
- `apps/web/src/components/ui/tabs.tsx` — Tab component for /workflows page tabs
- `apps/web/src/components/contracts/contract-table/` — Full TanStack Table pattern to follow for workflow runs list
- `apps/web/src/components/contractors/contractor-wizard/wizard-dialog.tsx` — Dialog pattern reference

### Established Patterns
- tRPC routers in `packages/api/src/routers/` with `tenantProcedure` + `requirePermission()` middleware chain
- Validators in `packages/validators/src/` with Zod schemas — follow contract.ts patterns
- `plain()` helper to strip Prisma class prototypes from tRPC returns
- React Hook Form + Zod resolver for all forms
- `useTranslations()` from next-intl for all UI text
- URL query params via nuqs for page state
- PostgreSQL tsvector for full-text search
- `prisma.$transaction()` for atomic multi-step operations
- DocumentLink polymorphic linking (entityType + entityId) — reuse for WORKFLOW_TASK_RUN attachments

### Integration Points
- Sidebar nav "Workflows" item already configured in `apps/web/src/lib/navigation.ts` with route /workflows and workflow permission
- Contractor profile `profile-tabs.tsx` — Workflows tab currently shows TabPlaceholder (Phase 4), needs replacement
- Contractor profile `profile-header.tsx` — "Start onboarding" and "Start offboarding" buttons exist (disabled, Phase 4 tooltip), need wiring
- Contractor bulk actions — "Launch workflow" bulk action exists in contractor list, needs wiring
- Root tRPC router in `packages/api/src/root.ts` — needs workflow router registration
- Auth permissions — workflow resource with CRUD + assign actions

</code_context>

<specifics>
## Specific Ideas

- Template builder is an ordered list with drag reorder and inline expandable cards — NOT a visual graph/canvas. Keep it simple and fast for 5-20 task workflows
- AND/OR rule builder for conditional logic — user chose this over simple field matching, so the condition editor needs to support combining multiple rules
- Checklist-style progress view — NOT kanban or Gantt. Vertical list with status icons, progress bar at top
- "My tasks" as a tab/filter on /workflows — personal task dashboard without a separate page
- Reuse Phase 3 document components for task attachments — consistent UX across the app

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-workflow-engine*
*Context gathered: 2026-03-20*
