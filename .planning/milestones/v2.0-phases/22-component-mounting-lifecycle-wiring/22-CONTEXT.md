# Phase 22: Component Mounting & Lifecycle Wiring - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Mount orphaned UI components (DocLinksSection, CalendarTaskConfig) in their target views and wire calendar auto-push into contract/invoice lifecycle events. This is a gap closure phase — no new components are built, only existing ones are connected.

</domain>

<decisions>
## Implementation Decisions

### DocLinksSection mounting
- **D-01:** Mount `DocLinksSection` in `task-card-run.tsx` after `TaskAttachments`, before `TaskComments`. Natural grouping: uploaded files first, then linked external docs, then discussion.
- **D-02:** DocLinksSection only visible when task card is expanded (inside `CollapsibleContent`). Matches existing TaskComments and TaskAttachments pattern — keeps collapsed cards clean.
- **D-03:** Pass `workflowTaskRunId` from task run data and `readOnly` based on task status (DONE/SKIPPED/CANCELLED = readOnly).

### CalendarTaskConfig mounting
- **D-04:** Mount `CalendarTaskConfig` in `template-builder/task-card.tsx` directly below `JiraTaskConfig`. Both are per-task integration settings, grouped together.
- **D-05:** Same `{task?.id && ...}` conditional guard as JiraTaskConfig — only renders for saved task templates with a persisted ID.

### Calendar auto-push lifecycle triggers
- **D-06:** `syncContractDeadline` fires on contract create and update when `expiresAt` is present. Updates existing calendar event if one exists (upsert via ExternalLink lookup).
- **D-07:** `syncPaymentDeadline` fires when invoice transitions to APPROVED status with a `paymentDueDate`. Creates a payment deadline reminder on the calendar.
- **D-08:** Delete corresponding calendar events when contract is deleted, `expiresAt` is cleared, or invoice is deleted. Keeps user's calendar clean.
- **D-09:** Push approval SLA deadlines to calendar when approval chain starts (per CAL-01 requirement). Uses same sync pattern.

### Error handling for auto-push
- **D-10:** Fire-and-forget with server-side logging. Calendar push is async and never blocks contract/invoice save operations. Follows Phase 19 Jira outbound sync pattern (`void` async, no await on caller).

### Claude's Discretion
- Exact import structure and prop threading in task-card-run.tsx
- Which contract/invoice router mutations to hook into for lifecycle triggers
- Calendar event cleanup logic (soft delete vs hard delete of ExternalLink records)
- Approval SLA deadline calculation details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Component mount targets
- `apps/web/src/components/workflows/workflow-run/task-card-run.tsx` — Target for DocLinksSection mount (after TaskAttachments)
- `apps/web/src/components/workflows/template-builder/task-card.tsx` — Target for CalendarTaskConfig mount (after JiraTaskConfig at line 489)

### Orphaned components to mount
- `apps/web/src/components/integrations/doc-links-section.tsx` — DocLinksSection component (props: workflowTaskRunId, readOnly)
- `apps/web/src/components/workflow/calendar-task-config.tsx` — CalendarTaskConfig component (props: taskTemplateId)

### Calendar lifecycle services
- `packages/api/src/services/calendar-deadline-sync.ts` — syncContractDeadline, syncPaymentDeadline functions to wire into lifecycle
- `packages/api/src/services/calendar-event-service.ts` — createCalendarEvent, updateCalendarEvent used by sync service

### Pattern references
- `apps/web/src/components/integrations/jira-task-config.tsx` — JiraTaskConfig mount pattern to replicate for CalendarTaskConfig
- `packages/api/src/services/jira-issue-sync.ts` — Fire-and-forget outbound sync pattern (void async, no blocking)

### Requirements
- `.planning/REQUIREMENTS.md` — DOCS-01, CAL-01, CAL-02 requirement definitions
- `.planning/v2.0-MILESTONE-AUDIT.md` — Gap analysis identifying these exact wiring issues (items 7, 8, 9)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **DocLinksSection**: Fully built component with list query, detach mutation, AttachDocDialog. Just needs importing and mounting.
- **CalendarTaskConfig**: Fully built component with config query, save mutation, toggle, CalendarEventConfigDialog. Just needs importing and mounting.
- **calendar-deadline-sync.ts**: Complete sync service with syncContractDeadline, syncPaymentDeadline, hasExistingCalendarEvent, endOfDay helpers. Needs wiring into lifecycle routers.

### Established Patterns
- **JiraTaskConfig mount**: `{task?.id && <JiraTaskConfig taskTemplateId={task.id} />}` in template-builder/task-card.tsx — replicate for CalendarTaskConfig
- **Fire-and-forget outbound sync**: Phase 19 Jira pattern — `void syncFunction(...)` to never block the calling mutation
- **CollapsibleContent sections**: task-card-run.tsx uses Collapsible with TaskComments/TaskAttachments inside — DocLinksSection follows same nesting

### Integration Points
- **Contract router mutations**: create/update mutations need `void syncContractDeadline(...)` call when expiresAt present
- **Invoice router mutations**: status transition to APPROVED needs `void syncPaymentDeadline(...)` call
- **Approval router**: approval chain start needs calendar deadline push

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-component-mounting-lifecycle-wiring*
*Context gathered: 2026-03-30*
