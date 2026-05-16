# Infrastructure Recommendations — Production Hardening

**Owner:** Platform / on-call
**Status:** Proposal — `render.yaml` is **not** edited by this goal. Each section is independently approvable.
**Audience:** Maintainer making infra decisions; the next operator who needs to slot work into future milestones.
**Last reviewed:** 2026-05-16
**Source goal:** `goals/production-hardening/` Phase D — drafted from `render.yaml` (539 lines), the post-launch closure (`.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md`), and the in-tree code surface as it stands on `feat/production-hardening`.

This document captures the infrastructure shape the `production-hardening` goal could not change without maintainer sign-off on `render.yaml` or external services (Cloudflare, Axiom, Upstash, Neon). Each recommendation cites current state with `file:line` citations, then states the recommended state, expected impact, rollout sequencing, observability hooks, and rollback path. Nothing here is mechanical — each item carries a real product trade-off the operator must accept.

---

## Table of contents

1. [Worker scaling](#1-worker-scaling)
2. [PDF / export worker shape](#2-pdf--export-worker-shape)
3. [ClamAV redundancy](#3-clamav-redundancy)
4. [Unleash high-availability per region](#4-unleash-high-availability-per-region)
5. [Read-replica rollout](#5-read-replica-rollout)
6. [Better Auth `secondaryStorage`](#6-better-auth-secondarystorage)
7. [OpenTelemetry → Axiom](#7-opentelemetry--axiom)
8. [CDN in front of Render](#8-cdn-in-front-of-render)
9. [SLO / SLI starting set](#9-slo--sli-starting-set)
10. [Tier-2 follow-ups](#10-tier-2-follow-ups)
11. [Pickup priority matrix](#pickup-priority-matrix)

---

## 1. Worker scaling

### Current state

- `render.yaml:341-365` defines the `worker` service:
  - `type: worker`, `runtime: docker`, `plan: starter`, no `scaling` block (Render defaults to **a single instance**, no autoscale).
  - Same image as `web` (`./apps/web/Dockerfile`), entry point `node apps/web/worker-cron.mjs`.
  - Region `frankfurt`, autoDeploy on `main`.
  - Shares `CRON_SECRET` with the web service (`render.yaml:354-358`) and reaches the web pod over Render's private network via `WORKER_TARGET_HOSTPORT` (`render.yaml:361-365`).
- The worker invokes web endpoints for cron-driven jobs. Critical jobs that ride on QStash (webhooks, async ClamAV, outbox) are queued via Upstash; the worker is the fallback executor for `node-cron`-scheduled tasks that cannot live on QStash.
- Cron-job services (`cron-token-refresh` `render.yaml:492-514`, `cron-data-purge` `render.yaml:516-539`) are separate Render `cron` services and are unaffected by worker scaling.

### Recommended state

- Move `worker` to `plan: standard` (matches `web`) and add an explicit `scaling` block:

  ```yaml
  scaling:
    minInstances: 2
    maxInstances: 4
    targetCPUPercent: 70
    targetMemoryPercent: 75
  ```

- `minInstances: 2` removes the single-pod SPOF for cron-driven work. Render rolling deploys can drain one pod while the second continues to honour the cron schedule.
- Health-based autoscale is the simplest signal Render exposes natively. Queue-depth-driven scaling (QStash dead-letter rate, outbox backlog) is **not** available as a Render-native metric — see the Tier-2 follow-up below.

### Expected impact

- Eliminates the "cron service down because the only worker pod is mid-deploy" gap. Today a Render rolling restart silently delays every `node-cron` tick by ~30-60s; with two pods the second covers the gap.
- Doubles fixed monthly cost for the worker (~$25 → ~$50 on `standard`). Marginal compared to the Postgres + Neon spend.
- Render `standard` adds CPU headroom that pays for itself the first time a worker job runs a Prisma aggregation against the EU writer.

### Rollout sequencing

1. **Pre-flight:** confirm every `node-cron` job in `apps/web/worker-cron.mjs` is idempotent. Two pods means every tick fires twice (once per pod) unless the cron entry uses an advisory-lock leader election. Audit each registered job; for any that is **not** safe to run twice in parallel, wrap with `packages/api/src/lib/advisory-lock.ts` `withAdvisoryLock(...)` before this change ships.
2. Land the `scaling` block on a preview environment first; observe one full deploy cycle.
3. Promote to production. Watch Cronitor for missed-heartbeat alerts during the deploy.

### Observability hooks

- Cronitor already monitors each cron heartbeat (`packages/api/src/services/cron-monitor.ts:67` — `raw-fetch-OK` reason documented). After the scale-up, the per-pod heartbeat will arrive twice per tick — Cronitor's "any heartbeat" semantics keep this benign, but the maintainer should re-tune the alert window.
- Axiom dashboard: add a `worker_pod_count` panel sourced from the Render metrics export; alert when count drops to 1 for >5 minutes.

### Rollback path

- Revert the `scaling` block (delete the four lines) and redeploy. Worker reverts to single-pod within one Render deploy cycle (~3 min).
- If the leader-election audit (step 1 above) was incomplete and a job double-fires, the rollback is the same; no DB-level remediation required because each affected job will be picked up by the advisory-lock guard once re-introduced.

---

## 2. PDF / export worker shape

### Current state

- The same `worker` service (`render.yaml:341-365`) handles **all** background jobs: cron heartbeats, scheduled syncs, and any future PDF / export rendering work.
- No dedicated PDF render service exists. Today PDF rendering happens inline in tRPC procedures or via QStash-queued jobs that the worker pulls down; both paths share the worker's CPU/RAM ceiling.
- The worker today runs on `plan: starter` (~512 MB RAM, shared CPU). A single Chromium/Puppeteer render of a 30-page invoice can spike to ~400 MB resident — one in-flight render starves every other job on the pod.

### Recommended state

- **Option A (preferred): split out a `pdf-worker` service.**

  ```yaml
  - type: worker
    name: pdf-worker
    runtime: docker
    region: frankfurt
    plan: pro  # 4 GB RAM, 2 CPU — Chromium needs the headroom
    dockerfilePath: ./apps/web/Dockerfile
    dockerCommand: node apps/web/worker-pdf.mjs
    scaling:
      minInstances: 1
      maxInstances: 3
      targetCPUPercent: 70
    envVars:
      - fromGroup: app-shared
      - key: PDF_WORKER_CONCURRENCY
        value: '2'  # explicit cap — back-pressure for Chromium
  ```

- **Option B (interim): keep one worker but enforce backpressure.** Add `PDF_RENDER_MAX_CONCURRENT=2` env, wire a per-worker semaphore around the PDF code path so other jobs (cron heartbeats, sync polls) keep running while a render is in flight.

### Expected impact

- **Option A:** PDF renders no longer evict cron heartbeats from the worker pod. ~$50/month for the `pro` plan; absorbed by the first enterprise customer needing batched exports.
- **Option B:** Cheaper but the worker still goes red on bursty renders; cron monitoring will flap. Use only if budget is the constraint.

### Rollout sequencing

1. Verify there is a real PDF workload — today the only batch render path is the invoice export route. If render volume is <100/day, Option B suffices.
2. **Option A path:** ship the new service to a preview env; route a sample render job to it via a feature flag (`pdf.worker.split`). Observe one week of staging traffic.
3. Flip the feature flag in prod. Keep the inline-render fallback for 48h.
4. Decommission the inline render path (remove the worker-side queue handler).

### Observability hooks

- New Axiom dashboard: `pdf_render_duration_ms_p95`, `pdf_render_failure_rate`, `chromium_rss_bytes`.
- Sentry: tag PDF render spans with `service: pdf-worker` so they don't drown the `worker` error budget.
- Alert thresholds: p95 render duration > 30s (warn), > 60s (page).

### Rollback path

- **Option A:** Set the feature flag back to `false`; jobs route to the original worker. Decommission the `pdf-worker` service via Render dashboard after one deploy cycle.
- **Option B:** Remove the semaphore env var; reverts to unbounded concurrency.

---

## 3. ClamAV redundancy

### Current state

- `render.yaml:367-394` defines a **single** ClamAV `pserv`:
  - `plan: standard` (1 GB RAM — required because ClamAV signatures live in memory; `starter` OOMs once the signature DB hits the typical ~300 MB on-disk / ~700 MB loaded shape, per the in-file comment at `render.yaml:368-370`).
  - 5 GB persistent disk (`render.yaml:384-387`).
  - Reachable on Render's private network only. `web` injects `CLAMAV_HOST` / `CLAMAV_PORT` (`render.yaml:279-285`).
- All upload virus scans are synchronous, blocking the upload tRPC procedure. If the ClamAV pod is mid-restart (signature refresh, OOM recovery, deploy), uploads fail with a 502 instead of being queued for later scanning.
- Single ClamAV pod = a hard SPOF for any feature that uploads user content (invoices, contracts, identity docs, OCR sources).

### Recommended state

Two options, ordered by cost.

#### Option A — Async ClamAV via QStash with timeout fallback (recommended)

- Decouple scanning from upload: on upload, write the file to R2 with a `scan_status: pending` metadata tag and enqueue a QStash job that posts the object key to the ClamAV worker route.
- The upload tRPC procedure returns success immediately with the `pending` status; the UI shows a "scanning" badge until the QStash callback flips `scan_status` to `clean` or `quarantined`.
- ClamAV pod outage no longer blocks uploads — files queue and re-process when the pod recovers. Add a `max-age=24h` quarantine timeout so a permanently-broken ClamAV doesn't silently let files through; after 24h `pending → quarantined-no-scan` and the file is hidden until a human reviews.

#### Option B — Second ClamAV instance + load balancer

- Add a second `pserv` (`clamav-2`) mirroring the first; share signature DB via a sync sidecar or accept divergent freshness windows.
- Front both pods with a lightweight reverse proxy (HAProxy or a tiny Node service) that round-robins; route in `web` via `CLAMAV_HOST=clamav-lb` (`render.yaml:279-285`).
- Doubles ClamAV cost (~$50/month for two `standard` pods + the LB pserv).

### Expected impact

- **Option A:** Uploads survive ClamAV outages. Cost: one QStash topic, one extra route handler, ~50 LOC of state machine. Side effect: UX has to show a "scanning" intermediate state — flag for design review.
- **Option B:** Synchronous scans continue to work; redundancy via active-active. No UX change. Higher fixed cost; signature-DB drift becomes a new operational concern.

### Rollout sequencing (Option A path)

1. Add the `FileScanStatus` enum + `scanStatus` column migration to the `Upload` model. Reversible migration.
2. Ship the new QStash route handler behind a feature flag (`clamav.async.enabled`).
3. Dual-write: synchronous scan **and** enqueue async scan for one week. Compare results; tune timeouts.
4. Flip the flag for one tenant cohort. Monitor for one week.
5. Flip the flag globally. Remove the synchronous scan code path 30 days later.

### Observability hooks

- Axiom: `clamav_scan_duration_ms_p95`, `clamav_pending_queue_depth`, `clamav_quarantine_timeout_count`.
- Sentry: tag scan errors with `clamav.async: true|false` to distinguish during the dual-write phase.
- Alert: `clamav_pending_queue_depth > 100` (warn), or any file aging past 23h in `pending` (page).

### Rollback path

- Flip the feature flag back to `false`. Synchronous scans resume immediately. QStash jobs in flight are no-ops because the upload was already marked `clean` synchronously.
- If a quarantine bug ships, set every file with `scanStatus: quarantined-no-scan` aged < 24h back to `pending` via a one-off SQL script before disabling the flag — the doc comment on the migration must spell this out.

---

## 4. Unleash high-availability per region

### Current state

- `render.yaml:405-425` defines `unleash-eu` on `plan: starter` — **single instance**.
- `render.yaml:432-449` defines `unleash-me` on `plan: starter` — **single instance**.
- Both use `docker.io/unleashorg/unleash-server:7` and a dedicated `DATABASE_URL` (separate Neon DB per the in-file comment at `render.yaml:402-404`).
- App-side fallback: the evaluator in `packages/feature-flags/` ships a typed default for every flag, so a single-region Unleash outage degrades to "every flag returns its default" rather than throwing.
- `cloudflared` (`render.yaml:469-487`) handles on-demand admin UI access; it is suspended by default and does **not** affect runtime flag evaluation.

### Recommended state

- Each Unleash `pserv` runs with `minInstances: 2`, shared Postgres (current Neon DB per region).
- Optionally promote to `plan: standard` if memory pressure shows up at 256 MB; the v7 server with caching enabled fits comfortably in `starter` for our flag count (< 200 flags, < 50 segments).

  ```yaml
  - type: pserv
    name: unleash-eu
    runtime: image
    region: frankfurt
    plan: starter
    scaling:
      minInstances: 2
      maxInstances: 2
    image:
      url: docker.io/unleashorg/unleash-server:7
    # ... existing env unchanged
  ```

- The two pods share the same Postgres DB; Unleash already supports multi-instance via DB-level coordination (no leader election needed).

### Expected impact

- Survives a single-pod restart (signature update, base-image rebuild, OOM) without an app-side fallback storm. Today, a 30s Unleash outage during a deploy means every flag returns its default for 30s — usually harmless, occasionally not (e.g. a feature flag gating a security check defaults to the safer state, but a feature flag gating a paid-tier capability defaults to "off" and surprises a paying tenant).
- Doubles per-region Unleash cost (~$14 → ~$28/month each, ~$28 total uplift).
- ME region remains in Frankfurt physically (Render has no ME data center); data-residency is enforced by the jurisdiction short-circuit in the evaluator (`packages/feature-flags/`) and the separate Neon DB.

### Rollout sequencing

1. Bring up `unleash-eu` second pod; observe DB connection count (Neon free tier caps; watch `unleash` schema row counts).
2. Bring up `unleash-me` second pod.
3. Run a 1h soak against staging with synthetic flag changes; verify both pods serve identical evaluations within seconds (Unleash's default 10s metric/feature poll interval is the convergence window).

### Observability hooks

- Add to existing health probe (`apps/web/src/app/api/health/route.ts`): per-region Unleash reachability. Today the probe checks DB/Redis/QStash/R2/backpressure (`apps/web/src/app/api/health/route.ts:48`); add `unleashEu` and `unleashMe`.
- Cronitor: per-region Unleash uptime check.

### Rollback path

- Drop the `scaling` block. Single-pod resumes within one deploy cycle.

---

## 5. Read-replica rollout

### Current state

- `packages/db/src/replica.ts:1-59` defines the `readReplica(region, fn)` helper. It accepts a per-region read-replica `PrismaClient` (`DATABASE_URL_<REGION>_RO`), falls back to the writer transparently on failure, and is fronted by an opossum circuit breaker (5 failures / 60s window → 30s open).
- **Exactly one caller** opts into the replica today: `packages/api/src/routers/core/dashboard.ts:318` and `:397` (`dashboard.kpis` and a related KPI aggregator). Every other read still hits the writer.
- The replica also ships an RLS tripwire (`packages/db/src/replica.ts:95`-area, `RLS_POLICIES_ENFORCED` env): once `CREATE POLICY` migrations land, the helper throws on any callsite that bypasses RLS scoping. This is a forward-compatibility guard; not blocking today.

### Recommended state — pickup criteria

A procedure is a replica candidate **only if all four hold**:

1. **Read-only.** No mutation in the same handler. No `$transaction` block that mixes reads + writes. Pure aggregate / `findMany` / `count`.
2. **Stale-tolerant.** UX can tolerate Neon's ~50-200ms replication lag. Any read-after-write within the same request flow is disqualified.
3. **Hot path.** The procedure shows up in the top-20 by request volume per the existing perf project (`e2e/playwright.perf.config.ts`) or N+1 audit (`docs/N+1-AUDIT.md`).
4. **No regulator dependency.** Audit-log reads, billing-ledger reads, anything that downstream regulators or auditors might subpoena → writer. Strict-consistency outweighs the latency win.

### Next five candidates

Ordered by expected RTT savings, drawn from the `docs/N+1-AUDIT.md` top-10 list:

1. **`contractor.list`** — paginated list, no joins to mutation-recent rows; safe.
2. **`contract.list`** — same shape; verify the `lastModifiedAt` column is not surfaced as the sort key for read-after-write UX.
3. **`invoice.list`** — safe **except** when called immediately after `invoice.create` from the same flow. The caller already invalidates the query post-mutation; the next list fetch can tolerate ~200ms of staleness if the optimistic-update UI is in place.
4. **`payment.list`** — same caveats as `invoice.list`.
5. **`equipment.list`** — fully safe (no read-after-write flow in the equipment UI).

Each migration is one line in the router: wrap the existing read in `readReplica(region, db => …)`. Land each as a separate commit so a single regression can be reverted independently.

### Expected impact

- Each migration peels ~50-200ms off p95 for the affected procedure when the request originates in ME (replica in ME region) or shifts read load off the EU writer (replica in EU region). Aggregate p95 dashboard latency win: ~80-150ms on cold paths, ~20-40ms on warm paths (writer pool already hot).
- Negligible cost: Neon replicas bill at half the writer rate; the existing replica pool already covers the load.

### Rollout sequencing

- One commit per candidate, behind no feature flag (the helper itself already falls back to the writer on any failure — see `packages/db/src/replica.ts:17-21`).
- Bake each commit on staging for ≥48h before promoting the next. Watch Sentry breadcrumbs for `readReplica fallback` (logged at `warn`).
- After all five, re-run the perf project against staging; compare p95 deltas vs the baseline.

### Observability hooks

- Pino warns on every replica → writer fallback. Aggregate the count in Axiom: `read_replica_fallback_total` grouped by `region` and `caller`. A spike means the replica is unhealthy or lagging beyond the breaker threshold.
- Sentry breadcrumb on every fallback (already wired).

### Rollback path

- Revert the per-procedure commit. Helper falls back transparently to writer in the meantime, so a regression manifests as latency only (not correctness).

---

## 6. Better Auth `secondaryStorage`

### Current state

- `packages/auth/src/config.ts:128-150` configures Better Auth's `rateLimit` with `enabled: true`, custom per-route windows for `/sign-in/email`, `/sign-up/email`, `/forget-password`, `/sign-in/magic-link`.
- The in-file comment at `packages/auth/src/config.ts:120-122` explicitly notes: **"Storage: defaults to in-memory (per-pod). For multi-instance deployments, configure `secondary-storage` (Upstash) so rate-limit state is shared across pods."**
- `web` runs with `minInstances: 2, maxInstances: 8` (`render.yaml:265-269`). Today, the rate-limit cap is **multiplied by the pod count** because each pod tracks its own counter. With 8 pods, the configured 10 sign-in attempts/min becomes an effective 80 sign-in attempts/min before any pod's counter trips.
- Sessions themselves live in the Better Auth DB (Postgres) — only the rate-limit state is per-pod. Database sessions already share cross-pod (no concern there).

### Recommended state

- Wire Better Auth's `secondaryStorage` to the existing Upstash Redis instance (`UPSTASH_REDIS_REST_URL` / `_TOKEN` already in `app-shared` env group, `render.yaml:90-93`).

  ```ts
  // packages/auth/src/config.ts (sketch)
  import { Redis } from '@upstash/redis';
  const redis = Redis.fromEnv();

  export const auth = betterAuth({
    // ... existing
    secondaryStorage: {
      get: async (key) => (await redis.get<string>(key)) ?? null,
      set: async (key, value, ttl) => {
        if (ttl) await redis.set(key, value, { ex: ttl });
        else await redis.set(key, value);
      },
      delete: async (key) => { await redis.del(key); },
    },
    rateLimit: { /* unchanged */ },
  });
  ```

- After enabling, the per-route caps (`/sign-in/email: 10/min`, etc.) become **cluster-wide** caps. The first credential-stuffing attempt that lands on pod 1 burns counter quota the next attempt on pod 5 sees.

### Expected impact

- Closes the multi-pod rate-limit amplification gap. Today an attacker hitting our 8-pod ceiling gets ~80 password attempts/min/IP before the per-account lockout (5 failures → 15-min lock, `packages/auth/src/config.ts:135-140` comment) hard-stops them. With shared storage, the IP-level cap binds first.
- Adds ~1 Upstash Redis call per rate-limited route invocation (~+5-10ms per `/sign-in/email` request). Negligible vs the CAPTCHA roundtrip already on that path.
- Upstash request volume rises by the auth-route QPS. The existing free/paid tier should absorb it; verify after one week.

### Rollout sequencing

1. Land the `secondaryStorage` adapter in `packages/auth/src/config.ts`. Type-check, unit-test against the in-memory adapter still as a fallback for local dev.
2. Deploy to staging. Run a synthetic 50-req burst against `/sign-in/email` from a single IP; expect rate limit to engage at 10 requests regardless of which pod served each one.
3. Promote to prod. Monitor Upstash request volume + auth error rates for 24h.
4. Optionally: extend `secondaryStorage` usage to session caching (Better Auth supports it) for cross-pod session-read consistency. Land as a separate change.

### Observability hooks

- Pino: log every rate-limit trip with `{ route, ip, podId, counter }`. Today pod-local trips don't tell us the cluster-wide rate. After this change, `counter` reflects the shared state.
- Axiom: `auth_rate_limit_trip_total` grouped by `route`. Expect a step-change after rollout because the same attacker burns the cap faster.

### Rollback path

- Remove the `secondaryStorage` block from the Better Auth config. Reverts to in-memory per-pod. No data migration; Upstash keys self-expire via TTL.

---

## 7. OpenTelemetry → Axiom

### Current state

- No distributed tracing. `packages/logger/src/request-context.ts:13` (per `docs/PRODUCTION-CHECKLIST.md` §4) explicitly notes "We do NOT add `@opentelemetry/sdk-node`" — pinned in the closure as a Tier-2 follow-up.
- We have:
  - Structured Pino logs shipped to Axiom (`AXIOM_TOKEN`, `AXIOM_DATASET` in `app-shared` env group, `render.yaml:162-165`).
  - Sentry for error + performance traces on the web app (`apps/web/next.config.ts` Sentry block).
  - Cronitor for cron + uptime (`render.yaml:166-167`).
  - The new `requestId` ALS propagation through the tRPC boundary (commit `feat(observability): propagate requestId through tRPC HTTP boundary via ALS`).
- Gap: no single trace spans HTTP → tRPC → Prisma → outbound `fetch` → QStash. Today we correlate by `requestId` post-hoc; we cannot see end-to-end timing per request.

### Recommended state

- Add `@vercel/otel` to `apps/web/instrumentation.ts` (Next.js 15 supports the `register()` hook natively, already in use for Sentry).

  ```ts
  // apps/web/src/instrumentation.ts (sketch — only the OTel block)
  import { registerOTel } from '@vercel/otel';

  export async function register() {
    if (process.env.OTEL_SDK_DISABLED === 'true') return;

    registerOTel({
      serviceName: 'contractor-ops-web',
      traceExporter: {
        type: 'otlp-http',
        endpoint: process.env.AXIOM_OTEL_ENDPOINT, // https://api.axiom.co/v1/traces
        headers: {
          authorization: `Bearer ${process.env.AXIOM_TOKEN}`,
          'x-axiom-dataset': process.env.AXIOM_TRACE_DATASET ?? 'contractor-ops-traces',
        },
      },
      instrumentations: ['http', 'fetch'], // Prisma comes via @prisma/instrumentation
      // 1% sampling baseline; 100% for errors via parent-based sampler
      traceSampler: 'parentbased_traceidratio',
      traceSampleRatio: 0.01,
    });

    // Prisma instrumentation
    const { PrismaInstrumentation } = await import('@prisma/instrumentation');
    // ... register
  }
  ```

- Trace surface (the four spans every important request should produce):
  1. **HTTP** — `@opentelemetry/instrumentation-http` auto-instruments incoming requests. Tag with `requestId` from the ALS frame.
  2. **tRPC** — manual span around `fetchRequestHandler` (the existing `runWithRequestContext` wrapper is the obvious place to add it).
  3. **Prisma** — `@prisma/instrumentation` (Prisma 7 native). One span per query with the redacted SQL.
  4. **fetch / QStash** — the auto-fetch instrumentation covers outbound, including `fetchWithTimeout` and `withResilience` (which calls fetch internally).

### Expected impact

- One trace per request shows end-to-end latency broken down by hop. Reduces MTTR on "the dashboard is slow" reports from hours (manually correlating logs by `requestId`) to seconds.
- **Cost estimate (use as upper bound — verify with Axiom pricing before flipping enforce):** at the current web volume (~50 req/sec sustained, ~1.5B requests/month), 1% sampling = ~15M spans/month. Axiom Cloud at ~$25/M ingested events ≈ **~$375/month**. The 100%-for-errors band adds maybe 1% on top (assuming a <1% error rate). Cap by raising `OTEL_SDK_DISABLED=true` on the worker (cron jobs are noise) → realistic prod estimate **~$200-300/month**. The maintainer must validate with the actual Axiom contract.
- Server-side overhead: ~1-3ms per request for span creation + batch export. Negligible.

### Rollout sequencing

1. **Stage 1 (instrumentation behind a kill switch):** ship the OTel SDK with `OTEL_SDK_DISABLED=true` set in every Render service. Code lands but nothing exports.
2. **Stage 2 (staging only):** unset `OTEL_SDK_DISABLED` in the staging env. Watch Axiom trace ingestion for 48h. Verify per-trace shape, span attributes, sampling rate. Tune sampler if needed.
3. **Stage 3 (prod web only):** unset on `web` first. Observe Axiom cost for one week. If it lands within the ~$300 ceiling, continue.
4. **Stage 4 (prod public-api):** add to `public-api` (`render.yaml:314-338`). Volume here is lower (Enterprise tier only); incremental cost ~10-20%.
5. **Stage 5 (worker traces, optional):** add to `worker` only if a specific debug need surfaces. Otherwise leave disabled.

### Observability hooks

- Self-observability: Axiom panel `otel_spans_per_second` to monitor ingestion rate vs sampling intent.
- Cost alert: Axiom monthly bill projection > $400 → page (kill-switch is the manual response).

### Rollback path

- Set `OTEL_SDK_DISABLED=true` in the Render env for the affected service. Takes effect on next deploy (~3 min) or after a manual restart.
- The OTel SDK is additive; no data migration. Existing Pino logs + Sentry remain untouched throughout.

---

## 8. CDN in front of Render

### Current state

- `landing` is a `runtime: static` Render site (`render.yaml:288-308`); Render serves it from their built-in CDN. Custom HSTS/Referrer-Policy headers are declared in the `headers:` block.
- `web` is a `runtime: docker` Next.js standalone service (`render.yaml:254-285`); responses flow directly from Render's origin. No CDN in front of it for static assets (`/_next/static/*`), images, or fonts.
- Origin TTFB for `/dashboard` first byte is dominated by Render's edge → Frankfurt round trip + the Next.js SSR render. The Render edge POP for non-EU users adds 100-200ms.
- `public-api` (`render.yaml:314-338`) is intentionally not behind a CDN — every request is dynamic + auth'd, no cache opportunity.

### Recommended state

- Front the `web` and `landing` custom domains with **Cloudflare** (reverse proxy / orange-cloud mode):
  - **Cache rules:** `/_next/static/*` → cache aggressively (Next emits immutable hashed filenames). `/_next/image/*` → cache with `s-maxage=86400`. `/favicon.ico`, `/apple-touch-icon.png` → cache. Everything else → bypass (auth pages, SSR routes).
  - **SSL:** Full (Strict) — Cloudflare → Render uses the Render-managed cert. Update Render custom domain config to allow Cloudflare's origin IPs only (Render does not offer Authenticated Origin Pulls; rely on the `cf-ray` header + a shared secret check in middleware if origin lockdown is required).
  - **Edge-cache headers:** the existing `Cache-Control` work in `apps/web/src/lib/cache-control.ts` (per Phase C.7.a commit `feat(cache): declare cache-control headers explicitly on public API routes`) already declares per-route policies. Cloudflare honours `s-maxage` directives.

### Expected impact

- Static asset TTFB drops from ~150-300ms (Render origin in Frankfurt) to ~20-50ms (Cloudflare PoP near the user).
- Origin request volume falls by ~30-60% — every cached static asset is one fewer Render request. Worth a noticeable Render bandwidth bill reduction.
- LCP improvement on cold loads: ~100-400ms depending on the user's geographic distance from Frankfurt.

### Rollout sequencing

1. Move DNS for the marketing landing domain to Cloudflare first (lower risk; static site, every byte cacheable). Observe one week.
2. Move DNS for the app domain (`app.contractor-ops.com` or equivalent). Use the **Cloudflare Page Rules** to bypass cache on the SSR + API paths from day 1.
3. Add a Cloudflare Worker (or Transform Rule) to inject `x-forwarded-for` correctly so Next.js sees the original client IP for rate limiting (Better Auth and Upstash both depend on this).

### Observability hooks

- Cloudflare analytics → origin request rate, cache hit ratio, bandwidth. Target: >70% cache hit ratio on static asset paths within 7 days.
- Axiom: tag inbound requests with the `cf-ray` header (presence = the request came through Cloudflare). Useful for diagnosing origin-direct requests (which means a DNS issue or a Cloudflare bypass).

### Rollback path

- Set the DNS record back to "DNS only" (grey cloud) in Cloudflare. Traffic resumes flowing directly to Render within DNS TTL (recommended TTL 60s during the transition).
- If a cache-poisoning bug ships (unlikely with conservative rules), purge the cache via Cloudflare dashboard (one click) before reverting DNS.

---

## 9. SLO / SLI starting set

### Current state

- No formal SLOs. `docs/PRODUCTION-CHECKLIST.md` §4 lists "SLO / SLI document" as 🟠 CRITICAL, evidence-citation "no `docs/SLO.md`; scoped to Phase D infra recommendations".
- Existing measurement primitives: Cronitor (uptime + cron heartbeats), Axiom (Pino logs), Sentry (errors), Render-native metrics (CPU/memory per service). What's missing is the threshold contract.

### Recommended state

Adopt the following starter set. Each is independently verifiable from existing telemetry within 30 days; no new infra required to **measure** them (you may want OTel from §7 to **diagnose** when they trip).

| SLO | Target | Window | Source |
|---|---|---|---|
| Web availability | 99.9% | 30d rolling | Cronitor `/api/health` |
| Web p95 latency | ≤ 500 ms | 30d rolling | Axiom HTTP log percentile |
| Web p99 latency | ≤ 1500 ms | 30d rolling | Axiom HTTP log percentile |
| Public API availability | 99.95% | 30d rolling | Cronitor `/api/v1/health` |
| Public API p95 latency | ≤ 200 ms | 30d rolling | Axiom HTTP log percentile |
| tRPC mutation success rate | 99.5% | 30d rolling | Axiom log count where `level=error` |
| Worker job success rate | 99% | 30d rolling | Cronitor cron success rate |
| Auth `/sign-in/email` p95 | ≤ 800 ms | 30d rolling | Axiom (excludes CAPTCHA roundtrip) |

### Error budgets

- Each SLO implies an error budget. Example: 99.9% web availability over 30 days = **43 minutes of downtime/month** budget. Spend tracking is the operator's job; the alert is "we've burned > 50% of the budget in < 50% of the window → page".
- Public API at 99.95% = **21 minutes/month** — tighter because Enterprise contracts may eventually require it.

### Alert thresholds

- **Page (wakes someone up):** any SLO at 50% error-budget burn rate over a 1h window. E.g. web availability dipping such that 21 min of downtime have occurred in the last hour → page.
- **Warn (Slack):** any SLO at 25% burn over a 6h window.
- **Wire via:** Cronitor's threshold alerts for availability; Axiom monitors for latency/error rates. Both already shipped per `render.yaml:166-167`.

### Rollout sequencing

1. Create `docs/SLO.md` with the table above and the error-budget arithmetic spelled out. (This document section is the seed; the maintainer should split it out when adopting.)
2. Configure Axiom monitors for each latency + error-rate SLI. One week of baseline data before turning on alerts.
3. Configure Cronitor monitors for the availability SLIs.
4. Run a "game day" — synthetically degrade one SLO and verify the alert routes to the right channel.
5. After 30 days, re-evaluate: any SLO that has tripped > 3x in the window is mis-set (too tight or the underlying service genuinely doesn't meet it).

### Observability hooks

- Self-meta: monitor the SLO-monitoring itself. If Axiom ingestion stops, every SLI dashboard reads "0" — that should itself page.

### Rollback path

- SLOs are operational targets, not configuration. "Rollback" is loosening a target — done via doc edit + monitor update.

---

## 10. Tier-2 follow-ups

These items are tracked here so the next operator can slot them into a future milestone without re-reading the closure (`.audit-2026-05-03/AUDIT-CLOSURE-2026-05-11.md`) or the per-phase commit messages.

### 10.1 RLS `CREATE POLICY` migration

- **Source:** closure §2.1 (F-DB-04), `packages/api/src/middleware/tenant.ts:137` (`withRlsSession` wired), `packages/db/src/replica.ts` (RLS tripwire awaiting policies).
- **Pickup criteria:** a DB engineer + DPO have signed off on the `CREATE POLICY` SQL for every multi-tenant model. The `RLS_POLICIES_ENFORCED=true` env flip is the activation switch.
- **Sequencing:** policies first, behind the env flag. Burn-in one week on staging with the flag on. Flip prod. Remove the app-layer `withRlsSession` once defence-in-depth is no longer needed (likely never — keep both).

### 10.2 Full circuit-breaker rollout to remaining raw-fetch sites

- **Source:** Phase B.3 (`feat(resilience): apply fetchWithTimeout to service-layer outbound calls`) committed for the broad set; three callsites carry the explicit `// resilience: raw-fetch-OK` annotation because they intentionally bypass the breaker:
  - `packages/integrations/src/services/health-service.ts:218` — QStash health probe (bypasses breaker so a depended-on outage does not poison `/api/health`).
  - `packages/api/src/services/cron-monitor.ts:67` — Cronitor heartbeat (best-effort, already bounded by `AbortSignal.timeout(5000)`).
  - `apps/web/src/app/api/health/route.ts:146` — QStash probe inside the health route, same rationale as above.
- **Pickup criteria:** none. These annotations are correct as-is. The follow-up here is **only** for any **new** raw-fetch sites the codebase grows that lack the annotation; `scripts/lint-raw-fetch.mjs` (Phase B.3.d) enforces this at pre-push.

### 10.3 Advisory-lock transition cleanup

- **Source:** Phase B.5 (`refactor(advisory-lock): remove dual-hold transition shim`) is gated on the user confirming `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` has been unset in every Render service for ≥1 deploy cycle.
- **Pickup criteria:** maintainer confirmation that the env var is unset everywhere. Once confirmed, execute Phase B.5 as the gate-clearing commit (already planned, deferred only on the user signal).
- **Sequencing:** B.5 is one atomic commit. Tests already exist. The risk is operational (rolling deploys with stale instances); the user-confirmation gate covers it.

### 10.4 Theme cookie sync (FOUC fix for users with localStorage prefs)

- **Source:** Phase C.1.a (`refactor(layout): replace inline theme bootstrap with Server Component cookie read`). The Server Component reads the cookie; users whose preference lives only in `localStorage` get the default theme on first paint and flash to the saved theme after hydration.
- **Pickup criteria:** UX decision. If FOUC is acceptable (most users hit the default on first ever load anyway), skip. If not, ship a tiny middleware that mirrors `localStorage` to a cookie on the first authenticated response.
- **Sequencing:** middleware change, no infra. Lands in a future C.1.x commit.

### 10.5 next-themes nonce or hash-based script (C.1.c readiness)

- **Source:** Phase C.1.b (`feat(csp): ship report-only nonce-based CSP alongside enforce header`). Flipping to enforce in C.1.c requires that any remaining inline script in `next-themes` or similar libs carries a nonce or build-time hash.
- **Pickup criteria:** the 48h CSP report-only observation period from C.1.b shows zero unexpected violations from `next-themes` or any other lib. If violations surface, fix them before C.1.c flips enforce.
- **Sequencing:** observe → patch → enforce. Calendar-time gated; cannot be compressed.

### 10.6 Landing CDN-level header injection

- **Source:** Phase C.2.a (`feat(security): add COOP/COEP/CORP + extend Permissions-Policy; mirror to landing`). Because `apps/landing` is `output: 'export'`, the Next `headers()` block is a build-time no-op at runtime — Render serves the static export with whatever headers `render.yaml:299-308` declares (currently only HSTS / X-Content-Type-Options / Referrer-Policy).
- **Pickup criteria:** the CDN-front decision in §8 is made. If Cloudflare lands in front, inject COOP/COEP/CORP at the Cloudflare layer via Transform Rules. If Cloudflare is declined, extend the `headers:` block in `render.yaml:299-308`.
- **Sequencing:** dependent on §8.

### 10.7 `security.txt` domain + PGP key

- **Source:** Phase C.2.b (`feat(security): publish .well-known/security.txt`). The route handler ships with TODO placeholders for the contact domain + PGP key fingerprint.
- **Pickup criteria:** the maintainer commits to a public security contact email + a PGP key (or a security disclosure platform like HackerOne URL). Replace the TODOs.
- **Sequencing:** one commit. Validate via `https://securitytxt.org/`.

### 10.8 Bundle-size chunk-glob tightening

- **Source:** Phase C.6.a (`feat(perf): integrate bundle analyzer + CI budget for top routes`). The initial budget is a single global cap; the chunk-glob can be tightened per-route once one CI run produces the per-chunk breakdown.
- **Pickup criteria:** one CI run with the new analyzer has completed. Use the chunk report to convert the global cap into per-chunk caps (e.g. `/dashboard` shell ≤ 100 KB, vendor chunk ≤ 150 KB).
- **Sequencing:** one tightening commit after the first analyzer run.

### 10.9 `R2_PUBLIC_URL` custom CDN domain in `images.remotePatterns`

- **Source:** Phase C.6.c (`feat(security): narrow images.remotePatterns to known external hosts`). The allowlist enumerates `*.r2.cloudflarestorage.com` plus a small set of known hosts. If the maintainer ever fronts R2 with a custom CDN domain (e.g. `cdn.contractor-ops.com`), it needs to be added to the allowlist.
- **Pickup criteria:** decision to use a custom CDN domain for R2 assets. Until then, no action.
- **Sequencing:** one line in `apps/web/next.config.ts`.

### 10.10 Read-replica next-five pickup

- **Source:** §5 above. Five specific procedures called out (`contractor.list`, `contract.list`, `invoice.list`, `payment.list`, `equipment.list`).
- **Pickup criteria:** the replica connection is provisioned per region (`DATABASE_URL_<REGION>_RO` env). Until then, the helper falls back to writer; the migration commit is harmless to land in advance.

---

## Pickup priority matrix

Use this matrix to slot work into future milestones. Priority is set by impact × current risk × cost.

| # | Recommendation | Priority | Effort | Blocked on |
|---|---|---|---|---|
| 1 | Worker scaling (min=2) | 🟠 CRITICAL | S (1d) | Audit of cron-job idempotency under double-fire |
| 6 | Better Auth `secondaryStorage` | 🟠 CRITICAL | S (1d) | None — Upstash already provisioned |
| 4 | Unleash HA per region | 🟠 CRITICAL | S (1d) | None |
| 9 | SLO/SLI starter set | 🟠 CRITICAL | M (3d to wire monitors) | None — every signal exists |
| 3 | ClamAV redundancy (Option A async) | 🟠 CRITICAL | M (3-5d, UX touch) | UX sign-off on intermediate "scanning" state |
| 7 | OpenTelemetry → Axiom | 🟢 IMPORTANT | M (3d) | Maintainer accepts ~$200-300/mo cost |
| 5 | Read-replica next-five | 🟢 IMPORTANT | M (5x small commits) | Replica connection provisioned per region |
| 8 | CDN in front of Render | 🟢 IMPORTANT | M (2-4d incl DNS + soak) | Cloudflare account; DNS authority |
| 2 | PDF/export worker split | 🟢 IMPORTANT | M (3d) | Real PDF workload volume justifying split |
| 10.1 | RLS `CREATE POLICY` migration | 🟢 IMPORTANT | L (1-2w, DPO sign-off) | DB engineer + DPO review |
| 10.3 | Advisory-lock cleanup | 🟢 IMPORTANT | S (1h) | Maintainer confirms env unset in prod |
| 10.4 | Theme cookie sync | ⚪ NICE-TO-HAVE | S (1d) | UX decision on FOUC tolerance |
| 10.5 | next-themes nonce | 🟢 IMPORTANT | S (1d) | C.1.b 48h observation |
| 10.6 | Landing CDN headers | 🟢 IMPORTANT | S (1d) | §8 decision |
| 10.7 | `security.txt` domain + PGP | 🟢 IMPORTANT | S (1h) | Maintainer commits to disclosure path |
| 10.8 | Bundle-size chunk globs | ⚪ NICE-TO-HAVE | S (1d) | First CI run produces chunk report |
| 10.9 | R2 custom CDN domain | ⚪ NICE-TO-HAVE | S (1 line) | Decision to use custom CDN domain |

**Suggested order for the next milestone:** rows 1, 6, 4, 9 first (small effort, immediate safety/observability gains). Then 3 and 7 in parallel (independent work streams). 5 and 8 as the third wave once observability (#7) is producing traces for the latency wins to be measured.
