# Architecture Research

**Domain:** v7.0 GTM Expansion — integration into the existing contractor-ops platform (US Cross-Border + Workforce Management + Integration Marketplace)
**Researched:** 2026-06-07
**Confidence:** HIGH (all seams verified against the live tree; file paths and signatures read directly, not inferred)

> Scope note: this is a **subsequent-milestone integration** study, not greenfield. Every recommendation extends a shipped v1–v6 component. Where a v7.0 feature names an existing factory/framework, the rule is **reuse, do not reinvent**. New code is flagged NEW; touched code is flagged MODIFIED.

---

## Standard Architecture

### System Overview — where v7.0 lands

```
┌───────────────────────────────────────────────────────────────────────────┐
│ CLIENTS                                                                     │
│  apps/web-vite (staff SPA, Page→Container→Hook→Component)                   │
│  apps/web-vite portal routes (/portal/* magic-link)  ← EMP-PORTAL extends   │
│  External API-key consumers (Zapier/n8n/Make)        ← Theme C consumes     │
└───────┬───────────────────────────┬───────────────────────┬────────────────┘
        │ /api/trpc/*                │ /api/trpc/portal       │ /api/v1/* (REST)
┌───────▼────────────┐   ┌───────────▼─────────┐   ┌──────────▼──────────────┐
│ apps/api (Fastify) │   │ portalAppRouter     │   │ apps/public-api (Hono)  │
│ tRPC appRouter     │   │ (portal-root.ts)    │   │ Hono routes → tRPC      │
│ ~50 namespaces     │   │ portal + portalTime │   │ caller (publicApiRouter)│
│  + classification  │   │  ← +employee router │   │  ← Theme C extends      │
└───────┬────────────┘   └─────────┬───────────┘   └──────────┬──────────────┘
        │                          │                          │
┌───────▼──────────────────────────▼──────────────────────────▼──────────────┐
│ packages/api  (tRPC v11, routers/{core,finance,compliance,integrations,…})  │
│   middleware: tenant · tier(requireTier) · feature-flag · rbac · api-key     │
│   services:   payment-export factory · regional-storage · audit-writer       │
│   ┌──────────── NEW v7.0 middleware: requireAddOn (composes w/ requireTier) ─┐│
│   └──────────── NEW routers: worker / employee / usForm / usPay / payroll …──┘│
└───────┬──────────────────────────────────────────────────────────────────┬─┘
        │                                                                    │
┌───────▼─────────────────────────┐   ┌──────────────────────────────────▼──┐
│ packages/integrations           │   │ packages/db (Prisma 7)               │
│  registry.ts (adapter registry) │   │  tenant.ts (AsyncLocalStorage + ext) │
│  credential-service (AES-GCM)   │   │  region.ts (EU/ME → +US)             │
│  webhook-dispatcher (inbound)   │   │  schema/*.prisma                     │
│  qstash-client · health-service │   │   ← Worker(=Contractor) · ApiKey ·   │
│   ← +Personio/BambooHR/payroll  │   │     WebhookSubscription · OutboxEvent│
└───────┬─────────────────────────┘   └──────────────────────────────────────┘
        │ QStash (fire-and-forget; OutboxEvent transactional outbox)
┌───────▼───────────────────────────────────────────────────────────────────────┐
│ apps/cron-worker (Fastify) — outbox drain, webhook _process, syncs, archives    │
│  ← NEW: outbound webhook dispatcher (Theme C), HRIS hourly sync, IRS retention   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (verified locations)

| Component | Responsibility | Verified location |
|-----------|----------------|-------------------|
| Tenant context | `organizationId` + `region` via AsyncLocalStorage; Prisma `$extends` auto-injects `organizationId` on every op | `packages/db/src/tenant.ts` |
| Region routing | `SUPPORTED_REGIONS` → per-region `PrismaClient` pool keyed by `DATABASE_URL_*` | `packages/db/src/region.ts` |
| Regional storage | Region → R2 bucket map for presigned URLs / object ops | `packages/api/src/services/regional-storage.ts` |
| Payment-export factory | Pure generators (CSV/Elixir/SEPA/SWIFT/BACS) + format dispatcher | `packages/api/src/services/payment-export.ts`; dispatcher `_generateExportFileForFormat` in `routers/finance/payment.ts` |
| Tier gating | `requireTier(minTier)` middleware → `proProcedure`/`enterpriseProcedure` | `packages/api/src/middleware/tier.ts` |
| Flag gating | `requireFeatureFlag(key)` + `tenantFlaggedProcedure`; NOT_FOUND on flag-off | `packages/api/src/middleware/feature-flag.ts` |
| RBAC + scope bridge | `requirePermission(perm)` — session→Better Auth, apiKey→`apiKeyScopes` via `permissionToScopes` | `packages/api/src/middleware/rbac.ts` |
| Adapter registry | `registerAdapter`/`getAdapter` + capability sub-registries (OCR, CompanyRegistry, Deprovisionable) | `packages/integrations/src/registry.ts` |
| Transactional outbox | `OutboxEvent` + `SELECT … FOR UPDATE SKIP LOCKED` drain via QStash schedule `/api/outbox/_drain` | `packages/db/prisma/schema/outbox.prisma`; handlers `packages/api/src/services/outbox/handlers.ts` |
| Public REST surface | Hono `/api/v1/*`, per-route tRPC caller, CORS allowlist, rate limiter, OpenAPI/Scalar | `apps/public-api/src/{app.ts,routes/*,openapi.ts,lib/*}` |
| API-key auth | Bearer `co_live_*` → `apiKeyTenantProcedure` (apiKeyAuth → `requireTier(ENTERPRISE)` → demoReadOnly) | `packages/api/src/middleware/api-key-auth.ts` |

---

## Recommended Project Structure (additions only)

```
packages/db/prisma/schema/
├── contractor.prisma            # MODIFIED: add workerType enum + employment fields (additive)
├── worker.prisma                # NEW (optional): Employee-only tables (akta, leave, time-emp)
├── api-key.prisma               # exists (OrganizationApiKey) — reuse for Theme C; rotation modelled
├── webhook-subscription.prisma  # NEW: WebhookSubscription + WebhookDeliveryAttempt (DLQ)
├── billing.prisma               # MODIFIED: add-on entitlement (OrgAddOn table or Subscription.addOns)
├── us-tax.prisma                # NEW: W9/W8/1099/1042-S form records + retention metadata

packages/api/src/middleware/
├── tier.ts                  # exists — requireTier (UNCHANGED)
├── add-on.ts                # NEW: requireAddOn(addOnKey) — composes AFTER requireTier
└── feature-flag.ts          # exists — requireFeatureFlag (UNCHANGED; flag-off = NOT_FOUND)

packages/api/src/routers/
├── core/                    # contractorRouter stays here, route shapes PRESERVED
├── workforce/               # NEW domain folder
│   ├── worker.ts            # workerRouter (shared cross-type ops)
│   ├── employee.ts          # employeeRouter (HR-gated)
│   └── leave.ts time-emp.ts akta.ts hr-dashboard.ts
├── finance/                 # ACH NACHA generator joins payment-export here (MODIFIED)
├── us/                      # NEW: usFormRouter, usPayRouter, usClassRouter, usFieldRouter
└── public-api/              # exists — extend with write endpoints + webhook subscription mgmt

packages/integrations/src/adapters/
├── personio-adapter.ts      # NEW: BaseAdapter (OAuth credential store + webhook + health)
├── bamboohr-adapter.ts      # NEW: BaseAdapter (REST)
├── gusto-adapter.ts quickbooks-payroll-adapter.ts adp-adapter.ts  # NEW payroll
├── modern-treasury-adapter.ts plaid-adapter.ts                    # NEW US-PAY
└── register-all.ts          # MODIFIED: register the new adapters

packages/integrations/src/services/
├── webhook-dispatcher.ts    # exists (INBOUND verification). NEW sibling:
└── outbound-webhook-dispatcher.ts  # NEW: HMAC sign + SSRF guard + enqueue via QStash/outbox

apps/public-api/src/routes/
├── contractors.ts invoices.ts …  # MODIFIED: add POST/PUT (write); add payments/payment-runs/workflows
└── webhooks.ts                    # NEW: subscription CRUD + test-fire

apps/web-vite/messages/
└── en-US.json               # NEW: full key parity vs en.json (US-LOC-01)

apps/web-vite/src/pages/portal/
└── employee/                # NEW: /employee/* shell pages (EMP-PORTAL); same magic-link auth
```

### Structure Rationale

- **`contractor.prisma` MODIFIED, not replaced.** WORKER-01 is a non-breaking additive migration: add `workerType WorkerType @default(CONTRACTOR)` plus nullable employment columns to the existing `Contractor` model. Zero data migration for v1–v6 orgs (default backfills). The "discriminated union" is logical (`workerType` discriminator on one physical table), keeping every shipped FK relation (`invoices`, `contracts`, `paymentRunItems`, `complianceItems`, `deprovisioningRuns`, `assignments`) intact. Employee-only satellite tables (akta sections, leave balances, employee time) go in a new `worker.prisma` to avoid bloating the hot Contractor row.
- **`workforce/` and `us/` as new router domain folders** mirror the existing `routers/{core,finance,compliance,integrations,gulf,equipment,workflow}` convention. They register in `root.ts` the same way classification routers do, and gate behind flag + add-on (see Patterns).
- **`add-on.ts` beside `tier.ts`** — the add-on check is a peer concern to tier, not a replacement. Compose `tenantFlaggedProcedure → requireTier(base) → requireAddOn('workforce') → requireFeatureFlag('workforce-employees')`.
- **`public-api/routes/` MODIFIED for writes** — the read surface (GET contractors/invoices/contracts/documents/feature-flags) already exists; Theme C adds POST/PUT plus new resources. The webhook subscription API is a new Hono route group.

---

## Architectural Patterns

### Pattern 1: Logical discriminated union over the existing physical Contractor (WORKER-01)

**What:** Add `workerType WorkerType @default(CONTRACTOR)` to `model Contractor`. `workerRouter` exposes type-agnostic ops (list, search, owner assignment), `contractorRouter` keeps its existing route shapes for B2B, `employeeRouter` adds employment ops gated to HR roles.
**When to use:** When the new entity shares ~80% of an existing entity's relations and you need zero-downtime for existing tenants. The milestone explicitly locks this.
**Trade-offs:** One table stays wide; mitigated by satellite tables for employee-only data. Win: every shipped relation, the tenant `$extends` scope, soft-delete, and `writeAuditLog` path apply to employees for free.

```prisma
// contractor.prisma (MODIFIED — additive)
enum WorkerType { CONTRACTOR EMPLOYEE }

model Contractor {
  // … all existing fields unchanged …
  workerType   WorkerType @default(CONTRACTOR)   // discriminator; backfills CONTRACTOR
  employment   EmployeeProfile?                  // 1:1, NULL for contractors
  @@index([organizationId, workerType])          // new index for B-side list filters
}
```

```ts
// root.ts (MODIFIED) — register exactly like classification, gated by flag at the procedure
export const appRouter = router({
  // … existing 50 namespaces, contractor PRESERVED …
  worker: workerRouter,       // shared; visible when workforce add-on present
  employee: employeeRouter,   // HR-gated; flag-off ⇒ NOT_FOUND per requireFeatureFlag
});
```

### Pattern 2: `requireAddOn` middleware composing AFTER `requireTier` (billing)

**What:** A new middleware factory in `packages/api/src/middleware/add-on.ts` modelled on `tier.ts`. It reads a per-org add-on entitlement (new `OrgAddOn` table, or `Subscription.addOns String[]`) and throws a structured `FORBIDDEN` (`type: ADD_ON_REQUIRED`) mirroring the existing `TIER_REQUIRED` JSON shape so the SPA reuses the upgrade-prompt path.
**When to use:** Theme A (`us-cross-border` SKU) and Theme B (`workforce` SKU). Theme C is **tier-gated, not add-on** (Starter read / Pro read+write / Enterprise unlimited) — it keeps `requireTier`.
**Trade-offs:** Two billing axes (tier × add-on). Keep them orthogonal: tier = depth of base product; add-on = surface unlock. Compose in this order so a non-subscriber gets the tier error first.

```ts
// add-on.ts (NEW) — peer to requireTier; cache like getSubscription (Redis)
export function requireAddOn(addOn: AddOnKey) {
  return t.middleware(async ({ ctx, next }) => {
    const has = await orgHasAddOn(ctx.organizationId, addOn);
    if (!has) throw new TRPCError({ code: 'FORBIDDEN',
      message: JSON.stringify({ type: 'ADD_ON_REQUIRED', requiredAddOn: addOn }) });
    return next({ ctx });
  });
}
export const workforceProcedure = tenantFlaggedProcedure
  .use(requireTier('STARTER'))
  .use(requireAddOn('workforce'))
  .use(requireFeatureFlag('workforce-employees'));
```

### Pattern 3: Flag-off = render-tree removal + tRPC NOT_FOUND (B-route gating)

**What:** Reuse the v5 classification flag-off pattern exactly. Server: `requireFeatureFlag('workforce-employees')` returns `NOT_FOUND` (does not leak existence) — the EXISTING behaviour in `feature-flag.ts`. Client: web-vite container reads `useFlag` and removes the route subtree (`<Navigate />` / null) per the Container decision rule.
**When to use:** Every B2 route (WORKER-05). Also the staff-facing US and Theme-C settings surfaces.
**Trade-offs:** None new — shipped, lint-guarded pattern. The flag must be declared in `flags-core.ts` FLAGS and carry a signoff-registry entry (boot-time gate `assertFlagSignoffsOrExit` in `feature-flags/src/registry.ts`).

### Pattern 4: New payment format = new pure generator + one dispatcher branch (ACH NACHA)

**What:** Add `generateNachaFile(items, originatorAch, runRef)` to `payment-export.ts` (pure, like `generateBacsStandard18`). Add `ACH_NACHA` to the `PaymentExportFormat` enum (`payment.prisma`). Add one branch to `_generateExportFileForFormat` in `routers/finance/payment.ts`. The generator takes decrypted routing/account numbers from the caller — never touches encrypted blobs (same contract as BACS).
**When to use:** US-PAY-01. Modern Treasury/Plaid (US-PAY-03/05) ride the integrations adapter registry + credential store instead (programmatic ACH initiation), not the file factory.
**Trade-offs:** None — this is the v4/v5 proven extension shape. Do NOT create a parallel export module.

```ts
// payment.ts (MODIFIED) — dispatcher gains one branch
if (format === 'ACH_NACHA') {
  return { fileBuffer: generateNachaFile(achItems, originatorAch, runRef), ext: 'txt' };
}
```

### Pattern 5: HRIS / payroll as BaseAdapter on the existing integrations framework

**What:** Personio, BambooHR, Gusto, QuickBooks-Payroll, ADP are each a `BaseAdapter` registered via `registerAdapter` in `register-all.ts`. They reuse: AES-256-GCM `credential-service`, OAuth `oauth-arctic`/`oauth-state`, inbound `webhook-dispatcher`, `health-service`, and `IntegrationConnection`/`IntegrationSyncLog`/`ExternalLink` rows. Add the provider literals to the `IntegrationProvider` enum (`integration.prisma` MODIFIED).
**When to use:** All of B7 (PAYROLL-*) and B8 (HRIS-SYNC-*).
**Trade-offs:** Source-of-truth split (HRIS-SYNC-05) is a domain rule, not infra: implement a field-ownership map in the sync handler — registry fields write from HRIS; financial/compliance fields are locked against HRIS overwrite. Per-org single Personio OR BambooHR is enforceable by the existing `@@unique([organizationId, provider, userId])` plus an app-level "one HRIS connection" guard.

### Pattern 6: Outbound webhooks via the transactional outbox + QStash (Theme C)

**What:** Producers `INSERT INTO OutboxEvent` inside the same `$transaction` as the domain mutation (e.g. `invoice.paid`). The cron-worker drain (`/api/outbox/_drain`, `FOR UPDATE SKIP LOCKED`) fans out to a NEW `outbound-webhook-dispatcher` that: looks up active `WebhookSubscription` rows for the org+event, SSRF-guards the target URL (resolve-then-verify against private ranges at dispatch), signs HMAC-SHA256 (`X-CO-Signature: t=…,v1=…`), POSTs, and on failure re-enqueues with the outbox's existing exponential-backoff/attempts bookkeeping; after max attempts → DLQ row + admin alert at 5 failures/1h.
**When to use:** INTEG-WEBHOOK-01..07. Reuses the at-least-once guarantee already shipped for notifications/integration webhooks.
**Trade-offs:** The inbound `webhook-dispatcher.ts` verifies provider→us webhooks; the outbound dispatcher is a NEW sibling — do not overload the inbound one. PII redaction (INTEG-WEBHOOK-07) is applied in the dispatcher before signing, keyed off `WebhookSubscription.includePii`.

```ts
// inside the domain mutation transaction (e.g. invoice paid)
await tx.outboxEvent.create({ data: {
  organizationId, eventType: 'invoice.paid',
  aggregateType: 'Invoice', aggregateId: invoice.id,
  payloadJson: redactablePayload, dedupKey: `webhook:invoice.paid:${invoice.id}`,
}}); // drain → outbound-webhook-dispatcher → fan out to subscriptions
```

### Pattern 7: API-key scopes already bridge to RBAC (Theme C auth)

**What:** `OrganizationApiKey.scopes String[]` already exists; `requirePermission` already maps `apiKeyScopes` → required scopes via `permissionToScopes` (`rbac.ts`). The Theme C scope picker UI (INTEG-AUTH-02) writes into this same array; write endpoints add `requirePermission({ x: ['write'] })`. **No new auth primitive needed.**
**When to use:** All Theme C write endpoints in `routers/public-api/*`.
**Trade-offs:** Per-tier rate limiting (INTEG-AUTH-04) is the genuinely-new piece — extend the existing `apps/public-api/src/lib/rate-limiter.ts` (Redis) with per-tier buckets.

---

## Data Flow

### Cross-border invoice → ACH payout (Theme A)

```
US payer org (region=us-east-1) → invoice (USD, integer cents)
   ↓ approval chain (existing)            ↓ payment run (existing)
   ↓ format = ACH_NACHA  →  generateNachaFile() [NEW pure generator]
   ↓ OR US-PAY-03: Modern Treasury adapter → programmatic ACH initiate
   ↓ 1099-NEC year-end batch → US R2 bucket (us-east-1) → soft-delete + scheduled archive (4/7yr)
```

### Employee onboarding → payroll push / HRIS sync (Theme B)

```
HR_ADMIN creates Worker(workerType=EMPLOYEE)  → flag+add-on gated route
   ↓ EmployeeProfile + per-market fields (PESEL/Steuer-IdNr/NI/SSN, Zod-validated)
   ↓ akta sections (RBAC per section) · leave balance engine · employee time
   ↓ OutboxEvent OR adapter sync → Gusto/QuickBooks/ADP (export adapter)
HRIS pull (hourly cron) Personio/BambooHR → registry fields update Worker
   conflict: registry←HRIS ; financial/compliance fields LOCKED (HRIS-SYNC-05)
```

### Public API write → outbound webhook (Theme C)

```
External client (Bearer co_live_…) → Hono /api/v1/invoices [POST, NEW]
   ↓ createPublicCaller → apiKeyTenantProcedure → requireTier → requirePermission({invoice:['write']})
   ↓ tRPC mutation (tenant-scoped, writeAuditLog with apiKeyId+sourceIp)
   ↓ same $transaction: OutboxEvent('invoice.created')
   ↓ cron drain → outbound-webhook-dispatcher → SSRF guard → HMAC sign → POST subscriber
   ↓ fail → backoff (outbox attempts) → DLQ row + admin alert at 5/1h
```

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k orgs | Current shape holds. US region adds one Prisma client to the existing pool; no topology change. |
| 1k–10k orgs | Outbound webhook fan-out is the first pressure point — the outbox `FOR UPDATE SKIP LOCKED` drain already supports concurrent workers; scale cron-worker replicas. Per-tier API rate limits cap noisy tenants. |
| 10k+ orgs | Dedicate a webhook-dispatch worker separate from the outbox notification drain; partition `OutboxEvent`/`WebhookDeliveryAttempt` by org-hash. US read replicas stay off by default (US-INFRA-01). |

### Scaling Priorities
1. **First bottleneck:** outbound webhook dispatch volume (fan-out × retries). Mitigation: already on the durable outbox + QStash; isolate its drain schedule from the notification drain.
2. **Second bottleneck:** the wide Contractor row once employees + per-market fields land. Mitigation: keep employee-only data in satellite tables (`worker.prisma`), index `(organizationId, workerType)`.

---

## Anti-Patterns

### Anti-Pattern 1: Separate `Worker`/`Employee` physical table
**What people do:** Create a brand-new `Worker` table and migrate/duplicate Contractor relations.
**Why it's wrong:** Breaks every shipped FK (invoices, payments, compliance, deprovisioning), forces data migration for v1–v6 orgs, and violates the locked "non-breaking additive, zero data migration" decision.
**Do this instead:** Discriminator column on the existing `Contractor` model + satellite tables for employee-only data (Pattern 1).

### Anti-Pattern 2: A second webhook dispatcher / second integration framework
**What people do:** Build a fresh outbound webhook stack and a parallel adapter loader for HRIS/payroll.
**Why it's wrong:** Duplicates AES-GCM credential store, health monitoring, OAuth, dedup, and backoff that are shipped and lint-guarded.
**Do this instead:** New adapters via `registerAdapter` (Pattern 5); outbound webhooks as a NEW dispatcher service that consumes the EXISTING `OutboxEvent` outbox (Pattern 6).

### Anti-Pattern 3: New money/export module for ACH
**What people do:** Write a standalone NACHA module outside the payment-export factory.
**Why it's wrong:** Diverges from the format-dispatcher contract, loses integer-cents/grosze discipline and the decrypt-at-caller invariant.
**Do this instead:** One pure `generateNachaFile` + one `PaymentExportFormat` enum value + one dispatcher branch (Pattern 4).

### Anti-Pattern 4: Bypassing tenant `$extends` for cross-region/US queries
**What people do:** Reach for `prismaRaw` or hand-built clients when adding the US region.
**Why it's wrong:** `prismaRaw` is for cron cross-org aggregation only; request handlers must keep the AsyncLocalStorage scope.
**Do this instead:** Add `'US'` to `SUPPORTED_REGIONS` + `DATABASE_URL_US` mapping in `region.ts`, add `R2_BUCKET_NAME_US` to `regional-storage.ts`, route per-org via the existing `Organization.dataRegion` default, and add `US` to the Prisma `DataRegion` enum.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Modern Treasury / Plaid (US-PAY) | BaseAdapter + credential store + OAuth | Reuse `oauth-arctic`; programmatic ACH initiation, not the file factory |
| Personio / BambooHR (HRIS) | BaseAdapter; hourly pull cron + event push | Source-of-truth split in sync handler; one HRIS per org (app guard + unique index) |
| Gusto / QuickBooks / ADP (payroll) | BaseAdapter export; CSV/native API | Each behind `payroll-{provider}` flag; export only, NOT a payroll engine |
| IRS TIN-match / FIRE-IRIS (US-FORM) | gov-api framework (cert auth, retry, audit) | Model on `packages/gov-api`; IRIS primary, FIRE fallback (research-gated cutover) |
| Zapier / n8n / Make (Theme C) | Consume `/api/v1/*` + outbound webhooks | One backend, three listings; n8n node is an npm package `@contractor-ops/n8n-nodes` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| web-vite ↔ employee routes | Page→Container→Hook→Component; `useFlag` gate in container | New `components/workforce/` + `hooks/use-*`; obey `check:data-layer`/`page-shells` |
| portal ↔ employee portal | `portalAppRouter` (separate endpoint) + new `/employee/*` shells | Same magic-link/subdomain; do NOT merge into staff `appRouter` (keeps inference cost down) |
| apps/public-api (Hono) ↔ packages/api | `createPublicCaller` → tRPC `publicApiRouter` caller | Add write procedures to `routers/public-api/*`; Hono routes stay thin |
| domain mutation ↔ outbound webhook | `OutboxEvent` insert in same `$transaction` | Decouples dispatch from the request; at-least-once + DLQ already modelled |
| billing ↔ feature gates | `requireTier` (tier) + NEW `requireAddOn` (surface) + `requireFeatureFlag` (rollout) | Three orthogonal axes; compose tier→add-on→flag |

---

## Suggested Build Order (honours the locked dependency graph)

> Locked: themes A/B/C run **parallel**; `WORKER-01` is the **only** strict serialization point inside B; `INTEG-API-01` is the Theme C foundation. Order below is dependency-correct; concurrency is capped by solo-dev throughput, not the graph.

**Foundation (shared, do first — unblocks billing for A and B):**
0. `requireAddOn` middleware + add-on entitlement (`OrgAddOn`/`Subscription.addOns`) + Stripe add-on SKUs (`add-on.ts`, `billing.prisma`). Designed once; consumed by A and B. Declare all v7.0 flags in `flags-core.ts` + signoff registry; teach the `buildLazyBag` region coercion about `US`.

**Theme B (serial head, then fan-out):**
1. **WORKER-01** (gate): additive `workerType` migration on `Contractor` + `WorkerType` enum + index. Verify zero-downtime on a staging snapshot of the largest org.
2. WORKER-02..05 in parallel after 1: `workerRouter`/`employeeRouter` split (preserve `contractorRouter` shapes); new RBAC roles (`HR_ADMIN/HR_MANAGER/PAYROLL_OFFICER/LEAVE_APPROVER`) in `roles.ts`; `workforce-employees` flag gate.
3. Fan-out (parallel): EMP-REG per market → AKTA → LEAVE / TIME-EMP / EMP-ON/OFF → PAYROLL adapters + HRIS-SYNC + EMP-PORTAL + HR-DASH.

**Theme A (parallel to B; independent of Worker — uses existing Contractor):**
1. US-INFRA-01..03 (region + US R2 + retention) — unblocks data residency for forms.
2. US-FIELD + US-LOC (`en-US.json`) — profile + locale, parallel.
3. US-FORM (W-9/W-8 intake → TIN-match → 1099/1042-S → FIRE/IRIS) — gov-api framework.
4. US-PAY-01 (ACH NACHA generator) parallel with US-FORM; US-PAY-03/05 (Modern Treasury/Plaid) via adapter registry.
5. US-CLASS extends the v5 classification engine.

**Theme C (parallel to A and B; INTEG-API-01 is its own gate):**
1. **INTEG-API-01** (gate): extend `apps/public-api` with write endpoints + new resources; per-tier rate limits.
2. INTEG-AUTH (scope picker UI on existing `OrganizationApiKey.scopes`).
3. INTEG-WEBHOOK (NEW `WebhookSubscription` + outbound dispatcher on the EXISTING outbox) + INTEG-SEC (SSRF guard, OWASP review).
4. INTEG-ZAPIER / N8N / MAKE listings + INTEG-DX (OpenAPI-from-Zod, SDKs, dev portal) — after the API + webhook surface is stable.

---

## Open Gaps to flag for plan-phase

- **Per-key scope coverage is partial.** Today only the read endpoints in `routers/public-api/*` carry `requirePermission`. Theme C write endpoints must each declare scopes; confirm `permissionToScopes` covers the new `payments`/`workflows`/`webhooks:manage` scopes (extend the map in `packages/api/src/lib/scope-utils.ts`).
- **`DataRegion` Prisma enum is currently `{ EU, ME }`.** Adding `US` touches the enum, `region.ts`, `regional-storage.ts`, AND the flag evaluator's region coercion in `feature-flag.ts` (`buildLazyBag` only handles EU/ME — it warn-coerces unknown to EU). That coercion must learn `US` or US-jurisdiction flags silently degrade.
- **Add-on entitlement source.** Decide `Subscription.addOns String[]` vs a normalized `OrgAddOn` table before the billing phase; the latter is cleaner for audit + per-add-on period tracking.
- **IRIS vs FIRE cutover** and **Personio custom-attribute / rate-limit** remain research-gated per the backlog checklist — resolve before US-FORM-05 / HRIS-SYNC-01 plan-phase.

## Sources

- `.planning/PROJECT.md`, `.planning/milestones/v7.0-BACKLOG.md` (locked decisions + dependency graph) — HIGH
- `packages/db/src/{tenant.ts,region.ts}`, `packages/api/src/services/{payment-export.ts,regional-storage.ts}` — HIGH (read directly)
- `packages/api/src/middleware/{tier.ts,feature-flag.ts,rbac.ts,api-key-auth.ts}`, `root.ts`, `portal-root.ts` — HIGH
- `packages/integrations/src/{registry.ts,services/webhook-dispatcher.ts,services/qstash-client.ts}` — HIGH
- `packages/db/prisma/schema/{contractor.prisma,api-key.prisma,integration.prisma,billing.prisma,payment.prisma,outbox.prisma}` — HIGH
- `apps/public-api/src/{app.ts,routes/contractors.ts,lib/create-caller.ts}`, `packages/api/src/routers/public-api/*` — HIGH
- `apps/web-vite/ARCHITECTURE.md` (Page→Container→Hook→Component contract) — HIGH

---
*Architecture research for: v7.0 GTM Expansion integration into contractor-ops*
*Researched: 2026-06-07*
