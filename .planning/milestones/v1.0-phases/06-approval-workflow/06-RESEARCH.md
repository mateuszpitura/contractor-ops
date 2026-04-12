# Phase 6: Approval Workflow - Research

**Researched:** 2026-03-21
**Domain:** Multi-level approval chains, state machines, SLA enforcement, audit trails
**Confidence:** HIGH

## Summary

Phase 6 implements configurable approval chains that route invoices through 1-3 levels of approval with SLA enforcement, delegation, and full audit trail. The Prisma schema is already defined (ApprovalChainConfig, ApprovalFlow, ApprovalStep, ApprovalDecision), the sidebar navigation is wired, and the invoice detail page provides the integration surface.

The core technical challenge is the approval state machine: submitting an invoice must atomically create an ApprovalFlow with snapshotted steps from the matching chain config, advance steps sequentially, handle reject/delegate/clarification side-effects, and update invoice status accordingly. All state transitions must be wrapped in `prisma.$transaction()` to prevent partial state corruption.

The UI work spans four surfaces: (1) Settings > Approvals tab for chain CRUD, (2) `/approvals` queue page with TanStack Table, (3) chain tracker stepper on invoice detail, (4) audit timeline on invoice detail. All patterns have direct precedents in Phases 2-5.

**Primary recommendation:** Build the approval service layer (chain routing + state machine) first as a pure backend service, then layer the UI surfaces on top. The state machine is the riskiest component -- get it right before building the queue.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Stacked level cards -- vertical stack of 1-3 level cards for chain config editor
- **D-02:** Threshold conditions on chain -- conditionsJson with amount-based routing, first-match logic, default chain fallback
- **D-03:** Chain management in Settings > Approvals tab
- **D-04:** Visual chain tracker -- horizontal stepper on invoice detail, chain snapshot at submission time
- **D-05:** Dedicated /approvals page with TanStack Table, overdue-first sort, "My Approvals" + "All" tabs
- **D-06:** Inline approve/reject on row hover, reject popover with mandatory comment, "More" dropdown for clarification/delegate
- **D-07:** Bulk approve/reject via checkbox + floating toolbar
- **D-08:** SLA countdown badge with green/yellow/red color coding
- **D-09:** SLA breach = visual flag + `approval.sla_breached` event, no auto-escalation in v1
- **D-10:** Calendar hours in v1 (not business hours)
- **D-11:** Vertical timeline on invoice detail, most recent at top
- **D-12:** Both system + human events in timeline, system events styled differently
- **D-13:** Audit trail visible to anyone with invoice view permission

### Claude's Discretion
- Chain form field layout and validation rules
- Condition builder UI implementation (simple form vs drag-and-drop)
- Exact queue table column widths and responsive behavior
- Side panel content for approval queue rows
- Chain tracker exact sizing and animation
- Empty states for approvals page
- Timeline entry spacing and styling
- How "Request clarification" notifies the submitter (in-app vs just status change)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APPR-01 | System routes invoices through configurable approval chains (1-3 levels) | Chain config CRUD + routing engine that evaluates conditionsJson against invoice data; first-match logic with default fallback |
| APPR-02 | Approver can approve, reject (mandatory comment), request clarification, or delegate | ApprovalDecisionType enum already has APPROVE, REJECT, REQUEST_CHANGES, DELEGATE; state machine transitions per action |
| APPR-03 | Personal approval queue sorted by priority (overdue first, then due date) | TanStack Table on /approvals with server-side sorting; query filters by approverUserId + PENDING status |
| APPR-04 | Bulk approve/reject from queue | Floating toolbar pattern from Phase 2; batch mutation wrapping individual transitions in $transaction |
| APPR-05 | SLA timers per approval level with visual indicators | slaDeadline on ApprovalStep computed at step activation; countdown badge component with green/yellow/red thresholds |
| APPR-06 | Escalation notifications when SLA breached | Emit `approval.sla_breached` event (no auto-escalation); SLA check runs on query (computed field) or periodic check |
| APPR-07 | Approver can delegate to another user when absent | DELEGATE decision type; updates approverUserId on step; records delegation in ApprovalDecision audit |
| APPR-08 | Chain snapshot at submission time | stepsJson from ApprovalChainConfig copied into ApprovalStep rows at flow creation; changes to config don't affect in-flight |
| APPR-09 | Full audit trail with actor, timestamp, comment | ApprovalDecision model + system events; timeline UI on invoice detail |
| ORG-08 | Admin can configure approval chain templates | Settings > Approvals tab with chain CRUD; chain editor dialog with levels, conditions, default toggle |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | 7.x (existing) | ORM, transactions, schema | Already in use; approval models defined |
| tRPC | 11.x (existing) | Type-safe API layer | Established pattern for all routers |
| TanStack Table | 8.x (existing) | Approval queue data table | Used for contractors, contracts, invoices tables |
| TanStack Query | 5.x (existing) | Server state, cache invalidation | Established pattern across all pages |
| React Hook Form | 7.x (existing) | Chain editor forms | Established form pattern with Zod resolver |
| Zod | 3.x (existing) | Schema validation | Established validator pattern |
| nuqs | 2.x (existing) | URL state for queue filters/tabs | Established pattern for table pages |
| next-intl | 4.x (existing) | Internationalization | All UI text through useTranslations() |
| Lucide React | (existing) | Icons | Established icon library |
| shadcn/ui | (existing) | UI primitives | Card, Dialog, Badge, Avatar, Tooltip, Popover, Sheet, etc. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns / inline helpers | N/A | SLA countdown computation | Inline addHours helper consistent with Phase 4 pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom state machine | XState/Zag | Overkill for 1-3 level linear chain; custom is simpler and consistent with workflow engine approach |
| Cron for SLA checks | Computed on query | v1 calendar hours are simple enough to compute on read; cron adds infra complexity |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  routers/approval.ts           # tRPC router: chain CRUD, flow actions, queue queries
  services/approval-engine.ts   # State machine: routing, transitions, SLA computation
packages/validators/src/
  approval.ts                   # Zod schemas for chain config, approval actions
apps/web/src/
  app/[locale]/(dashboard)/
    approvals/page.tsx          # Approval queue page
    settings/page.tsx           # Extended with Approvals tab
    invoices/[id]/page.tsx      # Extended with chain tracker + audit timeline
  components/approvals/
    approval-queue/             # Queue table, toolbar, side panel
    chain-tracker.tsx           # Horizontal stepper component
    audit-timeline.tsx          # Vertical timeline component
    sla-badge.tsx               # SLA countdown badge
  components/settings/
    approval-chains-tab.tsx     # Settings tab content
    chain-editor-dialog.tsx     # Chain create/edit dialog
    condition-builder.tsx       # Condition rows
```

### Pattern 1: Approval State Machine (Service Layer)
**What:** Pure functions that handle all approval state transitions atomically within `prisma.$transaction()`.
**When to use:** Every approval action (submit, approve, reject, delegate, request clarification).
**Example:**
```typescript
// packages/api/src/services/approval-engine.ts

/** Route invoice to the correct approval chain based on conditions */
export async function routeToChain(
  tx: PrismaTransaction,
  organizationId: string,
  invoice: { totalGrosze: number; /* ... */ },
): Promise<ApprovalChainConfig | null> {
  const chains = await tx.approvalChainConfig.findMany({
    where: { organizationId, resourceType: "INVOICE", isActive: true },
    orderBy: { createdAt: "asc" },
  });

  // First-match: evaluate conditionsJson against invoice data
  for (const chain of chains) {
    if (evaluateConditions(chain.conditionsJson, invoice)) {
      return chain;
    }
  }

  // Fallback to default chain
  return chains.find(c => c.isDefault) ?? null;
}

/** Create approval flow with snapshotted steps from chain config */
export async function createApprovalFlow(
  tx: PrismaTransaction,
  params: {
    organizationId: string;
    resourceType: "INVOICE";
    resourceId: string;
    chainConfig: ApprovalChainConfig;
    createdByUserId: string;
  },
): Promise<ApprovalFlow> {
  const steps = JSON.parse(JSON.stringify(params.chainConfig.stepsJson)) as StepConfig[];

  const flow = await tx.approvalFlow.create({
    data: {
      organizationId: params.organizationId,
      resourceType: "INVOICE",
      resourceId: params.resourceId,
      chainConfigId: params.chainConfig.id,
      status: "PENDING",
      currentStepOrder: 1,
      createdByUserId: params.createdByUserId,
      steps: {
        create: steps.map((step, index) => ({
          organizationId: params.organizationId,
          stepOrder: index + 1,
          name: step.name,
          approverUserId: step.approverUserId ?? null,
          approverRole: step.approverRole ?? null,
          status: index === 0 ? "PENDING" : "NOT_STARTED",
          required: step.required,
          slaDeadline: index === 0
            ? addHours(new Date(), step.slaHours)
            : null,
        })),
      },
    },
    include: { steps: true },
  });

  return flow;
}
```

### Pattern 2: Condition Evaluator
**What:** Simple rule evaluator for chain routing conditions.
**When to use:** When submitting invoice for approval -- determines which chain to use.
**Example:**
```typescript
interface Condition {
  field: "amount" | "contractorType";
  operator: "gt" | "lt" | "eq";
  value: number | string;
}

function evaluateConditions(
  conditionsJson: Condition[] | null,
  invoice: { totalGrosze: number; contractorType?: string },
): boolean {
  if (!conditionsJson || conditionsJson.length === 0) return false;

  return conditionsJson.every(condition => {
    switch (condition.field) {
      case "amount":
        const amount = invoice.totalGrosze;
        const threshold = Number(condition.value) * 100; // convert to grosze
        if (condition.operator === "gt") return amount > threshold;
        if (condition.operator === "lt") return amount < threshold;
        if (condition.operator === "eq") return amount === threshold;
        return false;
      case "contractorType":
        return condition.operator === "eq"
          && invoice.contractorType === condition.value;
      default:
        return false;
    }
  });
}
```

### Pattern 3: SLA Computation (Computed on Read)
**What:** Calculate SLA status from slaDeadline vs current time. No cron needed.
**When to use:** Every time approval steps are fetched (queue list, detail page).
**Example:**
```typescript
type SlaStatus = "green" | "yellow" | "red" | "overdue";

function computeSlaStatus(step: {
  slaDeadline: Date | null;
  status: string;
}): { status: SlaStatus; remainingMs: number; label: string } | null {
  if (!step.slaDeadline || step.status !== "PENDING") return null;

  const now = Date.now();
  const deadline = step.slaDeadline.getTime();
  const remainingMs = deadline - now;

  if (remainingMs <= 0) {
    const overdueHours = Math.ceil(Math.abs(remainingMs) / (1000 * 60 * 60));
    return { status: "overdue", remainingMs, label: `OVERDUE ${overdueHours}h` };
  }

  const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
  // Need to know total SLA duration for percentage calculation
  // Stored as slaHours in stepsJson or compute from flow creation time
  const totalMs = step.slaDeadline.getTime() - /* stepActivatedAt */ 0;
  const pct = remainingMs / totalMs;

  if (pct > 0.5) return { status: "green", remainingMs, label: `${remainingHours}h left` };
  if (pct > 0.25) return { status: "yellow", remainingMs, label: `${remainingHours}h left` };
  return { status: "red", remainingMs, label: `${remainingHours}h left` };
}
```

### Anti-Patterns to Avoid
- **Non-atomic state transitions:** Never update ApprovalStep, ApprovalFlow, and Invoice status in separate transactions. Always wrap in `$transaction()`.
- **Mutable chain references:** Never read chain config at decision time. The chain is snapshotted into ApprovalStep rows at submission.
- **Client-side SLA computation only:** Compute SLA on server for accurate results. Client displays the server-computed values.
- **Polling for SLA updates:** Use TanStack Query's `refetchInterval` (30-60s) on the queue page instead of WebSockets or heavy polling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data table | Custom table with sort/filter/select | TanStack Table (existing pattern) | Selection, sorting, filtering, pagination all handled |
| Form state | Manual state management | React Hook Form + Zod (existing) | Validation, dirty tracking, error display |
| URL state | Manual query params | nuqs (existing) | Type-safe URL state with history |
| Side panel | Custom slide-out | shadcn Sheet (existing) | Animation, backdrop, keyboard handling |
| User search picker | Custom dropdown | shadcn Command (existing) | Search, keyboard nav, accessible |
| Relative timestamps | Manual date math | `formatDistanceToNow` from date-fns or Intl.RelativeTimeFormat | Edge cases with timezone, locale |
| Toast notifications | Custom toasts | sonner (existing) | Queue, dismiss, animation |

**Key insight:** Every UI pattern in this phase has a direct precedent in Phases 2-5. The approval queue mirrors the contractor/invoice table. The chain editor mirrors the workflow template builder. The bulk toolbar mirrors the contractor bulk actions. Consistency is more important than novelty.

## Common Pitfalls

### Pitfall 1: Race Conditions on Concurrent Approvals
**What goes wrong:** Two approvers approve the same step simultaneously, creating duplicate decisions and advancing the flow twice.
**Why it happens:** Without optimistic locking or exclusive transactions, parallel requests can read the same "PENDING" state.
**How to avoid:** Use `prisma.$transaction()` with serializable isolation or add a version/updatedAt check. Check step status is still PENDING before recording decision.
**Warning signs:** Duplicate ApprovalDecision records for the same step.

### Pitfall 2: Orphaned Approval Flows
**What goes wrong:** Invoice status says APPROVAL_PENDING but no active ApprovalFlow exists, or flow exists but invoice status is stale.
**Why it happens:** Invoice status and ApprovalFlow status updated in separate operations.
**How to avoid:** Always update both in the same `$transaction()`. The approval service should own the invoice status transition for approval-related states.
**Warning signs:** Invoice stuck in APPROVAL_PENDING with no way to advance.

### Pitfall 3: Chain Deletion Affecting In-Flight Approvals
**What goes wrong:** Admin deletes/deactivates a chain while invoices are being approved through it.
**Why it happens:** Foreign key from ApprovalFlow.chainConfigId to deleted chain.
**How to avoid:** chainConfigId is nullable and steps are snapshotted. Soft-delete or just mark inactive. In-flight flows reference snapshotted steps, not the chain config.
**Warning signs:** Foreign key constraint errors on chain deletion.

### Pitfall 4: Role-Based Approver Resolution at Wrong Time
**What goes wrong:** Chain config specifies "FINANCE_ADMIN" as approver role, but the system resolves to a specific user at chain config time instead of flow creation time.
**Why it happens:** Confusion between config-time and runtime resolution.
**How to avoid:** Store approverRole in step config. At flow creation (submission), resolve role to specific user OR keep role-based and resolve at query time. Decision: resolve at flow creation for accountability (snapshot the approver).
**Warning signs:** Wrong person assigned after role changes.

### Pitfall 5: SLA Deadline Not Set on Step Activation
**What goes wrong:** SLA countdown shows null or wrong time because slaDeadline was only set on the first step, not when subsequent steps become active.
**Why it happens:** Only computing slaDeadline at flow creation for step 1, forgetting to set it when step N advances to step N+1.
**How to avoid:** When advancing to next step, set `slaDeadline = addHours(now, stepSlaHours)` on the newly activated step.
**Warning signs:** Steps 2+ show no SLA countdown.

### Pitfall 6: Bulk Operations Exceeding Transaction Limits
**What goes wrong:** Bulk approve of 50 invoices times out or fails partially.
**Why it happens:** Single transaction trying to update too many records with complex logic.
**How to avoid:** Process bulk operations as individual transactions per invoice within a `Promise.allSettled()`. Report partial failures to the user.
**Warning signs:** Timeout errors on bulk actions, inconsistent states after failure.

## Code Examples

### Approval Router Structure
```typescript
// packages/api/src/routers/approval.ts
export const approvalRouter = router({
  // --- Chain Config CRUD (admin) ---
  listChains: tenantProcedure
    .use(requirePermission({ settings: ["read"] }))
    .query(async ({ ctx }) => { /* ... */ }),

  createChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(approvalChainCreateSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  updateChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(approvalChainUpdateSchema)
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  deleteChain: tenantProcedure
    .use(requirePermission({ settings: ["update"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // --- Approval Queue ---
  listPending: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(approvalQueueSchema)
    .query(async ({ ctx, input }) => {
      // Query ApprovalSteps where status=PENDING
      // Join to ApprovalFlow -> Invoice for display data
      // Filter: tab="my" -> approverUserId=ctx.userId
      // Sort: overdue first, then slaDeadline ASC
    }),

  // --- Approval Actions ---
  approve: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({ stepId: z.string(), comment: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        // 1. Verify step is PENDING and assigned to user
        // 2. Record ApprovalDecision
        // 3. Mark step APPROVED
        // 4. Advance flow to next step (or complete)
        // 5. If flow complete, update invoice status
      });
    }),

  reject: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({ stepId: z.string(), comment: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        // 1. Verify step is PENDING and assigned to user
        // 2. Record ApprovalDecision
        // 3. Mark step REJECTED
        // 4. Mark flow REJECTED
        // 5. Update invoice status to REJECTED
      });
    }),

  delegate: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({
      stepId: z.string(),
      delegateToUserId: z.string(),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        // 1. Verify step is PENDING and assigned to user
        // 2. Record DELEGATE decision
        // 3. Update step approverUserId to delegate
        // 4. Record system audit event
      });
    }),

  requestClarification: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({ stepId: z.string(), comment: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        // 1. Record REQUEST_CHANGES decision
        // 2. Step remains PENDING (approver still needs to act)
        // 3. Record system audit event
      });
    }),

  // --- Bulk Actions ---
  bulkApprove: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({ stepIds: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      // Process each individually with allSettled
      // Return success/failure counts
    }),

  bulkReject: tenantProcedure
    .use(requirePermission({ invoice: ["approve"] }))
    .input(z.object({
      stepIds: z.array(z.string()).min(1).max(50),
      comment: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => { /* ... */ }),

  // --- Audit Trail ---
  getAuditTrail: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Fetch ApprovalDecisions + system events for the invoice's flow
      // Order by createdAt DESC
    }),

  // --- Submit for Approval (called from invoice context) ---
  submitForApproval: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return prisma.$transaction(async (tx) => {
        // 1. Verify invoice is in submittable state (MATCHED/MANUALLY_CONFIRMED)
        // 2. Route to correct chain via evaluateConditions
        // 3. Create ApprovalFlow with snapshotted steps
        // 4. Set first step to PENDING with SLA deadline
        // 5. Update invoice status to APPROVAL_PENDING
        // 6. Update invoice approvalStatus to PENDING
      });
    }),
});
```

### Validator Schemas
```typescript
// packages/validators/src/approval.ts
import { z } from "zod";

const conditionSchema = z.object({
  field: z.enum(["amount", "contractorType"]),
  operator: z.enum(["gt", "lt", "eq"]),
  value: z.union([z.number(), z.string()]),
});

const stepConfigSchema = z.object({
  name: z.string().min(1).max(100),
  approverUserId: z.string().nullish(),
  approverRole: z.enum([
    "ADMIN", "FINANCE_ADMIN", "OPS_MANAGER", "TEAM_MANAGER",
  ]).nullish(),
  slaHours: z.number().int().min(1).max(720),
  required: z.boolean().default(true),
});

export const approvalChainCreateSchema = z.object({
  name: z.string().min(1).max(100),
  isDefault: z.boolean().default(false),
  conditionsJson: z.array(conditionSchema).nullish(),
  stepsJson: z.array(stepConfigSchema).min(1).max(3),
});

export const approvalChainUpdateSchema = approvalChainCreateSchema.extend({
  id: z.string(),
  isActive: z.boolean().optional(),
});

export const approvalQueueSchema = z.object({
  tab: z.enum(["my", "all"]).default("my"),
  status: z.enum(["all", "pending", "overdue", "approved", "rejected"]).default("all"),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(50).default(10),
  sortBy: z.enum(["slaDeadline", "submitted", "amount"]).default("slaDeadline"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});
```

### Invoice Detail Integration Point
```typescript
// On invoice detail page, insert between MatchCard and InvoiceMetadataForm:
{invoice.status === "APPROVAL_PENDING" || invoice.approvalStatus !== "NOT_STARTED" ? (
  <>
    <ChainTracker invoiceId={invoice.id} />
    <AuditTimeline invoiceId={invoice.id} />
  </>
) : null}
```

### Submit for Approval Button Integration
```typescript
// In InvoiceMetadataForm or as separate action bar component:
// Show "Submit for approval" when matchStatus is MATCHED or MANUALLY_CONFIRMED
// and invoiceStatus is not yet APPROVAL_PENDING
{canSubmitForApproval && (
  <Button onClick={() => submitForApproval.mutate({ invoiceId: invoice.id })}>
    {t("actions.submitForApproval")}
  </Button>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Email-based approval chains | In-app approval queues with inline actions | Standard in modern B2B SaaS | Faster processing, full audit trail |
| Fixed approval levels | Configurable chain templates with condition routing | Standard practice | Flexibility for different invoice amounts |
| Manual SLA tracking | Automated SLA countdown with visual indicators | Standard practice | Proactive escalation awareness |

## Open Questions

1. **Role-based approver resolution timing**
   - What we know: Chain config can specify approverRole instead of specific user
   - What's unclear: Should we resolve role to specific user at submission time, or keep role-based and show "Any Finance Admin" in the queue?
   - Recommendation: Resolve to specific user at submission time for accountability. If no user with that role exists, reject submission with error. This is simpler for the queue query (filter by userId).

2. **SLA percentage calculation**
   - What we know: Need total SLA duration to compute green/yellow/red thresholds
   - What's unclear: ApprovalStep schema has slaDeadline but not slaHours or activatedAt
   - Recommendation: Add slaHours to the step (stored from config) or compute from (slaDeadline - step creation/activation time). The stepsJson already has slaHours -- store it on the step row too.

3. **"Request clarification" effect on SLA**
   - What we know: Step remains PENDING after clarification request
   - What's unclear: Should SLA timer pause during clarification?
   - Recommendation: Keep SLA running in v1 (calendar hours, no pause). Clarification is just a comment -- approver still has the decision.

4. **Audit trail data source**
   - What we know: ApprovalDecision records human actions, but system events (routing, SLA breach, etc.) need storage too
   - What's unclear: Where to store system events? ApprovalDecision is for human decisions.
   - Recommendation: Use ApprovalDecision with a special system actor or add a separate `actorType` field. Alternatively, derive system events from flow/step timestamps (e.g., "submitted" = flow.startedAt, "routed" = flow.chainConfigId existence). Hybrid approach: store human decisions in ApprovalDecision, derive system events from state changes at query time.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected -- no vitest/jest config in project |
| Config file | none -- see Wave 0 |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APPR-01 | Chain routing evaluates conditions correctly | unit | N/A | Wave 0 |
| APPR-02 | Approve/reject/delegate/clarify transitions | unit | N/A | Wave 0 |
| APPR-05 | SLA computation returns correct thresholds | unit | N/A | Wave 0 |
| APPR-08 | Chain snapshot creates correct steps | unit | N/A | Wave 0 |
| APPR-09 | Audit trail records all decisions | unit | N/A | Wave 0 |

### Sampling Rate
- **Per task commit:** Manual verification (no test framework)
- **Per wave merge:** Manual verification
- **Phase gate:** Manual verification via UI

### Wave 0 Gaps
- [ ] Test framework setup (vitest recommended for monorepo)
- [ ] Note: No existing test infrastructure in the project. Setting up vitest is out of scope for this phase unless explicitly requested. All verification is manual.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `packages/db/prisma/schema/approval.prisma` -- full schema with all models and enums
- Existing codebase: `packages/api/src/routers/invoice.ts` -- established router pattern with `plain()`, `$transaction()`, `tenantProcedure`
- Existing codebase: `packages/api/src/middleware/rbac.ts` -- `requirePermission()` pattern
- Existing codebase: `apps/web/src/app/[locale]/(dashboard)/settings/page.tsx` -- Settings page tab structure
- Existing codebase: `apps/web/src/app/[locale]/(dashboard)/invoices/[id]/page.tsx` -- Invoice detail integration surface
- Existing codebase: `apps/web/src/lib/navigation.ts` -- Approvals nav item already configured

### Secondary (MEDIUM confidence)
- Phase 6 CONTEXT.md decisions (verified user decisions)
- Phase 6 UI-SPEC.md (verified UI contract)
- Prior phase decisions from STATE.md (accumulated context)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- patterns directly derived from existing codebase (invoice router, workflow engine)
- Pitfalls: HIGH -- derived from state machine design analysis and concurrent access patterns
- UI patterns: HIGH -- every component has a direct precedent in Phases 2-5

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable -- no external dependencies to track)
