# DB & Performance Audit

## Executive summary

Reviewed 27 Prisma schema files and ~55 tRPC routers across 7 domains. The codebase shows generally disciplined tenant scoping (via Prisma `$extends` injection) and decent baseline indexing — but contains **multiple production-blocking correctness defects**, several **N+1 hotspots that scale poorly**, and **per-request overhead** in the tenant middleware that will dominate latency under load. The most urgent issues are (a) an in-memory idempotency cache for payment-run creation that is process-local and therefore unsafe in the multi-instance Render deployment, (b) a `getOrCreatePreferences` helper that bypasses tenant scope and races, (c) per-request DB lookups for `dataRegion` on every authenticated tRPC call, and (d) several "load all rows then page in memory" report endpoints that will OOM on tenants with >10k contractors.

Severity counts: **CRITICAL: 4 · HIGH: 11 · MEDIUM: 9 · LOW: 4**

---

## Findings

### F-DB-01: In-memory `idempotencyCache` for payment-run creation
- **Severity:** CRITICAL
- **Location:** `packages/api/src/routers/finance/payment.ts:50-61, 348-520`
- **Problem:** `idempotencyCache` is a per-process `Map` (`const idempotencyCache = new Map<...>()`). Render runs ≥2 instances; an idempotency key seen by instance A is invisible to instance B. The `'PENDING'` sentinel + `delete-on-failure` logic is also lost on process restart.
- **Impact:** Duplicate payment runs created for the same `idempotencyKey` whenever the retry hits a different instance (the dominant case behind a load balancer). Real-money double-spend / duplicate bank exports.
- **Fix:** Replace the in-memory `Map` with a DB-backed unique constraint. Add `model PaymentRunIdempotency { id @id, organizationId, idempotencyKey, paymentRunIds Json, createdAt, expiresAt @@unique([organizationId, idempotencyKey]) @@index([expiresAt]) }`. On request: `tx.paymentRunIdempotency.create(...)` (catch P2002 → return cached `paymentRunIds`). Garbage-collect via cron on `expiresAt`.
- **Effort:** M

### F-DB-02: `getOrCreatePreferences` bypasses tenant scope and races
- **Severity:** CRITICAL
- **Location:** `packages/api/src/services/notification-service.ts:84-114` (callers in `packages/api/src/routers/core/notification.ts:138`)
- **Problem:** Uses raw `prisma` (no tenant scope, no soft-delete extension). The `findFirst` then `create` pattern races under concurrent `getPreferences` calls (called via `Promise.all` over `NOTIFICATION_TYPES` — guaranteed concurrency). The Prisma model has `@@unique([userId, notificationType])` *without* `organizationId`, so two orgs sharing a user collide on insert and existing rows leak across tenants.
- **Impact:** (a) Cross-tenant preference leak when the same user belongs to multiple orgs, (b) `P2002` flapping under preference-tab load, (c) potential for one org's email-off setting to suppress the other org's emails.
- **Fix:** Change schema to `@@unique([userId, organizationId, notificationType])` + new migration. Switch helper to a single `prisma.userNotificationPreference.upsert({ where: { userId_organizationId_notificationType: {...} }, create: {...}, update: {} })` and route via `getRegionalClient(region)` (not the EU singleton).
- **Effort:** M

### F-DB-03: Per-request `Organization.findUnique` on hot path
- **Severity:** CRITICAL
- **Location:** `packages/api/src/middleware/tenant.ts:31-36` (executed on every authenticated tRPC call); identical pattern in `packages/api/src/middleware/portal-auth.ts` and `packages/api/src/routers/portal/portal.ts:45-51, 850`.
- **Problem:** `runWithTenantContext` always issues `prisma.organization.findUnique({ where: { id: orgId }, select: { dataRegion: true } })` against the EU primary on every request to discover the data region. No memoisation. For ME-region tenants this is also a *cross-region* round-trip on every call before the actual query runs.
- **Impact:** Adds 1 RTT (often 80-200ms cross-region) to every tRPC call. At 50 RPS per pod this is 50 needless `Organization` reads per second per pod, hammering a tiny but very hot table.
- **Fix:** Cache `organizationId → dataRegion` in-process LRU (TTL 1h, capacity 10k) — region is rarely changed and is safe to cache for the duration of a request burst. Invalidate on `organization.update` of `dataRegion`. Optionally store the region in the Better Auth `Session.activeOrganizationId` flow so it is already on `ctx.session` and zero DB calls are required.
- **Effort:** S

### F-DB-04: `withRlsSession` exists but is never used — no DB-level defence-in-depth
- **Severity:** CRITICAL
- **Location:** `packages/db/src/rls.ts:14-20` (exported but no call sites in `packages/api` or `apps/web`).
- **Problem:** Tenant isolation is enforced **only** via the Prisma `$extends` query hook. Any code path using `prismaRaw` (cron services, `notification-service.ts`, `portal-magic-link.ts`, `audit-writer.ts`, `tax-rate.service.ts`, `slack-client.ts`, `consent-record.ts`, `import-processor.ts`, `wht-certificate.service.ts`, `late-payment-claim-pdf.ts`, …) silently issues unscoped queries. There is no Postgres RLS policy as a backstop.
- **Impact:** A single missed `where: { organizationId }` in any of ~30 service files is a cross-tenant data exposure. The audit found at least one such case (F-DB-02).
- **Fix:** Either (a) add Postgres RLS policies on every tenant-scoped table (`USING (organizationId = current_setting('app.org_id')::text)`) and call `withRlsSession` from `runWithTenantContext` inside an explicit `$transaction`, or (b) ban `import { prisma }` from `packages/api/src` via an ESLint rule and require all queries to flow through the tenant-scoped client. Given Phase 60's `prismaRaw` exception is intentional, (a) is the production-grade answer.
- **Effort:** L

### F-DB-05: `complianceGaps` / `complianceGapsChart` / `exportComplianceGaps` load every contractor + every compliance item into memory
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/core/report.ts:356-450` (paginated UI query), `:580-624` (chart), `:809-867` (CSV export)
- **Problem:** Loads `contractor.findMany()` with no `take`, includes the full `complianceItems` and `contracts` arrays per contractor, then sorts and paginates *in memory*. Pagination is a memory slice on the result set, not a DB `OFFSET/LIMIT`. The CSV export also has no row cap.
- **Impact:** O(N × avg_compliance_items_per_contractor) heap allocation per request. A tenant with 5,000 contractors × 12 compliance items = 60k rows loaded for a single dashboard tile, repeated per UI re-render. The CSV export at 50k+ contractors will OOM the pod.
- **Fix:** Replace the in-memory bucketing with a single SQL `GROUP BY` + `CASE` query (or `db.contractor.groupBy` with a computed health expression). For the paginated view, push the health predicate into SQL via `WHERE` against the existing `(organizationId, contractorId, status)` index on `ContractorComplianceItem`. Cap export at a documented limit (e.g. 10k) and stream via chunked queries if larger.
- **Effort:** M

### F-DB-06: `instantiateTaskRuns` does N sequential creates inside a transaction
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/workflow/workflow-execution.ts:212-293` (called by `startRun` at `:491-499`)
- **Problem:** For every template task (commonly 6-15, up to 30 for KT offboarding) the loop runs `await tx.workflowTaskRun.create(...)` serially inside the transaction. Each is a network round-trip to Neon. Locks held for the whole batch.
- **Impact:** Workflow start latency = `N × RTT` (≈ N × 5-15ms with the Neon HTTP adapter). Under contention for the same template, lock holding compounds. Onboarding a contractor can take 200ms+ just for task instantiation.
- **Fix:** Pre-resolve all assignees once (single `member.findMany` keyed by role), pre-compute due dates, then issue a single `tx.workflowTaskRun.createMany({ data: [...] })`. The dependency-remap pass can be done with a follow-up `updateMany` per dependency-target group, or by pre-computing IDs with `cuid()` from `@paralleldrive/cuid2` and referencing them in the same `createMany` payload.
- **Effort:** M

### F-DB-07: `bulkTransition` of contracts emits one audit row at a time
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/core/contract.ts:680-748` (loop at `:730-744`)
- **Problem:** After the bulk `contract.updateMany`, the transaction loops `for (const id of valid) await writeAuditLog(...)` — N sequential inserts inside the same transaction. Same pattern in workflow-templates duplicate (`packages/api/src/routers/workflow/workflow-templates.ts:300-335`) and equipment couriers.
- **Impact:** A bulk transition of 100 contracts holds Postgres row locks for ~100 RTT. Times out under Neon's serverless connection limits.
- **Fix:** Build the audit row payload once and use `tx.auditLog.createMany({ data: rows })`. For the workflow template duplicate, swap to `createMany` plus a single `updateMany` per dependency-target.
- **Effort:** S

### F-DB-08: Equipment courier mutations write 4N rows in a sequential loop inside a tx
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/equipment/equipment-couriers.ts:122-186` (InPost), `:308-349` (DPD), `:479-520` (UPS); same pattern in `packages/api/src/routers/equipment/equipment-returns.ts:103-172`.
- **Problem:** For each equipment item the transaction does `tx.shipment.create` → `tx.shipmentEvent.create` → `tx.shipmentEvent.create` (LABEL_GENERATED) → `tx.equipment.update`, all serially. With 10 items in the batch that's 40 sequential round-trips holding row locks while the pod waits.
- **Impact:** Shipment-create p99 climbs linearly with batch size; the courier API call already happened *before* the tx so the financial side-effect (label generated) is committed even if the long lock series fails.
- **Fix:** Hoist `Shipment` rows into a `createMany` followed by `findMany` to recover IDs (cuid pre-generation lets you skip the round-trip), then `shipmentEvent.createMany` for both event types and `equipment.updateMany({ where: { id: { in: ids } }, data: { status } })`. Move audit-log creation outside the tx.
- **Effort:** M

### F-DB-09: Unbounded list endpoints — `paymentRunItem.listByContractor`, `searchContractors`, `linkedIssues`
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/finance/payment.ts:1184-1203` (take 100 — fixed cap, no cursor); `packages/api/src/routers/finance/invoice.ts:1094-1121` (`take: 10` per call, but searches `OR contains` without trigram index — full scan); `packages/api/src/routers/integrations/jira.ts:267-321` (linked issues for a `WORKFLOW_RUN`: loads *every* task run for the run, then every external link; no pagination, no take).
- **Problem:** No cursor pagination on payments-by-contractor; no upper bound on links; the contractor search `ILIKE %query%` cannot use the (organizationId, legalName) btree index for a `contains` predicate, so it falls back to a sequential scan of the org's contractors.
- **Impact:** Long-tenured contractors with 1000+ payment items hit a 100-row hard wall (silent data loss in UI). Contractor search latency scales with org size on every keystroke.
- **Fix:** Add cursor pagination (`take + 1` pattern already used elsewhere) on `listByContractor`. For contractor search, route through the existing `Contractor.search_vector` tsvector that `core/search.ts` already uses (drop the `ILIKE` path entirely). For Jira `linkedIssues`, page the underlying `externalLink.findMany` and return a cursor.
- **Effort:** M

### F-DB-10: `auditLog.actors` returns `distinct` over the whole org without limit
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/core/audit.ts:100-113`
- **Problem:** `findMany({ where: { organizationId }, distinct: ['actorId'], select: {...} })` — Postgres `DISTINCT ON` with no `LIMIT` walks the entire org's audit log. There is no covering index on `(organizationId, actorId)`.
- **Impact:** With audit logs growing unbounded (no retention policy visible), the actor-filter dropdown becomes a multi-second query that scans millions of rows per render.
- **Fix:** Add `@@index([organizationId, actorId])` to `AuditLog`. Better: maintain a denormalised `AuditActor { organizationId, actorId, actorName, lastSeenAt }` upserted from the audit writer — distinct-actor query becomes a 100-row table scan.
- **Effort:** S

### F-DB-11: Audit log offset pagination on a write-heavy unbounded table
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/core/audit.ts:79-87` (`skip: (page - 1) * pageSize`); same pattern in `packages/api/src/routers/core/notification.ts:54-62`.
- **Problem:** `OFFSET` requires Postgres to read-and-discard `page * pageSize` rows. For audit logs (potentially millions per org) and notifications (per-user, can be tens of thousands), deep page navigation degrades quadratically.
- **Impact:** "Page 200 of 500" requests on audit log become full-index scans plus discard. Slow even with the existing `(organizationId, createdAt)` index.
- **Fix:** Switch to keyset/cursor pagination: `where: { organizationId, ...(cursor && { createdAt: { lt: cursorDate } }) }, orderBy: { createdAt: 'desc' }, take: pageSize`. Drop `totalCount` — it is also a full scan. If a count is needed for UI, return an estimated count via `pg_class.reltuples` or limit it (e.g., `count up to 10000`).
- **Effort:** M

### F-DB-12: Contractor list "compliance health filter" applied AFTER pagination — wrong totals
- **Severity:** HIGH
- **Location:** `packages/api/src/routers/core/contractor.ts:495-503`
- **Problem:** The endpoint paginates contractors at the DB level, computes `complianceHealth` per row in JS, then filters the page by health. Returned `total` is the *post-filter* page length, while DB-paginated rows are pre-filter. The user gets fewer rows than `pageSize`, and `total` is wildly wrong (may be 0 even though many matches exist on later pages).
- **Impact:** Contractor list with the compliance-health filter is functionally broken at scale — broken counts, missing rows, broken pagination.
- **Fix:** Push the compliance-health predicate into SQL using a `EXISTS` subquery on `ContractorComplianceItem`, or precompute and persist `complianceHealth` on `Contractor` (denormalised) updated by the same code path that mutates compliance items. The latter is also an indexable column.
- **Effort:** M

### F-DB-13: `IntegrationConnection` lacks a unique constraint for org-level + per-user connections
- **Severity:** HIGH
- **Location:** `packages/db/prisma/schema/integration.prisma:3-35`
- **Problem:** No `@@unique` on `(organizationId, provider, userId)` (or `(organizationId, provider)` when `userId IS NULL` for org-level connections). The router code does `findFirst({ where: { organizationId, provider, status: 'CONNECTED' } })` everywhere — relying on app code to keep at most one active. A reconnect flow that races can produce two `CONNECTED` rows for the same provider, and `findFirst` will silently pick whichever Postgres returns first.
- **Impact:** Webhooks, OAuth refresh, and sync jobs target the wrong connection ID nondeterministically. Hard to diagnose because both rows are valid.
- **Fix:** Add a partial unique index. Prisma 7 doesn't support partial uniques inline, so add via a migration: `CREATE UNIQUE INDEX integration_connection_org_provider_user_uniq ON "IntegrationConnection" (organizationId, provider, COALESCE(userId, '__org__'));`. Then refactor reconnect to `upsert` against this key.
- **Effort:** M

### F-DB-14: `SigningEnvelope.externalEnvelopeId` is `@@index` but not `@unique`
- **Severity:** HIGH
- **Location:** `packages/db/prisma/schema/esign.prisma:31`
- **Problem:** The webhook handler must look up envelopes by external ID. With no uniqueness guarantee, two `SigningEnvelope` rows with the same `externalEnvelopeId` are allowed (e.g. retry of a CREATE that succeeded server-side but failed locally).
- **Impact:** Webhook events processed against the wrong envelope on collision; no DB-level guard against duplicate-create races.
- **Fix:** Change to `@@unique([provider, externalEnvelopeId])` (provider is part of the natural key — DocuSign and Autenti use independent ID spaces). Migration: dedupe existing rows first.
- **Effort:** S

### F-DB-15: `Session.expiresAt` has no index; sweeps will tablescan
- **Severity:** MEDIUM
- **Location:** `packages/db/prisma/schema/auth.prisma:104-119`
- **Problem:** Better Auth's session sweep cron deletes by `expiresAt < now()`. Only `(userId)` is indexed. A live deployment will accumulate millions of expired sessions before the sweep is even scheduled.
- **Impact:** Cron sweeps full-scan the `Session` table; auth queries by `userId` still benefit from the existing index but the sweep blocks them.
- **Fix:** Add `@@index([expiresAt])` on `Session`. Same for `Verification` (no index at all on `expiresAt` or `identifier`).
- **Effort:** S

### F-DB-16: File-buffer generation inside a payment-export `$transaction`
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/finance/payment.ts:617-755` (specifically `_generateExportFileForFormat` at `:720-725` runs while the `$transaction` is open)
- **Problem:** SEPA / Elixir / Swift XML generation can be tens-to-hundreds of milliseconds CPU; runs synchronously inside the tx after a heavy `findFirst` with `include.items.{invoice, contractor, billingProfile}`. Row locks on the `PaymentRun` and all `PaymentRunItem` rows are held during file rendering.
- **Impact:** Concurrent calls to `lockAndExport` on different runs serialise behind each other due to the cross-run advisory lock pattern; mixed I/O and CPU inside a tx amplifies p99.
- **Fix:** Restructure as: (1) tx 1 — verify state + currency + atomic transition `DRAFT → LOCKED`; (2) generate file (no tx); (3) tx 2 — write `PaymentExport` row, advance to `EXPORTED`. Use the new `lockedAt`/`exportedAt` timestamps to enforce ordering.
- **Effort:** M

### F-DB-17: `EInvoiceLifecycle.invoiceId` declared `@unique` AND in `@@unique([organizationId, invoiceId])`
- **Severity:** MEDIUM
- **Location:** `packages/db/prisma/schema/einvoice.prisma:38, 64`
- **Problem:** Two unique indexes covering the same column. Postgres maintains both; writes pay double cost. Same shape on `SkontoTerm` (`invoiceId @unique` + relation index) at `packages/db/prisma/schema/financial.prisma:32-34`.
- **Impact:** Wasted storage and write amplification on a high-write path (every issued invoice creates a lifecycle row).
- **Fix:** Drop the field-level `@unique` and keep only the composite. Migration: `DROP INDEX EInvoiceLifecycle_invoiceId_key;` (similarly for SkontoTerm).
- **Effort:** S

### F-DB-18: Workflow `startRun` runs an extra `findUniqueOrThrow` to refetch the run with relations
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/workflow/workflow-execution.ts:512-518`
- **Problem:** Inside the transaction the code calls `tx.workflowTaskRun.findMany` to count progress, then `tx.workflowRun.update`, then `tx.workflowRun.findUniqueOrThrow` with `include` to return the full graph. Three reads where one suffices.
- **Impact:** Three extra round-trips per workflow start while holding the transaction.
- **Fix:** Use `tx.workflowRun.update({ where, data: { progressPercent }, include: { tasks, workflowTemplate } })` — Prisma returns the updated row with includes in a single call.
- **Effort:** S

### F-DB-19: `dashboard.fetchKpis` issues 8 parallel `count`/`aggregate` queries with no shared index
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/core/dashboard.ts:18-86`
- **Problem:** Eight independent aggregate queries on Contractor / ApprovalStep / Invoice / Contract / WorkflowTaskRun. Several are reading the same row sets twice with slightly different where clauses (current month vs previous month) — Postgres cannot merge these.
- **Impact:** 8 round-trips for a single KPI tile; Neon serverless cold-start amplifies. The cache mitigates this for repeat hits but the first hit per cache window is expensive.
- **Fix:** Collapse the four `Invoice` aggregates into one `$queryRaw` with `FILTER (WHERE ...)` clauses; same for `Contractor`. Cuts 8 round-trips to ~4. Also add `@@index([organizationId, status, createdAt])` to `ApprovalStep` (currently only `(organizationId)` and `(organizationId, approverUserId, status)` exist).
- **Effort:** M

### F-DB-20: Search router queries 3 tables in parallel but cannot dedupe across overlapping orgs
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/core/search.ts:60-87`
- **Problem:** Three `$queryRaw` against `Contractor`, `Contract`, `Invoice`. Each is parameterised correctly (no injection). However: (1) the `tsquery` is built by `Prisma.sql` and *interpolated* into the next `$queryRaw`'s template — the inner template prevents injection, but the column references rely on a `search_vector` column that is documented to exist only via raw migration. There is no comment or migration check that prevents a schema drift where the column gets dropped — at which point search silently returns empty across all tenants. (2) The query touches three indexes (one per table) but does not share a connection — three separate round-trips even with `Promise.all`.
- **Impact:** Brittle dependency on a Prisma-invisible column; no degradation alarm. 3 round-trips per command-palette keystroke.
- **Fix:** Add a CI check (psql `\d "Contractor"` greps for `search_vector`) and document the migration as required-on-deploy. Consider denormalising into a single `SearchIndex { organizationId, entityType, entityId, name, subtitle, search_vector }` materialized view refreshed on writes — one round-trip per query, easier to reason about.
- **Effort:** L

### F-DB-21: `ClassificationDashboard` queries are not org-scoped at the call site
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/compliance/classification-dashboard.ts:195-232, 354-365, 394-400, 452-491`
- **Problem:** Queries like `db.contractorAssignment.findMany({ where: { status: 'ACTIVE', contractor: { countryCode: market } } })` rely entirely on the `withTenantScope` extension to inject `organizationId`. The extension is silent — if a future refactor uses `prismaRaw` here (the file's docstring even mentions it doesn't import `prismaRaw`, suggesting confusion), every org's data leaks. There is no defensive `organizationId: ctx.organizationId` in the where.
- **Impact:** One typo / refactor away from a cross-tenant data exposure on a sensitive compliance view (IR35 verdicts, DRV statuses). No DB-level RLS to catch it (F-DB-04).
- **Fix:** Add explicit `organizationId: ctx.organizationId` to every `where` even though the extension would inject it (defence-in-depth). Add an integration test that runs a procedure with no tenant frame and asserts it throws.
- **Effort:** S

### F-DB-22: `loadIntakeScoped` / intake `findUnique` post-checks org membership instead of pre-filtering
- **Severity:** MEDIUM
- **Location:** `packages/api/src/routers/finance/invoice-intake.ts:188-207, 293-306, 312-342`
- **Problem:** `findUnique({ where: { id }, ... })` then `if (row.organizationId !== ctx.organizationId) return null` — relies on the extension to inject `organizationId` AND on the post-check. With Prisma 7, `findUnique` only accepts `@unique` keys; the extension cannot meaningfully add `organizationId` to a `findUnique` where without breaking it. So this works only because `id` is globally unique (cuid) — in that case the post-check is the only protection.
- **Impact:** Returns NOT_FOUND correctly today, but the pattern is fragile and inconsistent with the rest of the codebase. A timing oracle exists: cross-org `findUnique` returns slightly slower than non-existent IDs.
- **Fix:** Use `findFirst({ where: { id, organizationId } })` consistently — no post-check needed, no oracle.
- **Effort:** S

### F-DB-23: `OutboxEvent` has no covering index for the consumer's polling query
- **Severity:** MEDIUM
- **Location:** `packages/db/prisma/schema/audit.prisma:29-45`
- **Problem:** Consumer polls `WHERE organizationId = ? AND status = 'PENDING' AND availableAt <= now()`. The existing `@@index([organizationId, status, availableAt])` is fine for the per-org case but a *cross-org* outbox publisher (likely how this is dispatched) cannot use it. No `@@index([status, availableAt])` exists.
- **Impact:** Cross-tenant outbox publisher does a sequential scan filtered by status/time on every poll cycle.
- **Fix:** Add `@@index([status, availableAt])` for the cross-org publisher path, OR document that publishing is strictly per-org and route through the per-org index.
- **Effort:** S

### F-DB-24: `getCourierConfigs` and similar admin endpoints emit no cursor / pagination on `findMany`
- **Severity:** LOW
- **Location:** `packages/api/src/routers/equipment/equipment-couriers.ts:612-618`; analogous unbounded `findMany` at `packages/api/src/routers/integrations/jira.ts:295-301` (taskRuns by run), `packages/api/src/routers/portal/portal.ts:653-657` (contracts by contractor).
- **Problem:** "Small N" assumption — fine while `N < 100`, painful when a tenant has 50k contracts.
- **Impact:** Latency spikes at the long tail. Memory pressure when the result set grows.
- **Fix:** Add `take: 200` upper bound + log a warning when the cap is hit. Or convert to cursor pagination for endpoints exposed to large data sets.
- **Effort:** S

### F-DB-25: `documentLink.findMany` in portal `listDocuments` — two queries that could be one
- **Severity:** LOW
- **Location:** `packages/api/src/routers/portal/portal.ts:642-679`
- **Problem:** Issues `documentLink.findMany({ where: { entityType: 'CONTRACTOR', entityId: ctx.contractorId } })`, then a separate `contract.findMany({ where: { contractorId } })` to get IDs, then `documentLink.findMany({ where: { entityType: 'CONTRACT', entityId: { in: contractIds } } })`. Three round-trips to compose what is logically one query.
- **Impact:** 3 RTT per portal documents page load.
- **Fix:** Single query: `documentLink.findMany({ where: { OR: [{ entityType: 'CONTRACTOR', entityId: ctx.contractorId }, { entityType: 'CONTRACT', entity: { contractorId: ctx.contractorId } }] } })` — or denormalise contractorId onto DocumentLink (small JSONB or a nullable column) for O(1) lookup.
- **Effort:** S

### F-DB-26: `processPeopleImport` and `bulkImport` invite users serially
- **Severity:** LOW
- **Location:** `packages/api/src/routers/integrations/google-workspace.ts:284-316` and `packages/api/src/routers/core/onboarding-import.ts:240-256`
- **Problem:** `for (const user of input.users) { await authApi.createInvitation(...) }` — sequential. Onboarding 50 users = 50 sequential Better Auth + email-send round-trips.
- **Impact:** Bulk-import tab spins for tens of seconds with no progress shown.
- **Fix:** `Promise.allSettled(users.map(u => authApi.createInvitation(...)))` with a concurrency limiter (`p-limit(5)`) to avoid blowing through Resend rate limits. Or move the entire import to a background job (QStash) and stream progress over a polling endpoint — already partially set up via `ImportJob` shape.
- **Effort:** S

### F-DB-27: Soft-delete extension does NOT run on `update`/`updateMany` writes — orphans soft-deleted rows
- **Severity:** LOW
- **Location:** `packages/db/src/soft-delete.ts:24` — `softDeleteModels = ['Organization', 'Contractor', 'Contract', 'Invoice', 'Document']`; the extension only intercepts `delete`, `deleteMany`, `findMany`, `findFirst`, `findFirstOrThrow`, `count`.
- **Problem:** `update`/`updateMany` are NOT filtered. So `ctx.db.invoice.update({ where: { id }, data: {...} })` will happily update a soft-deleted invoice. Several routers do exactly this: `voidInvoice` (`packages/api/src/routers/finance/invoice.ts:976-993`) does include `deletedAt: null` manually, but most update sites do not (e.g., `dismissDuplicate` at `:1080-1086`, `toggleReverseCharge` at `:1163-1173`).
- **Impact:** Soft-deleted rows can mutate. Audit trail then says a "deleted" entity changed status. Hard to debug.
- **Fix:** Extend the soft-delete extension to inject `deletedAt: null` into `update` / `updateMany` / `upsert` where clauses too, mirroring the existing pattern.
- **Effort:** S

### F-DB-28: `Invoice` index on `(organizationId, sellerTaxId)` exists but not `(organizationId, dueDate, paymentStatus)`
- **Severity:** LOW
- **Location:** `packages/db/prisma/schema/invoice.prisma:71-82`; query at `packages/api/src/routers/core/dashboard.ts:168-178` (`dueDate ∈ [now, +30d] AND paymentStatus NOT IN [PAID]`).
- **Problem:** The query filters `(organizationId, paymentStatus, dueDate)` but the closest index is `(organizationId, dueDate)` — Postgres has to bitmap-and with `(organizationId, paymentStatus)`.
- **Impact:** Suboptimal but functional today. Becomes a problem at >1M invoices per org.
- **Fix:** Add `@@index([organizationId, paymentStatus, dueDate])` covering the dashboard deadlines query and the `readyForPayment` cursor list.
- **Effort:** S

---

## Closing notes (not numbered findings)

- The Prisma client extension architecture is solid; the gap is **enforcement** — there's no lint rule preventing `import { prisma }` from leaking into `packages/api/src` business code, and no Postgres RLS as a backstop. F-DB-04 plus an ESLint `no-restricted-imports` rule would close this.
- `BoEBaseRateHistory` correctly modelled as global reference data (good).
- `prisma-client` (modern) generator is in use as documented; nothing in the audit blocks the choice.
- Connection pooling: relies on Neon's pgbouncer via the `@prisma/adapter-neon` driver. Regional clients are correctly cached on `globalThis`. No per-request client instantiation found. (Good.)
- `$queryRaw` usages in `search.ts` and `report.ts` are correctly parameterised via `Prisma.sql` / template-literal interpolation. No injection vectors found.
