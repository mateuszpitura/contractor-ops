# Architecture Research

**Domain:** B2B Contractor Operations / Multi-tenant SaaS
**Researched:** 2026-03-18
**Confidence:** HIGH (well-established patterns for this stack)

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Dashboard    │  │  Workflows   │  │  Invoices    │              │
│  │  (Next.js)   │  │  (Next.js)   │  │  (Next.js)   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                      │
│  ┌──────┴─────────────────┴──────────────────┴──────────────────┐   │
│  │               tRPC Client (type-safe calls)                  │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
├─────────────────────────────┼───────────────────────────────────────┤
│                         API LAYER                                   │
│  ┌──────────────────────────┴───────────────────────────────────┐   │
│  │                    tRPC Router (Next.js API)                 │   │
│  │  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐           │   │
│  │  │ Auth    │ │ Tenant │ │ RBAC    │ │ Audit    │           │   │
│  │  │ Guard   │ │ Scope  │ │ Check   │ │ Logger   │           │   │
│  │  └────┬────┘ └───┬────┘ └────┬────┘ └────┬─────┘           │   │
│  │       └──────────┴───────────┴────────────┘                 │   │
│  │                    Middleware Chain                          │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
├─────────────────────────────┼───────────────────────────────────────┤
│                      SERVICE LAYER                                  │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│  │Contractor │ │ Invoice   │ │ Workflow  │ │ Approval  │          │
│  │ Service   │ │ Service   │ │ Engine    │ │ Service   │          │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘          │
│  ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐ ┌─────┴─────┐          │
│  │ Document  │ │ Payment   │ │Notification│ │ Report    │          │
│  │ Service   │ │ Service   │ │ Service   │ │ Service   │          │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘          │
├────────┴─────────────┴─────────────┴─────────────┴──────────────────┤
│                      DATA / INFRA LAYER                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ PostgreSQL   │  │ Upstash      │  │ Cloudflare   │              │
│  │ (Neon)       │  │ Redis+QStash │  │ R2           │              │
│  │ via Prisma   │  │              │  │ (files)      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘

External:
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │  Email   │  │  Slack   │  │  Vercel  │
  │  Intake  │  │  Bot     │  │  Cron    │
  └──────────┘  └──────────┘  └──────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Next.js App | UI rendering, routing, SSR/RSC | App Router with route groups per domain |
| tRPC Router | Type-safe API layer, request validation | Shared package in monorepo, Zod schemas |
| Auth Guard | Session verification, user context | Better Auth middleware |
| Tenant Scope | Inject organization_id into all queries | Prisma Client Extension via AsyncLocalStorage |
| RBAC Check | Permission enforcement per procedure | Role-based middleware on tRPC procedures |
| Audit Logger | Immutable event logging | Append-only PostgreSQL table, async write |
| Contractor Service | CRUD, search, compliance tracking | Prisma queries scoped to tenant |
| Invoice Service | Intake, matching, dedup, status tracking | State machine for invoice lifecycle |
| Workflow Engine | Template execution, task management | DB-driven state machine (not external engine) |
| Approval Service | Chain routing, SLA tracking, delegation | Configurable N-level approval with escalation |
| Document Service | Upload orchestration, signed URL generation | R2 presigned URLs + metadata in PostgreSQL |
| Payment Service | Batch creation, file export, status tracking | Idempotent batch operations |
| Notification Service | In-app + email + Slack delivery | QStash for async delivery, templates |
| Report Service | Aggregation queries, data export | PostgreSQL materialized views / CTEs |

## Recommended Project Structure

```
contractor-ops/
├── apps/
│   └── web/                        # Next.js application
│       ├── src/
│       │   ├── app/                # App Router
│       │   │   ├── (auth)/         # Login, register, invite accept
│       │   │   ├── (dashboard)/    # Authenticated app shell
│       │   │   │   ├── contractors/
│       │   │   │   ├── contracts/
│       │   │   │   ├── invoices/
│       │   │   │   ├── workflows/
│       │   │   │   ├── payments/
│       │   │   │   ├── reports/
│       │   │   │   └── settings/
│       │   │   └── api/
│       │   │       ├── trpc/[trpc]/ # tRPC handler
│       │   │       ├── webhooks/    # QStash callbacks, Slack, email
│       │   │       └── cron/        # Vercel cron endpoints
│       │   ├── components/          # App-specific components
│       │   │   ├── contractors/
│       │   │   ├── invoices/
│       │   │   ├── workflows/
│       │   │   └── shared/
│       │   ├── hooks/               # App-specific hooks
│       │   ├── lib/                 # App utilities
│       │   └── trpc/                # tRPC client setup
│       ├── public/
│       ├── next.config.ts
│       └── vercel.json              # Cron definitions
│
├── packages/
│   ├── api/                         # tRPC router definitions
│   │   ├── src/
│   │   │   ├── root.ts             # Root router
│   │   │   ├── context.ts          # Request context (auth, tenant)
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # Authentication middleware
│   │   │   │   ├── tenant.ts       # Tenant scoping middleware
│   │   │   │   ├── rbac.ts         # Role-based access control
│   │   │   │   └── audit.ts        # Audit logging middleware
│   │   │   └── routers/
│   │   │       ├── contractor.ts
│   │   │       ├── contract.ts
│   │   │       ├── invoice.ts
│   │   │       ├── workflow.ts
│   │   │       ├── approval.ts
│   │   │       ├── payment.ts
│   │   │       ├── document.ts
│   │   │       ├── notification.ts
│   │   │       ├── report.ts
│   │   │       ├── settings.ts
│   │   │       └── user.ts
│   │   └── package.json
│   │
│   ├── db/                          # Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── client.ts           # Extended Prisma client
│   │   │   ├── tenant.ts           # Tenant-scoped client extension
│   │   │   └── types.ts            # Generated type re-exports
│   │   └── package.json
│   │
│   ├── auth/                        # Better Auth configuration
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── client.ts           # Client-side auth helpers
│   │   │   └── server.ts           # Server-side auth helpers
│   │   └── package.json
│   │
│   ├── services/                    # Business logic (domain services)
│   │   ├── src/
│   │   │   ├── invoice/
│   │   │   │   ├── matching.ts      # Invoice-to-contract matching
│   │   │   │   ├── dedup.ts         # Duplicate detection
│   │   │   │   └── lifecycle.ts     # State machine
│   │   │   ├── workflow/
│   │   │   │   ├── engine.ts        # Workflow execution engine
│   │   │   │   ├── templates.ts     # Template management
│   │   │   │   └── tasks.ts         # Task operations
│   │   │   ├── approval/
│   │   │   │   ├── chain.ts         # Approval chain logic
│   │   │   │   ├── escalation.ts    # SLA + escalation
│   │   │   │   └── delegation.ts    # Delegate/reassign
│   │   │   ├── payment/
│   │   │   │   ├── batch.ts         # Batch creation
│   │   │   │   └── export.ts        # CSV/bank file generation
│   │   │   ├── notification/
│   │   │   │   ├── dispatcher.ts    # Route to channel
│   │   │   │   ├── email.ts         # Email via Resend/etc
│   │   │   │   └── slack.ts         # Slack integration
│   │   │   ├── document/
│   │   │   │   ├── storage.ts       # R2 operations
│   │   │   │   └── signing.ts       # Presigned URL generation
│   │   │   └── audit/
│   │   │       └── logger.ts        # Append-only audit writes
│   │   └── package.json
│   │
│   ├── ui/                          # Shared UI components (shadcn/ui)
│   │   ├── src/
│   │   │   ├── components/          # Base shadcn components
│   │   │   └── lib/                 # UI utilities
│   │   └── package.json
│   │
│   ├── shared/                      # Shared types, constants, i18n
│   │   ├── src/
│   │   │   ├── types/               # Shared TypeScript types
│   │   │   ├── constants/           # Roles, statuses, enums
│   │   │   ├── i18n/                # Translation dictionaries
│   │   │   ├── validators/          # Shared Zod schemas
│   │   │   └── utils/               # Pure utility functions
│   │   └── package.json
│   │
│   └── config/                      # Shared configs
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

### Structure Rationale

- **`packages/api/`:** tRPC as its own package is the standard Turborepo pattern. Both the Next.js app and future services (Slack bot, email worker) import types from it. Single source of truth for API contracts.
- **`packages/db/`:** Prisma schema, migrations, and the tenant-scoped client extension live here. Every package that needs DB access imports from `@contractor-ops/db`.
- **`packages/services/`:** Business logic separated from API layer. Services are called by tRPC routers but can also be called by cron jobs, webhooks, and background tasks. This is where domain complexity lives.
- **`packages/shared/`:** Types, constants, Zod schemas, i18n dictionaries. Zero runtime dependencies. Imported everywhere.
- **`packages/auth/`:** Better Auth config isolated so both client and server can import appropriate helpers.
- **Route groups `(auth)` and `(dashboard)`:** Next.js App Router convention for different layouts without affecting URL structure.

## Architectural Patterns

### Pattern 1: Application-Level Tenant Isolation via Prisma Client Extension

**What:** Every database query is automatically scoped to the current tenant's `organization_id` via a Prisma Client Extension that reads from AsyncLocalStorage. PostgreSQL RLS is used as defense-in-depth, not as the primary mechanism.

**When to use:** All tenant-scoped data access (which is nearly everything).

**Trade-offs:**
- PRO: Type-safe, impossible to forget tenant filter at the query level
- PRO: Works with Prisma's query builder, includes, relations
- PRO: No per-tenant database roles needed (critical for Neon serverless)
- CON: Must set up AsyncLocalStorage context correctly per request
- CON: Cross-tenant operations (admin/system tasks) need explicit bypass

**Why not RLS-only:** Prisma does not natively support setting PostgreSQL session variables (`SET app.current_tenant`) needed for RLS policies. With Neon's connection pooling, session state management is unreliable. Application-level scoping via Prisma extensions is the proven pattern for this stack.

**Example:**
```typescript
// packages/db/src/tenant.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";

export const tenantContext = new AsyncLocalStorage<{ organizationId: string }>();

export function createTenantClient(prisma: PrismaClient) {
  return prisma.$extends({
    query: {
      $allOperations({ operation, args, query }) {
        const ctx = tenantContext.getStore();
        if (!ctx) throw new Error("Tenant context not set");

        // Auto-inject organizationId into where clauses
        if (["findMany", "findFirst", "findUnique", "update", "delete", "count"].includes(operation)) {
          args.where = { ...args.where, organizationId: ctx.organizationId };
        }
        if (operation === "create") {
          args.data = { ...args.data, organizationId: ctx.organizationId };
        }
        return query(args);
      },
    },
  });
}

// packages/api/src/middleware/tenant.ts — sets context per tRPC request
export const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  return tenantContext.run(
    { organizationId: ctx.session.organizationId },
    () => next({ ctx })
  );
});
```

**Defense-in-depth with RLS:**
```sql
-- Applied as migration, provides safety net
ALTER TABLE contractors ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON contractors
  USING (organization_id = current_setting('app.current_tenant', true)::uuid);
```

### Pattern 2: Database-Driven Workflow Engine (No External Engine)

**What:** Workflows are modeled as data in PostgreSQL: templates define steps, instances track execution state, tasks represent individual work items. State transitions are enforced in service code, not by an external engine like Temporal.

**When to use:** For this project. The workflow requirements (onboarding/offboarding templates, task dependencies, conditional logic) are well-defined and do not require distributed orchestration.

**Trade-offs:**
- PRO: No additional infrastructure (Temporal, Inngest) to manage
- PRO: All data in one database, simple to query and report on
- PRO: Full control over workflow semantics
- CON: Must build retry/timeout logic yourself (use QStash for this)
- CON: If workflows become very complex (hundreds of steps, long-running sagas), this pattern hits limits

**Rationale for not using Temporal/Inngest/Restate:** These are powerful but add operational complexity disproportionate to the workflow needs here. The workflows are human-task-driven (not compute-driven), with steps lasting hours to days. A database + QStash for timers is sufficient and keeps the stack simple.

**Data model:**
```
WorkflowTemplate (org-scoped)
  ├── WorkflowStep[] (ordered, with dependencies)
  │   ├── name, description, assignee_role
  │   ├── depends_on (step references)
  │   ├── conditional_logic (JSON)
  │   └── sla_hours
  │
WorkflowInstance (created from template)
  ├── contractor_id, template_id, status
  ├── started_at, completed_at
  └── WorkflowTask[] (one per step)
      ├── status: pending | active | completed | skipped
      ├── assigned_to (user_id)
      ├── due_at (calculated from SLA)
      └── completed_at
```

**Engine logic:**
```typescript
// packages/services/src/workflow/engine.ts
export async function advanceWorkflow(instanceId: string, completedTaskId: string) {
  // 1. Mark task complete
  // 2. Evaluate dependent tasks — activate those whose dependencies are all met
  // 3. Evaluate conditional logic for each candidate task
  // 4. If all tasks done → mark workflow complete
  // 5. Emit events: task.completed, workflow.advanced, workflow.completed
  // 6. Schedule SLA check via QStash for newly activated tasks
}
```

### Pattern 3: Configurable Approval Chains

**What:** Approval chains are configured per organization with 1-3 levels. Each level has an approver role or specific user. Invoices (and potentially other entities) are routed through the chain sequentially.

**When to use:** Invoice approval, potentially contract approval, expense approval.

**Trade-offs:**
- PRO: Simple mental model: sequential levels, clear ownership
- PRO: Supports delegation, escalation, and comments
- CON: Not a general-purpose BPM — if approval logic becomes very dynamic, this hits limits

**Data model:**
```
ApprovalChain (org-scoped)
  ├── name, entity_type (invoice, contract, etc.)
  ├── condition_rules (JSON: amount thresholds, contractor tags)
  └── ApprovalLevel[] (ordered 1-3)
      ├── level_number
      ├── approver_type: role | user
      ├── approver_id (role or user_id)
      └── sla_hours

ApprovalRequest (instance)
  ├── entity_type, entity_id (polymorphic ref)
  ├── chain_id, status: pending | approved | rejected
  └── ApprovalStep[] (one per level)
      ├── level_number, status
      ├── assigned_to, delegated_to
      ├── decided_at, decision, comment
      └── sla_deadline
```

**Flow:**
```
Invoice submitted
    ↓
Select chain (based on org config + condition rules)
    ↓
Create ApprovalRequest + Step for level 1
    ↓
Notify approver (in-app + email + Slack)
    ↓
Schedule SLA check via QStash
    ↓
Approver decides:
  ├── Approve → advance to next level (or complete)
  ├── Reject → mark request rejected, require comment
  ├── Clarify → pause, notify submitter
  └── Delegate → reassign step, notify new approver
```

### Pattern 4: Event-Driven Audit and Notifications via Domain Events

**What:** Critical state changes emit domain events. These events are: (a) written to an append-only audit log table, and (b) dispatched to notification handlers. Events are processed in-band for audit (same transaction) and out-of-band for notifications (via QStash).

**When to use:** All state mutations on critical entities (invoices, approvals, workflows, payments, contractors, contracts).

**Trade-offs:**
- PRO: Audit log is transactionally consistent (written in same DB transaction)
- PRO: Notifications are async and don't slow down the request
- PRO: Single event definition drives both audit and notification
- CON: Not full event sourcing — state is stored normally, events are supplementary
- CON: Must be disciplined about emitting events from every mutation path

**This is NOT full event sourcing.** Full event sourcing (deriving state from events) is overkill here. Instead, use a simple "event log" pattern: store events for audit trail and notification triggers, but maintain normal CRUD state in domain tables.

**Example:**
```typescript
// packages/services/src/audit/logger.ts
interface DomainEvent {
  type: string;              // e.g., "invoice.approved"
  entityType: string;        // e.g., "invoice"
  entityId: string;
  organizationId: string;
  actorId: string;
  metadata: Record<string, unknown>; // Event-specific data
  occurredAt: Date;
}

// In service layer — within the same transaction
async function approveInvoice(invoiceId: string, ctx: ServiceContext) {
  return ctx.db.$transaction(async (tx) => {
    const invoice = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: "approved" },
    });

    // Audit: written in same transaction (consistency)
    await tx.auditLog.create({
      data: {
        eventType: "invoice.approved",
        entityType: "invoice",
        entityId: invoiceId,
        organizationId: ctx.organizationId,
        actorId: ctx.userId,
        metadata: { previousStatus: "pending_approval", amount: invoice.amount },
      },
    });

    // Notifications: dispatched async via QStash (does not block)
    await dispatchNotification({
      type: "invoice.approved",
      entityId: invoiceId,
      organizationId: ctx.organizationId,
    });

    return invoice;
  });
}
```

### Pattern 5: Background Jobs via QStash on Vercel

**What:** QStash is used for all async/background work: notification delivery, SLA deadline checks, email intake processing, report generation, and scheduled tasks. Vercel Cron handles recurring schedules (daily digest, overdue detection).

**When to use:** Any operation that should not block the user request, or that needs to run on a schedule.

**Architecture:**
```
┌──────────────┐     HTTP POST      ┌──────────────┐
│ Service code │ ──────────────────→ │   QStash     │
│ (publishes)  │                     │   (queue)    │
└──────────────┘                     └──────┬───────┘
                                            │ HTTP callback
                                            ↓
                                     ┌──────────────┐
                                     │ /api/webhooks │
                                     │ /qstash/*    │
                                     │ (consumers)  │
                                     └──────────────┘

Vercel Cron (vercel.json):
  "0 6 * * *"  → /api/cron/daily-digest
  "*/15 * * *" → /api/cron/overdue-check
  "0 * * * *"  → /api/cron/sla-escalation
```

**Key patterns:**
- QStash signature verification on all webhook endpoints (prevents unauthorized calls)
- Idempotency keys on all QStash messages (safe retries)
- Small payloads: send entity IDs, not full data — the consumer fetches current state
- Use QStash `delay` for scheduled future tasks (e.g., SLA deadline in 24h)
- Use QStash `callback` + `failureCallback` URLs for monitoring

**Example job types:**
| Job | Trigger | Consumer |
|-----|---------|----------|
| Send notification email | Domain event (invoice.approved) | /api/webhooks/qstash/email |
| Send Slack message | Domain event | /api/webhooks/qstash/slack |
| SLA escalation check | QStash delayed message | /api/webhooks/qstash/escalation |
| Process email intake | Incoming email webhook | /api/webhooks/email-intake |
| Generate payment file | User action (create batch) | /api/webhooks/qstash/payment-export |
| Daily digest | Vercel Cron 6:00 AM | /api/cron/daily-digest |
| Overdue invoice check | Vercel Cron every 15min | /api/cron/overdue-check |

### Pattern 6: File Storage with Presigned URLs

**What:** Files (invoices, contracts, documents) are uploaded directly from the browser to Cloudflare R2 via presigned PUT URLs. Metadata is stored in PostgreSQL. Downloads use presigned GET URLs with short expiry.

**Flow:**
```
Upload:
  Browser → POST /api/trpc/document.requestUpload (returns presigned PUT URL + document ID)
  Browser → PUT to R2 presigned URL (direct upload, bypasses server)
  Browser → POST /api/trpc/document.confirmUpload (marks document as uploaded)

Download:
  Browser → GET /api/trpc/document.getDownloadUrl (returns presigned GET URL, 15min expiry)
  Browser → GET from R2 presigned URL (direct download)
```

**Why this pattern:**
- Server never handles file bytes (Vercel has 4.5MB body limit on serverless functions)
- R2 has zero egress fees (unlike S3)
- Presigned URLs are time-limited and scoped to specific keys
- File key includes organization_id as prefix for bucket-level tenant isolation

**File key structure:**
```
{organization_id}/{entity_type}/{entity_id}/{uuid}_{original_filename}
```

## Data Flow

### Request Flow (Standard tRPC Call)

```
User Action (click, form submit)
    ↓
React Component → tRPC useMutation/useQuery
    ↓
tRPC Client (type-safe HTTP call)
    ↓
Next.js API Route (/api/trpc/[trpc])
    ↓
tRPC Middleware Chain:
  1. Auth Guard (verify session via Better Auth)
  2. Tenant Scope (set AsyncLocalStorage context)
  3. RBAC Check (verify role has permission for this procedure)
  4. Audit Middleware (log after successful mutation)
    ↓
tRPC Router → Service Function (business logic)
    ↓
Prisma Client Extension (auto-injects organization_id)
    ↓
PostgreSQL (Neon) → Response
    ↓
tRPC serialization → JSON → Client
    ↓
TanStack Query cache → React re-render
```

### Invoice-to-Payment Flow (Core Business Flow)

```
1. INTAKE
   Email arrives / User uploads PDF
       ↓
   Parse sender, extract invoice number, amount
       ↓
   Create Invoice record (status: received)

2. MATCHING
   Auto-match to Contractor (by NIP/tax ID from sender)
       ↓
   Auto-match to Contract (active contract for contractor)
       ↓
   Compare amount vs contract rate, flag deviations
       ↓
   Duplicate check (invoice_number + contractor + amount)
       ↓
   Update Invoice (status: matched | needs_review)

3. APPROVAL
   Select ApprovalChain (org config + amount thresholds)
       ↓
   Create ApprovalRequest + first ApprovalStep
       ↓
   Notify approver (QStash → email + Slack + in-app)
       ↓
   Schedule SLA deadline (QStash delayed message)
       ↓
   Approver: approve | reject | clarify | delegate
       ↓
   Advance through levels until final approval
       ↓
   Update Invoice (status: approved)

4. PAYMENT
   Finance user selects approved invoices → Create PaymentBatch
       ↓
   Generate bank CSV/file (async via QStash)
       ↓
   Download file, upload to bank (manual in v1)
       ↓
   Mark batch as paid/partial/failed
       ↓
   Update individual Invoice statuses

5. AUDIT (throughout)
   Every state change → audit_log INSERT (same transaction)
   Every state change → notification dispatch (QStash)
```

### State Management

```
Server State (TanStack Query):
  ┌─────────────────────────────────────────────┐
  │  Query Cache                                │
  │  ├── ["contractors", filters] → list data   │
  │  ├── ["invoice", id] → invoice detail       │
  │  ├── ["approval-queue"] → pending approvals │
  │  └── ["dashboard-stats"] → KPI data         │
  └─────────────────────────────────────────────┘
        ↕ invalidation on mutation success

Client State (Zustand — minimal):
  ┌─────────────────────────────────────────────┐
  │  UI State only                              │
  │  ├── sidebar collapsed/expanded             │
  │  ├── command palette open/closed            │
  │  ├── active filters (URL-synced)            │
  │  └── notification bell unread count         │
  └─────────────────────────────────────────────┘
```

**Rule:** If data comes from the server, it lives in TanStack Query. Zustand is only for ephemeral UI state that has no server representation.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-50 orgs (launch) | Monolith is perfect. Single Neon database, single Next.js app. Focus on correctness. |
| 50-500 orgs | Add database indexes for organization_id on all tables. Consider read replicas for reports. QStash handles all async work fine. |
| 500-5000 orgs | Move heavy reports to separate Neon branch or read replica. Consider connection pooling tuning. May need to split QStash consumers if throughput is an issue. |
| 5000+ orgs | Consider schema-per-tenant or database sharding (unlikely to hit this scale with target market). |

### Scaling Priorities

1. **First bottleneck: Database queries.** Add composite indexes on `(organization_id, status)`, `(organization_id, contractor_id)`, etc. from day one. Prisma's query logging will reveal slow queries.
2. **Second bottleneck: QStash throughput.** If notification volume spikes, batch notifications (daily digest) instead of per-event. QStash has generous limits for this scale.
3. **Third bottleneck: File storage.** R2 with presigned URLs scales essentially infinitely. Not a concern.

## Anti-Patterns

### Anti-Pattern 1: Leaking Tenant Context

**What people do:** Forget to scope a query, or write a raw SQL query without organization_id filter.
**Why it's wrong:** Cross-tenant data leak. The worst possible bug in a multi-tenant SaaS.
**Do this instead:** Use the Prisma Client Extension for ALL queries. Never use `prisma` directly — always use the tenant-scoped client. For raw queries, wrap in a helper that injects the filter. Add integration tests that verify tenant isolation.

### Anti-Pattern 2: Fat tRPC Procedures

**What people do:** Put business logic directly in tRPC router handlers.
**Why it's wrong:** Logic becomes untestable, unreusable (can't call from cron job or webhook), and routers become massive files.
**Do this instead:** tRPC routers are thin — they validate input, call a service function, and return the result. All business logic lives in `packages/services/`.

### Anti-Pattern 3: Synchronous Notification Delivery

**What people do:** Send emails and Slack messages inside the request handler.
**Why it's wrong:** Slow requests, failures in notification delivery cause the user action to fail.
**Do this instead:** Dispatch notifications via QStash. The user action succeeds immediately; notifications are delivered async with retries.

### Anti-Pattern 4: Building a General-Purpose Workflow Engine

**What people do:** Build an overly generic workflow engine that handles any possible workflow pattern, including parallel branches, compensation, sub-workflows.
**Why it's wrong:** Massive engineering effort for features that may never be used. The project needs onboarding/offboarding with sequential tasks and basic conditional logic.
**Do this instead:** Build a simple task-dependency engine. Templates have ordered steps. Steps declare dependencies. Conditional logic is evaluated as simple JSON rules. Expand only when real requirements demand it.

### Anti-Pattern 5: Using Vercel Serverless for Long-Running Jobs

**What people do:** Try to process large CSV imports or generate complex reports within a single serverless function invocation.
**Why it's wrong:** Vercel has a 10-second execution limit on Hobby (60s on Pro) for serverless functions.
**Do this instead:** Break work into chunks. For CSV import: upload to R2, trigger QStash with file reference, process in batches of 100 rows per invocation, chain next batch via QStash. For reports: pre-compute with materialized views or process incrementally.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Neon (PostgreSQL) | Prisma Client, connection pooling via Neon's proxy | Use `?pgbouncer=true` in connection string for serverless |
| Upstash Redis | `@upstash/redis` SDK, used for rate limiting, caching, session store | Keep cache TTLs short, Redis is supplementary not primary |
| Upstash QStash | `@upstash/qstash` SDK, HTTP-based message queue | Verify signatures on all receiver endpoints |
| Cloudflare R2 | `@aws-sdk/client-s3` (S3-compatible), presigned URLs | Separate R2 API token from Worker credentials |
| Better Auth | SDK integration, session management | Session stored in PostgreSQL, verified per request |
| Slack | Incoming webhooks + Slack API for interactive messages | Use Block Kit for approval buttons, verify request signatures |
| Email (Resend/etc) | API-based email sending via QStash | Templates in code, rendered server-side |
| Vercel Cron | vercel.json cron config, hits API routes | Production-only, verify `CRON_SECRET` header |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web app ↔ API | tRPC (type-safe RPC over HTTP) | Single deployment, same Next.js app |
| API routers ↔ Services | Direct function call (same process) | Services imported as package |
| Services ↔ Database | Prisma Client Extension | Always via tenant-scoped client |
| Services ↔ File storage | R2 SDK (presigned URL generation) | Never passes file bytes through API |
| Services ↔ Async jobs | QStash HTTP publish | Small payloads, entity ID references only |
| Webhook consumers ↔ Services | Direct function call (same process) | Webhook endpoint validates, then calls service |

## Build Order (Dependencies)

This informs which components must be built first:

```
Phase 1: Foundation (everything depends on this)
  ├── Monorepo setup (Turborepo + packages)
  ├── Database schema + Prisma client + tenant extension
  ├── Auth (Better Auth + session + org membership)
  ├── tRPC setup with middleware chain (auth, tenant, RBAC)
  └── App shell (layout, navigation, settings)

Phase 2: Core Entities (needed by workflows and invoices)
  ├── Contractor CRUD
  ├── Contract CRUD + document upload (needs R2 integration)
  └── Document management (R2 presigned URLs)

Phase 3: Workflow Engine (depends on contractors, contracts)
  ├── Workflow template builder
  ├── Workflow execution engine
  └── Task management + notifications (needs QStash)

Phase 4: Invoice Pipeline (depends on contractors, contracts)
  ├── Invoice intake (upload + email)
  ├── Invoice matching engine
  ├── Duplicate detection
  └── Approval chain system

Phase 5: Payments + Reporting (depends on approved invoices)
  ├── Payment batch creation + export
  ├── Dashboard + KPI widgets
  └── Reports

Phase 6: Polish (depends on everything)
  ├── Slack integration (approval actions)
  ├── Global search + command palette
  ├── Data import wizard
  ├── Product onboarding
  └── Audit log viewer
```

**Key dependency insight:** The approval chain system (Phase 4) and workflow engine (Phase 3) share concepts (task assignment, SLA tracking, notifications) but serve different purposes. Build the notification/QStash infrastructure in Phase 3 so Phase 4 can reuse it.

## Sources

- [Row-Level Security for Multi-Tenant Applications](https://www.simplyblock.io/blog/underated-postgres-multi-tenancy-with-row-level-security/)
- [Multi-tenant data isolation with PostgreSQL RLS (AWS)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Prisma Multi-Tenancy Discussion](https://github.com/prisma/prisma/discussions/11601)
- [Multi-Tenancy with Prisma: Making 'where' Required](https://medium.com/@kz-d/multi-tenancy-with-prisma-a-new-approach-to-making-where-required-1e93a3783d9d)
- [ZenStack Multi-Tenancy Implementation Approaches](https://zenstack.dev/blog/multi-tenant)
- [QStash with Next.js (Upstash docs)](https://upstash.com/docs/qstash/quickstarts/vercel-nextjs)
- [Solving Vercel's 10-Second Limit with QStash](https://medium.com/@kolbysisk/case-study-solving-vercels-10-second-limit-with-qstash-2bceeb35d29b)
- [Inngest: Long-running background functions on Vercel](https://www.inngest.com/blog/vercel-long-running-background-functions)
- [Vercel Cron Jobs Guide](https://vercel.com/guides/how-to-setup-cron-jobs-on-vercel)
- [Presigned URLs (Cloudflare R2 docs)](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Upload Files to Cloudflare R2 in Next.js](https://www.buildwithmatija.com/blog/how-to-upload-files-to-cloudflare-r2-nextjs)
- [Restate: Persistent Serverless State Machines with XState](https://www.restate.dev/blog/persistent-serverless-state-machines-with-xstate-and-restate)
- [Event Sourcing vs Audit Log (Kurrent)](https://www.kurrent.io/blog/event-sourcing-audit)
- [Rethinking Event Sourcing (Bemi)](https://blog.bemi.io/rethinking-event-sourcing/)
- [Turborepo with Next.js (Vercel docs)](https://turborepo.dev/docs/guides/frameworks/nextjs)
- [Monorepo Management: Nx, Turborepo Best Practices](https://dasroot.net/posts/2026/03/monorepo-management-nx-turborepo-best-practices/)

---
*Architecture research for: B2B Contractor Operations Platform*
*Researched: 2026-03-18*
