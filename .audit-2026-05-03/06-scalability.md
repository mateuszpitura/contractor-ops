# Scalability & Traffic Handling Audit

Date: 2026-05-03
Scope: Production-readiness scalability & traffic handling for contractor-ops
Stack: Next.js 15 (apps/web), Hono public-api, 55 tRPC v11 routers, Neon Postgres
multi-region (EU/ME), Upstash Redis (rate limit + cache), Upstash QStash (queue),
Render deploy (frankfurt; web 2-8 instances, public-api 2-6, single worker).

---

## Executive summary

The platform has solid baseline scaffolding (Upstash sliding-window rate
limits with sensible failover, `cached()` helper with singleflight, cursor
pagination on most list procedures, signed-URL R2 uploads, QStash for OCR /
PDF / webhook processing), and would survive a few hundred concurrent users
on the happy path. However, several specific endpoints will fall over well
before that threshold under realistic load:

- **Five report-export mutations are completely unbounded** — a single user
  on a populated org can pull every paid invoice / every overdue invoice /
  every active contractor compliance row into the request handler memory
  with no `take` clause and no streaming. The audit-log export's documented
  10 000-row cap is the exception, not the rule.
- **PDF generation runs synchronously inside tRPC mutations** for SDS, DRV
  defense bundle, and GDPR privacy notice. `@react-pdf/renderer` uses
  ~30-150 MB per render; on a Render `standard` instance shared with the
  Node hot path, a small burst (10-20 concurrent requests) easily OOMs the
  pod. Only the late-payment-claim path is correctly async via QStash.
- **The dashboard layout is uncached** and re-runs four serial Prisma
  queries (session lookup is cached by Better Auth, but org / member /
  consent / flag-bag are not), then renders 6-8 client widgets that each
  fire their own tRPC query in parallel. Every dashboard navigation = ~12
  DB roundtrips even with only one user.
- **Notification dispatch is sequential per recipient** with no
  Promise.all, no batching of preference / dedup queries, and no
  concurrency limiter on downstream fan-out (Slack/Teams/email). A single
  reminder rule that targets a 100-person finance team will issue
  300+ serial DB calls.
- **Rate-limit middleware fails open on Redis errors** (web middleware,
  upload middleware, classification autosave middleware, public-api). When
  Upstash has an outage the entire fleet effectively has no rate limit.
- **No read-replica routing** — every query, including reporting
  aggregations and dashboard KPIs, hits the writer. Neon supports replicas
  natively; the codebase has zero affordance for it.
- The Neon adapter (`PrismaNeon` over the serverless driver) is per-request
  HTTP, so the connection-limit blast radius is bounded, but there is **no
  pgbouncer-style coordinator and no per-instance connection cap** —
  `prisma.$transaction` calls inside the data-purge cron and inside several
  mutations can hold connections through external IO (R2, govt APIs)
  without any guard.

Risk-prioritised — the items below should ship before any meaningful
marketing push or onboarding of an enterprise customer with >2 000
contractors per org. Most are 1-2 day fixes; the read-replica work is
larger.

---

## Findings (F-SCALE-NN)

### F-SCALE-01 [HIGH] Five report-export mutations are unbounded

`packages/api/src/routers/core/report.ts`:

- `exportSpendByContractor` (lines 633-681) — no `LIMIT` on the raw SQL
  `SELECT … GROUP BY contractor` over `Invoice`.
- `exportSpendByTeam` (lines 686-729) — no `LIMIT`.
- `exportExpiringContracts` (lines 734-769) — `findMany` with no `take`.
- `exportOverdueInvoices` (lines 774-804) — `findMany` with no `take`,
  every overdue invoice in org history is loaded into memory then turned
  into a CSV string.
- `exportComplianceGaps` (lines 809-866) — pulls every active contractor
  with all `complianceItems` and `contracts` joined.

For an org with 5 000 contractors and 50 000 invoices over a five-year
window, `exportOverdueInvoices` materialises ~10 000-50 000 invoice rows
plus contractor join, base64-encodes the CSV, and ships it back through
tRPC's JSON response. Memory: ~200-500 MB transient per export. The
audit-log path (`packages/api/src/routers/core/audit.ts` line 155) caps at
`take: 10000` precisely to avoid this; the report exports never got the
same treatment.

Fix: add `take: 50000` (matching audit's policy), gate behind
`requireTier('ENTERPRISE')` for very-large exports, and queue exports
>10 000 rows through QStash to a background renderer that uploads the CSV
to R2 and returns a signed download URL — same pattern already used for
late-payment-claim PDFs.

---

### F-SCALE-02 [HIGH] Synchronous PDF generation blocks the request path

`@react-pdf/renderer` is invoked inside tRPC mutations:

- `packages/api/src/routers/core/legal.tsx:50` — `generatePrivacyNoticePdf`
- `packages/api/src/routers/compliance/classification-document.tsx:169`
  — `generateSds`
- `packages/api/src/routers/compliance/classification-document.tsx:335`
  — `generateDrvDefenseBundle` (which also loads all prior assessments
  and same-tenant cross-references first; lines 290-328)

`renderToBuffer()` from `@react-pdf/renderer` typically allocates 30-150
MB per render and is CPU-bound for ~500-3000 ms. On Render `standard`
(2 GB RAM), a burst of 10-20 concurrent SDS generations will OOM the pod
because Next.js does not isolate per-request memory and the Node V8 heap
grows monotonically until GC. The late-payment-claim renderer
(`apps/web/src/app/api/late-interest/_render-claim-pdf/route.ts`) is
already correctly QStash-driven — apply the same pattern to the three
above. Render to R2, return `pdfStatus: PENDING_RENDER`, client polls.

---

### F-SCALE-03 [HIGH] Rate limiters fail open on Redis errors

`apps/web/src/middleware.ts:88` — on Upstash error returns
`{ allowed: true }` to "avoid blocking all requests". Same pattern in
`packages/api/src/middleware/upload-rate-limit.ts:96` (falls back to
in-memory, but this is per-instance and ineffective on a fleet of 8 Render
pods), `packages/api/src/middleware/classification-rate-limit.ts:115`, and
`apps/public-api/src/lib/rate-limiter.ts:111`.

When Upstash has an incident (it does, occasionally — multi-tenant SaaS),
**every IP/user/key bypasses every rate limit globally**. An attacker who
can detect a Redis outage (e.g. via timing) gets a free 0-cost DoS window.
The auth route (login, register, password reset) is the highest-value
target because Better Auth itself does not enforce any rate limit —
`packages/auth/src/config.ts` has no `rateLimit` block.

Fix: fail-closed for the auth-route limiter (return 503 with Retry-After
when Redis is down — login can tolerate a few seconds of unavailability
better than a credential-stuffing wave). Keep fail-open for read API
limits if you must, but log every fail-open at WARN with a sampling rate
so you can detect prolonged outages.

---

### F-SCALE-04 [HIGH] Dashboard layout is uncached and SSR-blocking

`apps/web/src/app/[locale]/(dashboard)/layout.tsx` runs on every
dashboard navigation:
- `auth.api.getSession({ headers })` — Better Auth session lookup (1 DB
  query)
- `prisma.member.findFirst` to auto-activate first org if none active
- `auth.api.setActiveOrganization` (write!)
- `prisma.organization.findUnique` + `prisma.member.findFirst` (parallel)
- `buildFlagBag` (Unleash SDK round-trip — usually cached by SDK, but
  hits the network on cold start)
- `prisma.consentEvent.findFirst` for ToS check (line 119)

Total: 4-5 DB queries per dashboard navigation, with no `unstable_cache`
or `revalidate` wrapper. After this layout completes, the `(dashboard)/
page.tsx` mounts and **6-8 client widgets each issue their own tRPC
query**: `dashboard.kpis`, `dashboard.spendTrend`, `dashboard.deadlines`,
`dashboard.activity`, plus approval queue, einvoice compliance, tax
obligations, onboarding-checklist (`settings.get` + `consent.hasRequired
Consents`). The `cached()` wrapper around `dashboard.kpis` (TTL 5 min)
helps, but the layout's per-navigation work does not benefit.

Fix: wrap the org/member/consent lookups in `unstable_cache` keyed by
`session.userId + activeOrgId` with a 60 s tag-invalidation; bundle the
client-widget queries into a single `dashboard.bootstrap` procedure
returning everything in one HTTP roundtrip; React Query then hydrates
each widget from the same cache entry.

---

### F-SCALE-05 [HIGH] Notification dispatch is sequential per recipient

`packages/api/src/services/notification-service.ts:191`:

```ts
for (const userId of event.recipientUserIds) {
  await dispatchToUser(userId, event, now, dedupCutoff);
}
```

Each `dispatchToUser` issues: `getOrCreatePreferences` (read+write),
`prisma.notification.findFirst` (dedup), `prisma.notification.create`
(in-app), `sendNotificationEmail`, then `dispatchToMessagingProviders`
(Slack/Teams). For a `ROLE: FINANCE_ADMIN` reminder targeting a 100-person
finance team, that is ~300+ serial DB roundtrips plus 100 sequential
HTTP calls to Slack/email — a single rule evaluation can take 30-60 s and
will time out the cron handler at the Render-default 600 s ceiling once
two or three orgs hit the same minute.

Fix: batch `getOrCreatePreferences` and dedup checks (`findMany` with
`userId: { in: recipientIds }`), `createMany` for in-app rows, and use
`Promise.allSettled` with a `p-limit`-style concurrency cap (5-10) for
external sends. The cron's three concurrent top-level branches
(`evaluateReminderRules`, `detectOverdueTasks`, `detectDrvClearance
Expiries`) all share this cost.

---

### F-SCALE-06 [MED] No read-replica routing; reports + dashboards pin to writer

`packages/db/src/region.ts` builds one client per region (`EU`, `ME`)
keyed off `DATABASE_URL_EU` / `DATABASE_URL_ME`. There is no
`createPrismaClientForUrl(REPLICA_URL)`, no `$extends({ replica })`, and
`tenantProcedure`'s `runWithTenantContext`
(`packages/api/src/middleware/tenant.ts:37`) always returns the writer.

Heavy read-only endpoints all hit the writer:
- `report.spendByContractor`, `report.spendByTeam`,
  `report.spendByContractorChart`, `report.spendByTeamChart`,
  `report.complianceGapsChart` (raw SQL aggregations over `Invoice`)
- `dashboard.kpis` (8 parallel `count`/`aggregate` calls per request)
- `search.global` (3 parallel tsvector queries)
- `audit.list` and `audit.export`

Neon supports per-region read replicas with a separate connection string.
At 200+ concurrent dashboard users the writer's CPU will spike and slow
down writes. Add a `DATABASE_URL_EU_RO`, route `query` procedures through
a replica-aware client (Prisma 7 supports this via `$extends`); fall back
to the writer on replica error.

---

### F-SCALE-07 [MED] No connection pooling guard; long-held tx on external IO

`packages/db/src/client.ts` uses `PrismaNeon` (the serverless HTTP
driver), which is per-request and avoids long-lived connections — good.
But two patterns still risk holding a Neon connection through a slow
external call:

1. **`apps/web/src/app/api/cron/data-purge/route.ts:129`** — opens a
   `prisma.$transaction(async tx => {...})` *after* an R2-deletion loop
   completes (good), but the tx itself runs five sequential `deleteMany`
   calls. With Neon's per-statement HTTP latency (~50-100 ms over the
   serverless driver), one purge tx can hold a connection for 1-3 s.
2. **Webhook handler in `apps/web/src/app/api/webhooks/[provider]/
   route.ts:88-95`** — does `prisma.organization.findUnique` after
   parsing payload but *before* the `WebhookDelivery.create`. Resend
   webhooks fire at high frequency; a slow Neon round-trip stacks
   in-flight requests.

Fix: explicit `connection_limit` in DATABASE_URL (e.g. `?connection_limit=10`)
plus `pool_timeout=5` so excess concurrent requests fail fast rather than
queueing. Move R2 work + adapter dispatch *outside* any open Prisma
transaction. Consider a dedicated webhook-ingest pgbouncer URL.

---

### F-SCALE-08 [MED] CSV exports buffer entire result in memory before base64

`packages/api/src/lib/csv.ts`'s `encodeCsvUtf8Bom` (and the report-export
service) builds the CSV string in memory (`lines.join('\r\n')`), then the
mutation returns it as base64 in the JSON response. Combined with
F-SCALE-01, this is a per-request 2-3× memory amplifier:

- 10 000 invoice rows × ~250 bytes/row = ~2.5 MB CSV
- → 2.5 MB string in V8 heap
- → 3.4 MB base64 string
- → wrapped in a JSON response that React Query holds for the cache
  lifetime (until tab close)

For an honest export-it-all flow, stream the CSV: switch to a Node
Readable, pipe through `csv-stringify`, write straight to R2 via
multipart upload, return the signed URL. Same pattern as PDFs in
F-SCALE-02. The `audit.export` handler returns base64 in the JSON
response too (line 161-165) — same fix applies.

---

### F-SCALE-09 [MED] Search + dashboard cache key includes orgId but not user role

`packages/api/src/services/cache.ts:175` defines `dashboardKpis(orgId)`,
`dashboardSpend(orgId, months)`, etc. Keys are org-scoped — correct for
multi-tenant safety. But:

- The cache has **no per-user role variant**. `dashboard.spendTrend` is
  gated by `report:read` permission; if user A (CFO, has access) populates
  the cache, then user B (project lead, no access) hits the same query —
  the `requirePermission` check still runs *outside* the cache hit path,
  so it's correct, but the cache only stores the full payload. Verify by
  reading `dashboard.ts:286-298`: yes, the permission middleware runs
  before `cached()`. OK, not a bug — but worth a comment in the cache
  service stating this invariant ("never cache permission-gated subsets").
- **Cache stampede protection only covers in-process singleflight**
  (`inflight = new Map`). With 2-8 web pods, a popular dashboard's
  `kpis` cache miss after TTL expiry triggers 2-8 simultaneous DB
  computations. For a 5-min TTL on KPIs that's tolerable; for the
  10-min `DASHBOARD_SPEND` over 12 months it is not. Use Redis SETNX
  with a short lock to add cross-instance singleflight, or stagger TTLs
  per-pod.

---

### F-SCALE-10 [MED] Webhook ingest `findUnique` lookups before persist

`apps/web/src/app/api/webhooks/[provider]/route.ts:78-95`:

For Slack webhooks, every event triggers a `prisma.integrationConnection
.findFirst` via `resolveSlackConnectionByTeamId`. For Resend, every event
triggers `prisma.organization.findUnique({ where: { slug } })`. There is
no in-memory cache of `teamId → orgId` or `slug → orgId`; Slack workspaces
fire dozens of events per minute at scale, and each one round-trips Neon
before queueing.

Fix: cache `teamId → orgId` and `slug → orgId` in Upstash Redis with a
30-min TTL, invalidated on connection upsert / org slug change. Webhook
ingest is the hottest path on the public surface — a 50 ms Neon round-trip
per request becomes the throughput bottleneck.

---

### F-SCALE-11 [MED] dashboardKpis runs 8 aggregations on every cache miss

`packages/api/src/routers/core/dashboard.ts:24-85` — `Promise.all` of 8
`count`/`aggregate` queries, all unindexed at the route level (the indexes
themselves may exist, but the query planner runs eight separate scans).
For an org with 50 000 invoices and 5 000 contractors, this can take
800 ms-3 s on a cold cache. Two or three users hitting an expired cache
window simultaneously causes the writer CPU to spike (compounds with
F-SCALE-09's lack of cross-instance singleflight).

Fix: collapse the 8 queries into 2-3 SQL queries using `FILTER (WHERE…)`
aggregates over a single scan; pre-warm the cache from the cron
(`/api/cron/dashboard-warm` triggered every 4 min). Index check: confirm
indexes on `(organizationId, status, deletedAt)` for Contractor;
`(organizationId, status, createdAt)` for ApprovalStep;
`(organizationId, paymentStatus, deletedAt, readyForPaymentAt)` for
Invoice; `(organizationId, status, endDate, deletedAt)` for Contract;
`(organizationId, status)` for WorkflowTaskRun.

---

### F-SCALE-12 [MED] Dashboard widgets fan out into N parallel HTTP requests

`apps/web/src/app/[locale]/(dashboard)/page.tsx` mounts 7+ client
components (`KpiCards`, `SpendChart`, `DeadlinesWidget`, `ApprovalQueue
Widget`, `ActivityFeed`, `EInvoiceComplianceWidget`, `TaxObligationsWidget`,
`OnboardingChecklist`), each owning its own `useQuery(trpc.X.queryOptions
())`. With tRPC v11's HTTP batching enabled (it is, via the link config —
verify in `apps/web/src/trpc/init.ts`), this collapses to one POST, but
the *server* still runs 7-8 parallel procedures, each with its own
`tenantProcedure` middleware chain (auth → tenant → permission → handler)
and Sentry span. On a slow network the user sees 7-8 staggered skeleton
frames.

The Spend chart is permission-gated (`hasReportAccess`), so it short-
circuits client-side, but the others always run.

Fix: a single `dashboard.bootstrap` procedure server-side (parallel
internally, single ctx setup) returning everything; client widgets
hydrate from `useSuspenseQuery(trpc.dashboard.bootstrap)` and select
sub-fields. Halves the per-page round-trip cost.

---

### F-SCALE-13 [MED] `dashboard.activity` and audit.actors have no pagination

- `packages/api/src/routers/core/dashboard.ts:241` — `auditLog.findMany`
  with `take: 20`, fine, but the query is keyed off
  `dashboardActivity(orgId)` cache so all users in the org share the same
  feed (correct).
- `packages/api/src/routers/core/audit.ts:101-113` — `audit.actors` does
  `findMany` with `distinct: ['actorId']` and **no `take`**. For an org
  with thousands of users / API actors over many years, this scans the
  full audit log. The combo of `distinct` + no `take` is the worst
  pattern — Postgres can't use the index efficiently for distinct-without-
  limit and effectively does a sort.

Fix: add `take: 500` and document that the actor filter dropdown only
shows recent actors, with a search-by-name field for deeper lookups.

---

### F-SCALE-14 [MED] `register-all` adapters run at every cold start of every API route

Several App Router files call `registerAllAdapters()` at module top
level:
- `apps/web/src/app/api/webhooks/[provider]/route.ts:17`
- `apps/web/src/app/api/oauth/[provider]/callback/route.ts:16`
- `apps/web/src/app/api/ocr/_process/route.ts:13`
- `apps/web/src/app/api/google-workspace/_sync/route.ts:15`

`register-all.ts` instantiates 16+ adapter classes; each constructor does
env-var validation and may `import` heavy SDKs (`docusign-esign`,
`@google-cloud/local-auth`). On Next.js serverless cold start (Render
spin-up, instance scale-up, deploy), every API route with this top-level
import pays the cost — adds 100-500 ms to first-request latency for
auth, webhook, and OAuth routes.

Fix: move adapter registration to `apps/web/src/instrumentation.ts` (Next
15's official one-time-startup hook). The `if (registered) return` guard
already makes it idempotent.

---

### F-SCALE-15 [LOW] In-memory rate-limit fallback Maps grow during Redis outage

`apps/web/src/middleware.ts:42` — `fallbackMap` capped at 10 000 entries
with insertion-ordered eviction. `apps/public-api/src/lib/rate-limiter.ts:39`
— `windows` capped at 50 000 with periodic interval cleanup.
`packages/api/src/middleware/upload-rate-limit.ts:51` — capped at 10 000.
`packages/api/src/middleware/classification-rate-limit.ts:71` — capped at
10 000 with a 5-min `setInterval` cleanup that **persists across module
reloads in long-lived Node processes** (`unref()` is set, so it doesn't
keep the process alive, but multiple HMR reloads or worker restarts can
leak intervals — fine in production with no HMR, but a footgun in
development).

The bigger concern: during a Redis outage these maps fill up immediately
on a moderately-trafficked instance (the 10 000-entry cap is reached
within minutes by a 5 000-contractor org with 100 active users). Eviction
is FIFO, not LRU, so legitimate users are evicted while attackers (with
lower request counts but still in the map) survive.

Fix: track `lastSeenMs` per entry and evict by `lastSeenMs ASC` instead
of insertion order. Or simpler: if Redis is down, switch from in-memory
counters to a fixed allow-list (admin IPs) + global throttle and log
loudly.

---

### F-SCALE-16 [LOW] tRPC observability metrics have unbounded `procedure` cardinality

`packages/api/src/middleware/observability.ts:82-89` — `metrics.distribution`
and `metrics.increment` with `tags: { procedure: path }`. There are 55
routers with ~600 procedures total; that's a lot of timeseries but
bounded. However, Sentry span attributes (line 19-25 of
`packages/logger/src/metrics.ts`) prefix the metric name with each tag
value (`metric.${name}.${k}` = `value`) — for any user-supplied input
that flows into a span attribute (none currently, but watch for it), this
explodes cardinality and breaks Sentry billing.

Currently safe (only `procedure` and `type` go in), but add a lint rule
or runtime assertion: `tags` keys must be a fixed allow-list. Also, the
`durationMs` log on every procedure call (`log.info({durationMs}, 'procedure
completed')`) is high-volume — at 200 RPS this is ~17M log entries/day to
Axiom. Consider sampling info-level procedure logs at 10% in production.

---

### F-SCALE-17 [LOW] No request-size limit on tRPC `[trpc]/route.ts`

`apps/web/src/app/api/trpc/[trpc]/route.ts` is a thin `fetchRequestHandler`
wrapper. There's no explicit `bodyParser` size limit (Next.js default is
1 MB for app router). Some procedures accept large base64 payloads:

- `core/import.ts:178` — `MAX_BASE64_SIZE = 13_333_334` (≈10 MB binary)
- `finance/invoice-intake.ts:62` — `fileBase64: z.string().min(1).max
  (7_000_000)` (≈5 MB binary)

If someone bumps these limits upward or a client misuses them, the entire
JSON body must be loaded into V8 heap before Zod parses it. For 10-20
concurrent users uploading 10 MB documents, that's 100-200 MB allocation
spike; on `standard` (2 GB) instances with overhead this is a noticeable
GC pressure source.

Fix: keep upload payloads off tRPC entirely. The `request_upload` mutation
should return a presigned R2 PUT URL; client uploads direct to R2. The
codebase already does this for some flows (`putObjectAndSignDownload`),
but `invoice-intake` still accepts inline base64. Migrate all upload
mutations to presigned URLs; drop the base64 schemas.

---

### F-SCALE-18 [LOW] Multi-region setup deploys both regions to Frankfurt

`render.yaml:431-449` — `unleash-me` is in `frankfurt` region (Render has
no ME region). `DATABASE_URL_ME` is a separate Neon DB but the *web pod*
serving ME tenants also runs in Frankfurt. There is no second `web`
service in a closer region (the comment on line 23 acknowledges this).

For ME tenants with strict data-residency requirements (PDPL §17 in
Saudi, UAE Federal Decree-Law No. 45 of 2021), the *processing* still
happens in EU which the local-only legal posture (per project memory)
defers. Acknowledge in the post-deploy checklist; not a today-blocker for
launch but a market-expansion blocker. From a pure latency perspective,
ME-tenant requests pay ~80-150 ms extra per Neon round-trip beyond
EU-tenant baseline, which compounds across the 8 KPI queries and 7
dashboard widgets.

---

### F-SCALE-19 [LOW] QStash queue depth has no backpressure

QStash itself is managed and effectively unbounded, but the codebase
fires-and-forgets `qstash.publishJSON` from many places (`webhooks
/[provider]/route.ts:124`, OCR retrigger, late-payment-claim render).
There is no:
- Per-org QStash rate limit (a misbehaving integration spamming webhooks
  could enqueue 10 000 jobs).
- Worker-side concurrency limit on the receiving routes (`/api/webhooks
  /_process`, `/api/ocr/_process`, etc.). Each Render web instance has
  no upper bound on simultaneous QStash callbacks; if QStash decides to
  retry 1 000 jobs after a transient outage, all 1 000 hit the fleet at
  once, causing thread-pool exhaustion → tRPC requests stall → cascading
  timeout.

Fix: configure QStash dispatch concurrency per topic
(`headers: { 'Upstash-Concurrency': '10' }` is supported), and add a
per-route Redis semaphore for the `_process` handlers to cap parallel
ingestion (e.g. 20 in-flight per pod).

---

### F-SCALE-20 [LOW] Better Auth has no rate-limit configuration

`packages/auth/src/config.ts` (and other auth files) contain no
`rateLimit: { enabled: true, ... }` block. Better Auth's built-in limiter
is therefore **off**. The only protection on `/api/auth/*` is the web
middleware's 10 req/min/IP. That works against single-IP brute force but
not against credential stuffing from a botnet (each bot IP gets 10 free
attempts before backoff). Combined with F-SCALE-03 (fail-open on Redis
outage), this is the brittlest part of the auth surface.

Fix: enable Better Auth's `rateLimit` plugin with stricter per-account
caps (5 failed login attempts → 15-min lockout per email, not per IP),
and move the email-based lockout to a Postgres-backed counter so it
survives Redis incidents.

---

## Notes / things that look correct

- Cursor-based pagination is consistently applied on most large list
  endpoints (einvoice, integration logs, peppol, time, late-payment, etc.)
  with `max(100)` schema bounds.
- `cached()` helper has proper singleflight-within-process and a
  null-envelope wrapper to distinguish "cached null" from miss — better
  than most codebases.
- QStash signature verification is enforced on every async callback
  route via `verifySignatureAppRouter` — webhooks can't be spoofed.
- `serverExternalPackages` in `next.config.ts` correctly excludes
  `@react-pdf/renderer` adjacent native libs (libxmljs2, saxon-js,
  clamscan) from the client bundle.
- Load-test bypass header is properly env-guarded against production
  hosts (Vercel + Render non-preview branches), uses constant-time
  comparison, and short-circuits cleanly.
- Cron jobs route through Render's private network with timing-safe
  `CRON_SECRET` comparison (`apps/web/src/app/api/cron/data-purge/
  route.ts:79`).
- Render scaling block (web 2-8 instances at 70% CPU / 75% memory targets)
  is reasonable for the current load profile; the bottleneck under load
  will be Neon writer connections long before web pod CPU.
