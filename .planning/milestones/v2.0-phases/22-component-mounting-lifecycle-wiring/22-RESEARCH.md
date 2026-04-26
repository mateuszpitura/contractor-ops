# Phase 22: Component Mounting & Lifecycle Wiring - Research

**Researched:** 2026-03-30
**Domain:** React component integration, tRPC lifecycle hooks, calendar auto-push
**Confidence:** HIGH

## Summary

This phase mounts two existing, fully-built UI components (DocLinksSection, CalendarTaskConfig) into their target views and wires calendar auto-push into contract/invoice/approval lifecycle events. No new components or services are built -- everything exists and just needs connecting.

The codebase already has clear precedent patterns for every integration point: JiraTaskConfig mounting in template-builder/task-card.tsx, TaskAttachments/TaskComments in task-card-run.tsx, and fire-and-forget void async sync in the Jira outbound sync service. The calendar router even has manual trigger endpoints (`syncContractDeadline`, `syncPaymentDeadline`) that demonstrate the exact call signature.

**Primary recommendation:** Follow existing patterns exactly -- mount components alongside their siblings using identical conditional guards, wire lifecycle hooks using the same fire-and-forget `void` async pattern used in Phase 19 Jira sync and the existing calendar router manual triggers.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Mount `DocLinksSection` in `task-card-run.tsx` after `TaskAttachments`, before `TaskComments`. Natural grouping: uploaded files first, then linked external docs, then discussion.
- **D-02:** DocLinksSection only visible when task card is expanded (inside `CollapsibleContent`). Matches existing TaskComments and TaskAttachments pattern -- keeps collapsed cards clean.
- **D-03:** Pass `workflowTaskRunId` from task run data and `readOnly` based on task status (DONE/SKIPPED/CANCELLED = readOnly).
- **D-04:** Mount `CalendarTaskConfig` in `template-builder/task-card.tsx` directly below `JiraTaskConfig`. Both are per-task integration settings, grouped together.
- **D-05:** Same `{task?.id && ...}` conditional guard as JiraTaskConfig -- only renders for saved task templates with a persisted ID.
- **D-06:** `syncContractDeadline` fires on contract create and update when `expiresAt` is present. Updates existing calendar event if one exists (upsert via ExternalLink lookup).
- **D-07:** `syncPaymentDeadline` fires when invoice transitions to APPROVED status with a `paymentDueDate`. Creates a payment deadline reminder on the calendar.
- **D-08:** Delete corresponding calendar events when contract is deleted, `expiresAt` is cleared, or invoice is deleted. Keeps user's calendar clean.
- **D-09:** Push approval SLA deadlines to calendar when approval chain starts (per CAL-01 requirement). Uses same sync pattern.
- **D-10:** Fire-and-forget with server-side logging. Calendar push is async and never blocks contract/invoice save operations. Follows Phase 19 Jira outbound sync pattern (`void` async, no await on caller).

### Claude's Discretion
- Exact import structure and prop threading in task-card-run.tsx
- Which contract/invoice router mutations to hook into for lifecycle triggers
- Calendar event cleanup logic (soft delete vs hard delete of ExternalLink records)
- Approval SLA deadline calculation details

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | User can attach Notion or Confluence page links to workflow steps | DocLinksSection component is fully built with list query, detach mutation, AttachDocDialog. Mounting it in task-card-run.tsx inside CollapsibleContent after TaskAttachments completes this requirement. |
| CAL-01 | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | `syncContractExpiryDeadline`, `syncApprovalSlaDeadline`, `syncPaymentDueDeadline` services exist in calendar-deadline-sync.ts. Wiring them into contract create/update, approval submit, and invoice approval lifecycle events completes this requirement. |
| CAL-02 | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | `CalendarTaskConfig` component is fully built. Mounting it in template-builder/task-card.tsx below JiraTaskConfig completes this requirement. `createTaskCalendarEvent` service already exists in calendar-deadline-sync.ts. |

</phase_requirements>

## Architecture Patterns

### Pattern 1: Component Mounting in CollapsibleContent (task-card-run.tsx)

**What:** Existing sections (TaskComments, TaskAttachments) are rendered inside `<CollapsibleContent>` in a `<div className="space-y-4">` container. Each section is a self-contained component with its own data fetching.

**Current structure (lines 447-489):**
```typescript
<CollapsibleContent>
  <div className="border-t px-4 pb-4 pt-3 space-y-4">
    {/* Description */}
    {/* Status-specific info */}
    {/* Metadata */}
    {/* Comments */}
    <TaskComments runId={runId} taskRunId={task.id} />
    {/* Attachments */}
    <TaskAttachments runId={runId} taskRunId={task.id} />
  </div>
</CollapsibleContent>
```

**CRITICAL FINDING:** The current file order is TaskComments (line 484) then TaskAttachments (line 487). D-01 intent is "uploaded files first, then linked external docs, then discussion" which means: TaskAttachments -> DocLinksSection -> TaskComments. This requires reordering the existing sections.

**readOnly derivation (D-03):**
```typescript
const readOnly = ["DONE", "SKIPPED", "CANCELLED"].includes(task.status);
```

**Props available:** `task.id` is the `workflowTaskRunId` (the task card receives `task` with `id: string`).

### Pattern 2: Integration Config Mounting in Template Builder (task-card.tsx)

**What:** JiraTaskConfig is mounted at line 488-489 with a conditional guard.

**Exact pattern to replicate (lines 487-489):**
```typescript
{/* Jira integration -- only for saved task templates */}
{task?.id && (
  <JiraTaskConfig taskTemplateId={task.id} />
)}
```

**Mount point for CalendarTaskConfig:** Directly after JiraTaskConfig, before the `{/* Actions */}` div at line 493. Use identical conditional guard.

**Import path:** CalendarTaskConfig is at `@/components/workflow/calendar-task-config` (note: `workflow` singular, not `workflows` or `integrations`).

### Pattern 3: Fire-and-Forget Lifecycle Hooks

**What:** Async operations that should never block the main mutation response. Used by Jira outbound sync (Phase 19) and already used in the calendar router manual triggers.

**Existing calendar router pattern (lines 190-198):**
```typescript
// Fire-and-forget async
void syncContractExpiryDeadline(prisma, {
  organizationId: ctx.organizationId,
  contractId: contract.id,
  contractName: contract.title,
  contractorName: contract.contractor.displayName,
  expiryDate: contract.endDate,
  userId: ctx.user!.id,
});
```

**Key behavior:** Uses `void` keyword to explicitly discard the promise. Error handling is inside the sync service itself (via try/catch around provider API calls in calendar-event-service.ts). For router-level hooks, add `.catch()` for defense-in-depth matching the `dispatch().catch()` pattern already in contract/approval/invoice routers.

### Pattern 4: Calendar Event Cleanup

**What:** `deleteCalendarEvent` already exists in calendar-event-service.ts. It accepts `organizationId`, `entityType`, and `entityId`, finds all ExternalLink records matching those criteria, deletes the provider-side events, then hard-deletes the ExternalLink records.

**Cleanup triggers per D-08:**
1. Contract deleted (soft-delete in contract.delete mutation) -> delete CONTRACT calendar events
2. Contract `endDate` cleared (set to null in contract.update) -> delete CONTRACT calendar events
3. Invoice voided -> delete INVOICE calendar events

### Anti-Patterns to Avoid
- **Awaiting fire-and-forget calls:** Never `await syncContractExpiryDeadline(...)` in a mutation. Use `void` to explicitly discard the promise.
- **Duplicating service logic in routers:** The sync service already handles upsert logic (check ExternalLink existence, create or update). Do not re-implement this in the router.
- **Missing `.catch()` on fire-and-forget:** Add `.catch(err => console.error(...))` to match the notification dispatch pattern and prevent unhandled rejections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar event CRUD | Custom provider API calls | `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent` from calendar-event-service.ts | Already handles Google + Outlook, ExternalLink tracking, dual-push |
| Deadline sync logic | Custom date calculation | `syncContractExpiryDeadline`, `syncApprovalSlaDeadline`, `syncPaymentDueDeadline` from calendar-deadline-sync.ts | Already formats titles, descriptions, handles upsert |
| Doc links UI | New component | `DocLinksSection` from integrations/doc-links-section.tsx | Fully built with list, detach, attach dialog |
| Calendar task config UI | New component | `CalendarTaskConfig` from workflow/calendar-task-config.tsx | Fully built with toggle, config dialog, save mutation |

## Common Pitfalls

### Pitfall 1: Field Name Mismatch (expiresAt vs endDate)
**What goes wrong:** CONTEXT.md uses `expiresAt` but the actual contract model and router use `endDate`.
**Why it happens:** CONTEXT was written with a conceptual name, not the actual schema field.
**How to avoid:** Always reference `contract.endDate` in code, not `expiresAt`. The sync service parameter is `expiryDate` (input mapping).
**Warning signs:** TypeScript errors about missing `expiresAt` property.

### Pitfall 2: Field Name Mismatch (paymentDueDate vs dueDate)
**What goes wrong:** CONTEXT.md uses `paymentDueDate` but the actual invoice model uses `dueDate`.
**Why it happens:** Same conceptual vs actual schema mismatch.
**How to avoid:** Always reference `invoice.dueDate` in code.

### Pitfall 3: Component Section Ordering
**What goes wrong:** Mounting DocLinksSection in wrong position relative to TaskComments/TaskAttachments.
**Why it happens:** Current code has TaskComments before TaskAttachments, but D-01 intent is "files first, docs second, discussion last".
**How to avoid:** Reorder to: TaskAttachments, DocLinksSection, TaskComments to match the semantic intent.

### Pitfall 4: Missing Contractor Relation in Contract Update
**What goes wrong:** `syncContractExpiryDeadline` needs `contractorName` but contract.update does NOT include contractor in its return.
**Why it happens:** Contract create includes `contractor` (line 82), but update only returns the updated fields (line 184-189).
**How to avoid:** After the update, query contractor separately: `prisma.contractor.findUnique({ where: { id: updated.contractorId } })`.

### Pitfall 5: Invoice APPROVED Transition Happens in Approval Router, Not Invoice Router
**What goes wrong:** Looking for invoice status transition in invoice.ts when it actually happens in approval.ts `approve` mutation (lines 422-429).
**Why it happens:** The approval flow completion is what transitions invoice to APPROVED, not a direct invoice mutation.
**How to avoid:** Wire `syncPaymentDueDeadline` into approval.ts `approve` and `bulkApprove`, not invoice.ts.

### Pitfall 6: Invoice dueDate Not in Approval Transaction Select
**What goes wrong:** The approve mutation fetches invoice with `select: { id, invoiceNumber, totalGrosze, currency, contractorId }` (lines 436-441) but does NOT include `dueDate`.
**Why it happens:** The original approval code didn't need dueDate.
**How to avoid:** Add `dueDate: true` to the invoice select inside the approve transaction.

### Pitfall 7: Bulk Approve Also Transitions Invoices
**What goes wrong:** Calendar sync only wired into single approve, missing bulk approve.
**Why it happens:** `bulkApprove` mutation (line 773) also sets invoice to APPROVED when flow completes.
**How to avoid:** Wire sync into both `approve` and `bulkApprove` mutations.

### Pitfall 8: Approval SLA Deadline May Be Null
**What goes wrong:** Trying to sync SLA deadline but the step's `slaDeadline` might be null.
**Why it happens:** SLA configuration is optional per chain config step.
**How to avoid:** Guard with `if (firstStep?.slaDeadline)` before calling `syncApprovalSlaDeadline`.

## Code Examples

### DocLinksSection Mount (task-card-run.tsx)

```typescript
// Import at top of file
import { DocLinksSection } from "@/components/integrations/doc-links-section";

// Inside CollapsibleContent, reordered per D-01 intent:
{/* Attachments */}
<TaskAttachments runId={runId} taskRunId={task.id} />

{/* Document links */}
<DocLinksSection
  workflowTaskRunId={task.id}
  readOnly={["DONE", "SKIPPED", "CANCELLED"].includes(task.status)}
/>

{/* Comments */}
<TaskComments runId={runId} taskRunId={task.id} />
```

### CalendarTaskConfig Mount (template-builder/task-card.tsx)

```typescript
// Import at top of file
import { CalendarTaskConfig } from "@/components/workflow/calendar-task-config";

// After JiraTaskConfig block (line ~489):
{/* Calendar integration -- only for saved task templates */}
{task?.id && (
  <CalendarTaskConfig taskTemplateId={task.id} />
)}
```

### Contract Create Lifecycle Hook (contract.ts)

```typescript
import { syncContractExpiryDeadline } from "../services/calendar-deadline-sync.js";

// After contract create (line ~88), before return:
if (contract.endDate) {
  void syncContractExpiryDeadline(prisma, {
    organizationId: ctx.organizationId,
    contractId: contract.id,
    contractName: contract.title ?? input.title,
    contractorName: contract.contractor?.displayName ?? "Unknown",
    expiryDate: contract.endDate,
    userId: ctx.user!.id,
  }).catch((err) =>
    console.error("[contract] calendar sync on create failed:", err),
  );
}
```

### Contract Update Lifecycle Hook (contract.ts)

```typescript
import { deleteCalendarEvent } from "../services/calendar-event-service.js";

// After contract update (line ~189), need contractor data:
if (updated.endDate) {
  const contractor = await prisma.contractor.findUnique({
    where: { id: updated.contractorId },
    select: { displayName: true },
  });
  void syncContractExpiryDeadline(prisma, {
    organizationId: ctx.organizationId,
    contractId: updated.id,
    contractName: updated.title ?? "Untitled",
    contractorName: contractor?.displayName ?? "Unknown",
    expiryDate: updated.endDate,
    userId: ctx.user!.id,
  }).catch((err) =>
    console.error("[contract] calendar sync on update failed:", err),
  );
} else if (!updated.endDate && existing.endDate) {
  // endDate was cleared -- delete calendar event (D-08)
  void deleteCalendarEvent(prisma, {
    organizationId: ctx.organizationId,
    entityType: "CONTRACT",
    entityId: updated.id,
  }).catch((err) =>
    console.error("[contract] calendar event cleanup failed:", err),
  );
}
```

### Contract Delete Lifecycle Hook (contract.ts)

```typescript
// After soft-delete (line ~478), before return:
void deleteCalendarEvent(prisma, {
  organizationId: ctx.organizationId,
  entityType: "CONTRACT",
  entityId: input.id,
}).catch((err) =>
  console.error("[contract] calendar event cleanup on delete failed:", err),
);
```

### Invoice Approval Lifecycle Hook (approval.ts)

```typescript
import { syncPaymentDueDeadline, syncApprovalSlaDeadline } from "../services/calendar-deadline-sync.js";

// Inside approve mutation, after advanceResult.completed check:
// Add dueDate to the invoice select (line ~436):
//   dueDate: true,
// Then after the invoice APPROVED update:
if (advanceResult.completed && result.invoice?.dueDate) {
  const contractor = result.invoice.contractorId
    ? await prisma.contractor.findUnique({
        where: { id: result.invoice.contractorId },
        select: { displayName: true },
      })
    : null;
  void syncPaymentDueDeadline(prisma, {
    organizationId: ctx.organizationId,
    invoiceId: result.invoice.id,
    invoiceNumber: result.invoice.invoiceNumber ?? `INV-${result.invoice.id.slice(-6)}`,
    contractorName: contractor?.displayName ?? "Unknown",
    dueDate: new Date(result.invoice.dueDate),
    userId: ctx.user!.id,
  }).catch((err) =>
    console.error("[approval] payment deadline sync failed:", err),
  );
}
```

### Approval SLA Lifecycle Hook (approval.ts)

```typescript
// In submitForApproval mutation, after transaction (line ~981):
const firstStep = flow.approvalFlow.steps?.[0];
if (firstStep?.slaDeadline) {
  void syncApprovalSlaDeadline(prisma, {
    organizationId: ctx.organizationId,
    approvalFlowId: flow.approvalFlow.id,
    itemType: "Invoice",
    itemName: flow.invoice.invoiceNumber ?? `INV-${flow.invoice.id.slice(-6)}`,
    deadline: new Date(firstStep.slaDeadline),
    userId: ctx.user!.id,
  }).catch((err) =>
    console.error("[approval] SLA deadline sync failed:", err),
  );
}
```

### Invoice Void Cleanup (invoice.ts)

```typescript
import { deleteCalendarEvent } from "../services/calendar-event-service.js";

// After void status update (line ~604), before return:
void deleteCalendarEvent(prisma, {
  organizationId: ctx.organizationId,
  entityType: "INVOICE",
  entityId: input.id,
}).catch((err) =>
  console.error("[invoice] calendar event cleanup on void failed:", err),
);
```

## Mutation Hook Points (Claude's Discretion Resolution)

Based on codebase analysis, these are the exact mutations to hook into:

| Lifecycle Event | Router | Mutation | Hook Location | Sync Function |
|----------------|--------|----------|---------------|---------------|
| Contract created with endDate | contract.ts | `create` | After line ~88 | `syncContractExpiryDeadline` |
| Contract updated with endDate | contract.ts | `update` | After line ~189 | `syncContractExpiryDeadline` |
| Contract endDate cleared | contract.ts | `update` | Same location, else branch | `deleteCalendarEvent` |
| Contract deleted | contract.ts | `delete` | After line ~478 | `deleteCalendarEvent` |
| Invoice approved (single) | approval.ts | `approve` | After line ~429 | `syncPaymentDueDeadline` |
| Invoice approved (bulk) | approval.ts | `bulkApprove` | After line ~820 | `syncPaymentDueDeadline` |
| Approval chain started | approval.ts | `submitForApproval` | After line ~1020 | `syncApprovalSlaDeadline` |
| Invoice voided | invoice.ts | `voidInvoice` | After line ~604 | `deleteCalendarEvent` |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo run test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | DocLinksSection renders in task-card-run expanded view | manual-only | Visual check -- component mount is a 2-line import+JSX change | N/A |
| CAL-02 | CalendarTaskConfig renders in template-builder task card | manual-only | Visual check -- component mount is a 2-line import+JSX change | N/A |
| CAL-01a | Contract create/update fires syncContractExpiryDeadline | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-sync.test.ts -x` | Exists (stub) |
| CAL-01b | Invoice approval fires syncPaymentDueDeadline | unit | Same test file | Exists (stub) |
| CAL-01c | Approval submit fires syncApprovalSlaDeadline | unit | Same test file | Exists (stub) |
| CAL-01d | Contract delete/clear fires deleteCalendarEvent | unit | Same test file | Exists (stub) |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx turbo run build && npx turbo run test`
- **Phase gate:** Full suite green + TypeScript compilation clean

### Wave 0 Gaps
None -- existing test infrastructure at `packages/api/src/services/__tests__/calendar-sync.test.ts` covers the calendar sync domain. Frontend component mounts are manual verification (visual).

## Open Questions

1. **Invoice `dueDate` availability in approval.approve transaction result**
   - What we know: The `approve` mutation's transaction fetches `invoice` with `select: { id, invoiceNumber, totalGrosze, currency, contractorId }` -- it does NOT include `dueDate`.
   - What's unclear: Nothing -- this is a confirmed gap.
   - Recommendation: Add `dueDate: true` to the invoice select in the approve transaction (line ~436). Minimal change, no risk.

2. **bulkApprove invoice data availability**
   - What we know: The `bulkApprove` mutation does not fetch invoice details after flow completion (lines 810-823).
   - What's unclear: How much data is needed for calendar sync inside the bulk loop.
   - Recommendation: After the `advanceResult.completed` check inside `bulkApprove`, query the invoice to get `dueDate`, `invoiceNumber`, and `contractorId` for the sync call.

## Sources

### Primary (HIGH confidence)
- Direct file reads of all canonical references listed in CONTEXT.md
- `packages/api/src/routers/contract.ts` -- create (line 54), update (line 147), delete (line 451) mutations
- `packages/api/src/routers/approval.ts` -- approve (line 359), bulkApprove (line 773), submitForApproval (line 915) mutations
- `packages/api/src/routers/invoice.ts` -- voidInvoice (line 581) mutation
- `packages/api/src/routers/calendar.ts` -- existing manual sync triggers (lines 190, 237)
- `packages/api/src/services/calendar-deadline-sync.ts` -- all sync function signatures
- `packages/api/src/services/calendar-event-service.ts` -- deleteCalendarEvent at line 384
- `apps/web/src/components/workflows/workflow-run/task-card-run.tsx` -- current CollapsibleContent structure
- `apps/web/src/components/workflows/template-builder/task-card.tsx` -- JiraTaskConfig mount pattern at line 488
- `apps/web/src/components/integrations/doc-links-section.tsx` -- props interface confirmed
- `apps/web/src/components/workflow/calendar-task-config.tsx` -- props interface confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all existing code
- Architecture: HIGH - all patterns have direct precedent in codebase
- Pitfalls: HIGH - identified from reading actual code, not speculation

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable -- internal wiring, no external dependencies)
