# Post-Deploy Monitoring Guide

**Owner:** Platform / on-call
**Status:** First-deploy operational playbook. Use end-to-end on day 0; revisit weekly for 30 days.
**Audience:** Maintainer babysitting the first production deploy of `contractor-ops`.
**Last reviewed:** 2026-05-17
**Companion docs:** [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md), [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md), [`RUNBOOK-PHASE-2-3-DEPLOY.md`](RUNBOOK-PHASE-2-3-DEPLOY.md), [`CACHE-CONTROL.md`](CACHE-CONTROL.md), [`N+1-AUDIT.md`](N+1-AUDIT.md), [`PERF-BUDGETS.md`](PERF-BUDGETS.md).

This document is the "what to watch" checklist for the **first** production deploy. It is organised by timescale (hot 15 minutes, warm 24 hours, steady week), then by tool (Sentry, Axiom, Cronitor, Render, Neon, Upstash), then by alert + escalation. The B.5 (advisory-lock cleanup) and C.1.c (CSP enforce flip) watch items are called out explicitly in §7 because both shipped without the staged dual-write / report-only soak the original plan reserved — see [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) header note for the rationale.

Concrete commands, env-var names, and `file:line` citations are inline. Dashboard URLs are templated with placeholders (`<your-axiom-org>`, `<app-domain>`) because each environment chooses its own subdomain.

---

## Table of contents

1. [Section 1 — First 15 minutes post-deploy (Hot phase)](#section-1--first-15-minutes-post-deploy-hot-phase)
2. [Section 2 — First 24 hours (Warm phase)](#section-2--first-24-hours-warm-phase)
3. [Section 3 — First week (Steady phase)](#section-3--first-week-steady-phase)
4. [Section 4 — Dashboards + saved queries per tool](#section-4--dashboards--saved-queries-per-tool)
5. [Section 5 — Alert thresholds](#section-5--alert-thresholds)
6. [Section 6 — On-call escalation runbook](#section-6--on-call-escalation-runbook)
7. [Section 7 — B.5 and C.1.c-specific watch items](#section-7--b5-and-c1c-specific-watch-items)
8. [Section 8 — Known limitations + tier-2 items still open](#section-8--known-limitations--tier-2-items-still-open)

---

## Section 1 — First 15 minutes post-deploy (Hot phase)

The first 15 minutes are when 80% of regressions surface. Stay logged into Render, Sentry, and Axiom side-by-side. Do not start anything else until this section is green.

### 1.1 Smoke test checklist (manual, in order)

Each item is one user-visible path. Run from a real browser (incognito for fresh session). Time-box: 8 minutes.

- [ ] **Login flow.** Open `https://<app-domain>/`, click "Sign in", enter test credentials. Expect 302 → `/dashboard`. No 5xx in DevTools network tab.
- [ ] **Dashboard load.** `/dashboard` renders without an error boundary. KPIs populate within 3s (these go through `dashboard.kpis`, the only replica-routed read today — see `packages/db/src/replica.ts` and `packages/api/src/routers/core/dashboard.ts:318`).
- [ ] **Create entity.** Create one contractor or one invoice via the UI. Verify the optimistic update lands; reload to confirm persistence.
- [ ] **File upload.** Upload a small PDF (< 1 MB) to an invoice. Confirm ClamAV scan returns "clean" within ~5s (synchronous today — see `INFRA-RECOMMENDATIONS.md` §3 for the async migration plan).
- [ ] **E-sign roundtrip.** Open any contract with an e-sign step, send to a test signer (use your own second email), open the signed-doc link, complete the signature. Confirm the audit log row appears in the contract detail page.
- [ ] **Logout.** Click sign out. Session cookie cleared; `/dashboard` redirects to `/`.

### 1.2 Health endpoint probe

The `/api/health` route (`apps/web/src/app/api/health/route.ts`) runs five probes (`database`, `redis`, `qstash`, `r2`, `backpressure`) with per-probe 1.5s timeout and 5s overall cap.

```bash
curl -sS https://<app-domain>/api/health | jq .
```

**Good response (HTTP 200):**

```json
{
  "status": "ok",
  "timestamp": "2026-05-17T...",
  "durationMs": 250,
  "probes": [
    { "name": "database",     "status": "ok", "durationMs": 40 },
    { "name": "redis",        "status": "ok", "durationMs": 15 },
    { "name": "qstash",       "status": "ok", "durationMs": 80 },
    { "name": "r2",           "status": "ok", "durationMs": 110 },
    { "name": "backpressure", "status": "ok", "durationMs": 5  }
  ]
}
```

**Failure modes (HTTP 503) and what they mean:**

| Failed probe | Meaning | First action |
|---|---|---|
| `database` | Neon writer unreachable from web pod | Check Neon status page; check `DATABASE_URL_EU` / `_ME` env in Render |
| `redis` | Upstash REST endpoint unreachable or token rotated | Verify `UPSTASH_REDIS_REST_URL` + `_TOKEN` in Render `app-shared` env group (`render.yaml:35`) |
| `qstash` | Upstash QStash unreachable (raw fetch, bypasses breaker — `apps/web/src/app/api/health/route.ts:146`) | Check Upstash status; transient = wait one probe cycle |
| `r2` | Cloudflare R2 HEAD failed and was not 404 (404 on canary key is treated as `ok`) | Check `R2_*` credentials; verify bucket exists |
| `backpressure` | One or more per-route Redis semaphores over `floor(max * 1.5)` (S3-4 · F-SCALE-19) | Check `saturated[]` array in body; throttle traffic to that route or scale web |

**`skipped` probes are NOT failures** — they only mean the relevant env vars are unset (intentional for preview/dev). In production every probe should be `ok`. If any probe reads `skipped` in prod, the env wiring is wrong.

Re-probe every 60s for 15 min. Render itself hits this on its healthcheck cycle — confirm "Live" status in the Render dashboard.

### 1.3 Render dashboard sweep

Per service in the Render console (web, landing, public-api, worker, cms, clamav, unleash-eu, unleash-me, cloudflared):

- [ ] **Deploy status:** "Live" (not "Deploying", "Failed", "Crashed").
- [ ] **Recent events tab:** No "Service restarted" within last 5 min of the deploy timestamp (one expected during cutover; multiple = boot loop).
- [ ] **Deploy log tail:** No stack traces, no `EADDRINUSE`, no Prisma client mismatch errors. Pino emits structured JSON; you are looking for `level: 50` (error) or `level: 60` (fatal) lines.
- [ ] **Resource metrics:** CPU + memory not pegged at 100% across the steady-state window.

Cron services (`cron-token-refresh` every 15 min, `cron-data-purge` daily 03:00 UTC, `cron-exchange-rates` daily 06:00 UTC — `render.yaml:583-655`) have their own service entries; verify last-run status.

### 1.4 Sentry — new release scan

Filter: `release:<commit-sha>` (the Sentry release tag emitted by the build), time window: "Last 15 minutes".

- [ ] No new issue groups created in this window. If any appear:
  - Open the issue; check the stack frame is in your code (not a `node_modules` ghost).
  - Tag of interest: `requestId` (propagated end-to-end via `apps/web/src/middleware.ts` ALS — see commit `e7c86329` cited in `PRODUCTION-CHECKLIST.md` §4). Use it to pivot to the matching Axiom trace.
  - Decide: rollback, hotfix, or accept-and-monitor.

### 1.5 Axiom — log volume sanity check

Run the saved query `logs by level (last 15m)` (see §4 for the query template). Expected baseline shape for a healthy first deploy:

- `level=30` (info) — high volume, scales with request count.
- `level=40` (warn) — modest, mostly retries / rate-limit trips / CSP reports.
- `level=50` (error) — should be near-zero. Any spike compared to staging baseline = investigate.
- `level=60` (fatal) — **zero**. A single fatal = page on-call.

### 1.6 CSP violations — tail `/api/csp-report` log stream

C.1.c flipped CSP to enforce (no `'unsafe-inline'` in script-src) per `apps/web/src/middleware.ts:587` `attachCsp` — see [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) §5 header note. The 48h report-only soak was skipped because the app had no users to break, so the first production traffic is also the first time the enforce policy meets real browsers.

```axiom
service == "csp-report" and level == "warn" | last 15m
```

- [ ] Count = 0 unexpected violations. **Any violation is either a real attack or a missed allowlist entry.** Triage per §7.1.

---

## Section 2 — First 24 hours (Warm phase)

Now the surface area widens. Cron jobs have fired at least once. Real-user web vitals are landing. The DB pool has seen a full warm-up cycle.

### 2.1 Core Web Vitals per route

The `web-vitals-reporter.tsx` client component (`apps/web/src/components/perf/web-vitals-reporter.tsx`) beacons every metric to `/api/web-vitals` which emits a structured Pino log (`apps/web/src/app/api/web-vitals/route.ts:53`).

Target ranges (Google Core Web Vitals "good" thresholds):

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | ≤ 2.5 s | ≤ 4.0 s | > 4.0 s |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |
| TTFB | ≤ 800 ms | ≤ 1.8 s | > 1.8 s |
| FCP | ≤ 1.8 s | ≤ 3.0 s | > 3.0 s |

Per-route check (Axiom saved query `web vitals by route` in §4): for each of the top-10 dashboard routes, p75 of every metric should sit in "good". Routes that fall into "needs improvement" warrant a perf-project re-run.

### 2.2 Bundle size — confirm CI gate passed for this release

`@next/bundle-analyzer` + `size-limit` are wired (`apps/web/.size-limit.json`, see [`PERF-BUDGETS.md`](PERF-BUDGETS.md)). The CI bundle-size job must have passed for this commit:

```bash
gh run list --branch main --workflow ci.yml --limit 1
gh run view <run-id> --log | grep -iE "size-limit|bundle"
```

If the job did not run for this release, schedule a follow-up PR that re-triggers it; bundle drift compounds silently otherwise.

### 2.3 Rate-limit hit ratio (Upstash Redis)

Upstash Redis dashboard → "Metrics" tab.

- [ ] Request rate < 50% of plan ceiling.
- [ ] `RATELIMIT:*` key TTLs ticking down (alive). No `OOM` errors in the Upstash log.
- [ ] Better Auth route-level rate-limit trips (Axiom query, §4): expected baseline = single-digit trips/hour. A burst on `/sign-in/email` may indicate credential stuffing — see §6.

**Known multi-pod limitation:** Better Auth rate-limit state is **per-pod** today (in-memory), so with `minInstances: 2, maxInstances: 8` (`render.yaml:265-269`) the cluster-wide effective cap is up to 8× the configured value. Fix is `secondaryStorage` (Upstash) — see [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §6.

### 2.4 DB connection pool (Neon EU + ME)

Neon console → each project (EU, ME) → "Monitoring" tab.

- [ ] Active connections < 80% of plan ceiling.
- [ ] No spike correlated with the cron-job ticks (15 min boundary).
- [ ] Slow-query log: investigate anything > 500 ms p95 on hot tables (contractors, contracts, invoices, audit_log).

**Note:** `connection_limit` per-service URL tuning is still outstanding ([`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) §6). Until then, a single misbehaving worker pod can starve the writer pool. Watch worker logs for `Connection terminated unexpectedly` warnings.

### 2.5 Background-job latency

QStash dashboard:

- [ ] Queue depth ≤ 100 per topic in steady state.
- [ ] Dead-letter rate < 1% of dispatched messages.
- [ ] Per-topic p95 latency < 30 s (most jobs are sub-second; outliers indicate worker pod saturation).

Worker pod (`render.yaml:431-444` — single instance today; SPOF documented in `INFRA-RECOMMENDATIONS.md` §1): tail logs for the per-cron heartbeat lines emitted by `packages/api/src/services/cron-monitor.ts:67`.

### 2.6 Cron heartbeats (Cronitor)

Cronitor dashboard → "Monitors":

- [ ] `cron-token-refresh` — pinged within last 15 min.
- [ ] `cron-data-purge` — pinged at 03:00 UTC last night (if 24h window crosses 03:00).
- [ ] `cron-exchange-rates` — pinged at 06:00 UTC last morning (if 24h window crosses 06:00).
- [ ] Any worker-side cron registered in `apps/web/worker-cron.mjs` — pinged at expected cadence.

### 2.7 Audit log volume per organisation

The `writeAuditLog` helper is the single canonical write path (lint guard `scripts/lint-audit-log.mjs` enforces this — [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) §14). Sanity:

```sql
-- Run in Neon SQL editor against the EU writer.
SELECT organization_id, COUNT(*) AS rows_24h
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY organization_id
ORDER BY rows_24h DESC
LIMIT 20;
```

Expectation for first deploy with a single test tenant: 10s-100s of rows. Zero rows = the helper isn't firing on user actions; investigate before paid traffic.

### 2.8 Lint guard surface in CI

Verify the four production-hardening lint guards fire on any new PR opened in the past 24h:

- `scripts/lint-audit-log.mjs` — direct `auditLog.create` forbidden outside helper.
- `scripts/lint-raw-fetch.mjs` — raw `fetch` forbidden in adapter/service paths without `// resilience: raw-fetch-OK` annotation.
- `scripts/lint-idempotency.mjs` — hand-rolled idempotency keys forbidden outside `deriveIdempotencyKey`.
- `scripts/lint-silent-catch.mjs` — silent catch blocks forbidden in adapter/service/route paths.

A drop in lint-failure noise across PRs is normal — guards work. A spike of `// resilience: raw-fetch-OK` annotations being added is the early signal of a new raw-fetch site that bypasses the resilience layer; review each.

---

## Section 3 — First week (Steady phase)

Trends matter more than spot checks now. Build baselines you will alert against later.

### 3.1 p95 latency per service vs SLO

The SLO starter set is documented in [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §9. Restated for monitoring:

| Service | p95 target | Source |
|---|---|---|
| Web availability | 99.9% / 30d | Cronitor `/api/health` |
| Web p95 latency | ≤ 500 ms | Axiom HTTP log percentile |
| Web p99 latency | ≤ 1500 ms | Axiom HTTP log percentile |
| Public API availability | 99.95% / 30d | Cronitor `/health` (note: public-api exposes `/health`, not `/api/v1/health` — `apps/public-api/src/app.ts:81`) |
| Public API p95 latency | ≤ 200 ms | Axiom HTTP log percentile |
| tRPC mutation success | 99.5% / 30d | Axiom log count where `level=error` |
| Worker job success | 99% / 30d | Cronitor cron success rate |
| `/sign-in/email` p95 | ≤ 800 ms (excl. CAPTCHA) | Axiom |

### 3.2 Error-budget burn rate

For each SLO, compute weekly burn: actual error minutes ÷ monthly budget. Example: web availability 99.9% = 43 min/month budget; if week 1 burned > 11 min (25% of monthly budget), the trajectory is bad.

Wire Axiom monitors per [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §9: page at 50% burn over 1h, warn at 25% burn over 6h.

### 3.3 Bundle drift

Re-run `pnpm size-limit` locally against the deployed commit and compare to last week:

```bash
pnpm --filter @contractor-ops/web size-limit
```

Any chunk that grew > 10% week-over-week deserves a PR-level investigation. The current budget is global; per-chunk tightening is a tier-2 follow-up ([`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §10.8).

### 3.4 Sentry release health

Sentry → Releases → current release.

- [ ] Crash-free sessions ≥ 99.5%.
- [ ] Crash-free users ≥ 99%.
- [ ] No regression vs previous release (week-over-week, once you have one).

### 3.5 N+1 audit refresh

Re-run the perf project (`e2e/playwright.perf.config.ts`) against staging mirroring the first week of prod load:

```bash
pnpm run test:perf
```

Compare results to the baseline in [`N+1-AUDIT.md`](N+1-AUDIT.md). Any new procedure entering the top-10 by request count is a candidate for read-replica routing ([`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §5).

### 3.6 Organisation-cache hit rate

The 5-minute org cache landed in commit `c6b59148` ([`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) §7) and lives in the dashboard layout. Upstash Redis → key inspector, filter by the org-cache prefix:

- [ ] Hit rate > 80% after week 1 (one org repeatedly visiting their dashboard).
- [ ] TTL distribution: most keys < 5 min remaining; no zombies.

### 3.7 Better Auth rate-limit effectiveness (multi-pod check)

If web has scaled past 2 pods in the past week, the per-pod amplification ([§2.3](#23-rate-limit-hit-ratio-upstash-redis)) is now multiplied. Confirm whether any IP has hit `/sign-in/email` more than 10 times in a minute from a single source IP (Axiom query, §4). If yes, the per-pod cap was bypassed in aggregate — promote the `secondaryStorage` migration ([`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §6) into the next milestone.

---

## Section 4 — Dashboards + saved queries per tool

Save every query below into the respective tool's saved-queries / dashboards collection. Naming convention: `cops-<tool>-<purpose>`.

### Sentry

Project filters (one per Render-deployed runtime):

- `https://<sentry-org>.sentry.io/issues/?project=<project-id>&query=is:unresolved` — web app.
- Same URL pattern for: `landing`, `public-api`, `worker`, `cms`.

Alert rules to create:

| Alert | Condition | Action |
|---|---|---|
| Error volume spike | `events > 10 in 1 min` on web project | Slack `#ops` |
| New issue in release | `is:new` AND `release:<sha>` within 1h of deploy | Slack `#ops` + email on-call |
| Crash-free sessions dip | `crash_free_sessions < 99%` over 1h | Page on-call |
| New issue in worker | `is:new` on worker project | Slack `#ops` |

### Axiom

Replace `<dataset>` with `AXIOM_DATASET` env value (`render.yaml:162-165`).

**Logs by level + service (last 1h)**

```axiom
['<dataset>']
| where _time > ago(1h)
| summarize count() by level, service
| order by count_ desc
```

**tRPC procedure latency p95 (last 24h)**

```axiom
['<dataset>']
| where _time > ago(24h)
| where isnotnull(trpc_procedure)
| summarize p95 = percentile(duration_ms, 95), p99 = percentile(duration_ms, 99), n = count() by trpc_procedure
| order by p95 desc
```

**CSP violations by `blocked-uri` (last 24h)**

```axiom
['<dataset>']
| where _time > ago(24h)
| where service == "csp-report"
| summarize count() by ['csp.blocked-uri'], ['csp.violated-directive']
| order by count_ desc
```

**Web Vitals per route (last 24h)**

```axiom
['<dataset>']
| where _time > ago(24h)
| where service == "web-vitals"
| extend route = tostring(parse_url(webVital.url).Path)
| summarize lcp_p75 = percentile(webVital.value, 75) by route, webVital.name
| where webVital.name in ("LCP", "INP", "CLS", "TTFB", "FCP")
| order by route asc
```

**Trace a single request by requestId**

```axiom
['<dataset>']
| where requestId == "<paste-uuid>"
| order by _time asc
```

(`requestId` is the ALS-propagated id from `apps/web/src/middleware.ts:484-508`.)

**Per-pod rate-limit trips**

```axiom
['<dataset>']
| where _time > ago(6h)
| where event == "rate-limit-trip"
| summarize count() by route, ip, pod_id
| where count_ > 5
```

### Cronitor

Monitors to confirm exist + are paging the right channel:

- `web-health` — pings `/api/health` every 60s; alert after 2 consecutive failures.
- `public-api-health` — pings `/health` (not `/api/v1/health` — `apps/public-api/src/app.ts:81`).
- `cron-token-refresh` — heartbeat expected every 15 min ± 2 min.
- `cron-data-purge` — heartbeat expected 03:00 UTC daily ± 5 min.
- `cron-exchange-rates` — heartbeat expected 06:00 UTC daily ± 5 min.
- One monitor per `node-cron` job registered in `apps/web/worker-cron.mjs` (read the file to enumerate; one Cronitor monitor per `cron.schedule` call).

Per-monitor alert threshold defaults: 2 missed heartbeats → Slack, 4 missed → page.

### Render

- Deploy log retention: default 7 days. Manually download logs of suspicious deploys to long-term storage before they age out.
- Service event log per service: subscribe to "Failed deploy", "Restart", "Scale event" notifications via the Render dashboard's notification settings.

### Neon

- **Connection count panel** per project (EU + ME): line graph of `connections_used` vs plan ceiling. Saturate at 80% = warn, 95% = page.
- **Slow query log:** Neon console → "Monitoring" → "Slow queries". Anything > 500 ms p95 on a hot table.
- **Backup status:** Neon manages PITR automatically; confirm last snapshot timestamp < 24h old in the console. Retention is per the Neon plan tier; document the actual retention window in `docs/BACKUP-POLICY.md` (still outstanding per [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) §13).

### Upstash

- **Redis ops/sec + memory used:** Upstash console → Redis DB → "Metrics".
- **Cache hit-rate per key pattern:** Upstash analytics (paid feature) or `INFO stats` periodically via the REST API; track `keyspace_hits / (keyspace_hits + keyspace_misses)`.
- **QStash queue depth per topic:** Upstash console → QStash → topic list. Saturate at 100 messages backlog.

---

## Section 5 — Alert thresholds

Single source of truth for "what triggers what". Wire each into the respective tool's alert UI; export as code when [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §10's "dashboards as code" item lands.

### Latency thresholds

| Surface | p95 warn | p95 page | Window |
|---|---|---|---|
| Web HTTP | 500 ms | 1 000 ms | 10 min |
| Public API HTTP | 200 ms | 500 ms | 10 min |
| `/sign-in/email` (excl. CAPTCHA) | 800 ms | 2 000 ms | 10 min |
| `/api/health` probe (per probe) | 1 000 ms | 1 500 ms (cap) | 1 min |

### Error-rate thresholds

| Surface | Warn | Page | Window |
|---|---|---|---|
| HTTP 5xx (any service) | > 0.5% | > 1.0% | 10 min |
| tRPC mutation failure | > 0.5% | > 1.5% | 10 min |
| QStash dead-letter | > 0.5% of dispatched | > 1.0% | 1 h |
| Sentry new-issue rate | > 5 / 5 min | > 20 / 5 min | rolling |

### Infrastructure thresholds

| Resource | Warn | Page |
|---|---|---|
| Health probe consecutive failures | 1 | 2 |
| Neon connections used | > 60% of plan | > 80% of plan |
| Upstash Redis ops/sec | > 70% of plan | > 90% of plan |
| ClamAV pserv disk (`render.yaml:475` — 5 GB persistent disk) | > 70% | > 80% |
| Web pod CPU sustained | > 70% for 10 min | > 90% for 10 min |
| Worker pod memory sustained | > 75% for 10 min | > 90% for 10 min |

### Auth thresholds

| Surface | Warn | Page |
|---|---|---|
| Rate-limit rejection on `/sign-in/email` | > 5% of requests / 5 min | > 10% / 5 min |
| Account-lockout firings | > 10 / hour | > 50 / hour |
| Cluster-wide auth failures from single IP | > 20 / 5 min | > 50 / 5 min |

### CSP thresholds (post-C.1.c)

| Surface | Warn | Page |
|---|---|---|
| `/api/csp-report` POST rate | > 1 / min sustained 10 min | > 10 / min |
| Unique `blocked-uri` values per hour | > 3 distinct | > 10 distinct |

Copy-paste snippet for the Axiom monitor expression behind the web-p95 warn:

```axiom
['<dataset>']
| where _time > ago(10m)
| where service == "web" and isnotnull(http_status)
| summarize p95 = percentile(duration_ms, 95)
| where p95 > 500
```

---

## Section 6 — On-call escalation runbook

For each common alert: what it means, first diagnostic step, common causes, mitigation, and the wake-vs-self-heal decision. Pair this section with the deploy runbook ([`RUNBOOK-PHASE-2-3-DEPLOY.md`](RUNBOOK-PHASE-2-3-DEPLOY.md)).

### Alert: `/api/health` failing — `database` probe

- **Meaning:** Neon writer unreachable from web pod for > 1.5 s.
- **First diagnostic:** Axiom — `service == "web" and level >= 40 and msg has "prisma"` last 10 min. Check Neon status page.
- **Common causes:** Neon planned maintenance, regional Cloudflare incident, rotated `DATABASE_URL` not propagated to Render.
- **Mitigation:** Restart web service (forces fresh Prisma client). If Neon is down, accept: no app-side mitigation.
- **Wake on-call:** Yes, immediately. App is unusable.

### Alert: `/api/health` failing — `backpressure` probe

- **Meaning:** Per-route Redis semaphore depth > `floor(max * 1.5)` (S3-4 · F-SCALE-19 in `apps/web/src/app/api/health/route.ts:163-195`).
- **First diagnostic:** Inspect `saturated[]` in the failing 503 body — names the offending `routeKey`, depth, threshold.
- **Common causes:** Traffic burst, a slow downstream (R2, ClamAV) backing up the route.
- **Mitigation:** Scale web up one notch via Render; if a specific route is hot, consider disabling its feature flag.
- **Wake on-call:** Yes if persists > 5 min; auto-recovers in many cases.

### Alert: Sentry — new-issue spike in release

- **Meaning:** New error groups landed within 1 h of deploy.
- **First diagnostic:** Sentry issue list, sort by `firstSeen`, filter `release:<sha>`. Use `requestId` tag to pivot to Axiom for full request trace.
- **Common causes:** Edge-case regression, missing env var in prod, schema drift.
- **Mitigation:** Rollback via Render "redeploy previous commit" if > 5 unique new groups or any fatal; hotfix-forward for single-group issues with a clear cause.
- **Wake on-call:** Yes if fatal or affects > 1% of sessions.

### Alert: QStash dead-letter rate > 1%

- **Meaning:** Worker is failing to consume queued jobs.
- **First diagnostic:** Worker pod logs — recent stack traces. QStash dashboard — dead-letter topic contents.
- **Common causes:** Worker code regression, downstream API outage, QStash signing-key mismatch.
- **Mitigation:** Restart worker. If a specific job class is failing, disable its enqueue via feature flag; replay later.
- **Wake on-call:** Yes if backlog > 1000 messages or aging > 1 h.

### Alert: Cron heartbeat missed (Cronitor)

- **Meaning:** Worker pod did not ping Cronitor at expected cadence.
- **First diagnostic:** Render → worker service → "Live" status. `packages/api/src/services/cron-monitor.ts` emits the heartbeat; check logs for `cronitor` keyword.
- **Common causes:** Worker single-pod restart mid-tick (SPOF — see [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §1), `CRONITOR_API_KEY` rotated.
- **Mitigation:** Restart worker. Confirm next tick fires.
- **Wake on-call:** Only if > 2 consecutive ticks missed; otherwise self-heals.

### Alert: Better Auth rate-limit rejection > 10% on `/sign-in/email`

- **Meaning:** Either credential-stuffing attack or a legitimate-user flood from a single IP (corporate NAT).
- **First diagnostic:** Axiom query `per-pod rate-limit trips` (§4) — distinct IPs vs concentrated IP.
- **Common causes:** Bot attack; corporate proxy with shared IP.
- **Mitigation:** Block IP at Render/Cloudflare layer if attack. Increase rate-limit window for the corporate case (per-account lockout still protects credentials).
- **Wake on-call:** Yes if from single IP at sustained > 50 req/min.

### Alert: CSP violation rate > 10/min

- **Meaning:** Either a real injection attempt or a deploy that re-introduced an inline `<script>` / missing nonce.
- **First diagnostic:** Axiom `CSP violations by blocked-uri` (§4). If `blocked-uri` is an origin you serve, it's a missed allowlist; if `inline`/`unsafe-inline`, a regressed script.
- **Common causes:** Deploy re-introduced inline script; third-party widget added without CSP allowlist update.
- **Mitigation:** Rollback the offending deploy. Patch the source (add nonce, add allowlist entry, or move script to a hashed file).
- **Wake on-call:** Yes — CSP enforce regression silently breaks UI.

---

## Section 7 — B.5 and C.1.c-specific watch items

Both shipped without the staged dual-write / report-only soak the original plan reserved. Compensate with longer observation post-deploy.

### 7.1 C.1.c — CSP enforce (no `'unsafe-inline'` in script-src)

**Shipped:** commit `49180904`, header emitted per-request from `apps/web/src/middleware.ts:587` (`attachCsp`) with a fresh nonce. Static `Content-Security-Policy` entry removed from `apps/web/next.config.ts` in the same commit.

**Watch for 7 days post-deploy:**

- Tail `/api/csp-report` (route handler: `apps/web/src/app/api/csp-report/route.ts`). The endpoint accepts both legacy (`application/csp-report`) and modern (`application/reports+json`) shapes and logs each violation at `warn` level via Pino to Axiom, plus adds a Sentry breadcrumb.
- Axiom saved query `CSP violations by blocked-uri (last 24h)` (§4).
- **Triage rule per violation:**
  - **`blocked-uri` is a domain you serve (e.g. `https://<app-domain>`):** missed allowlist entry. Patch the CSP in `apps/web/src/middleware.ts` and ship a fix.
  - **`blocked-uri` is `inline` / `eval` / `unsafe-inline`:** a script regressed without a nonce. Either fix the source (preferred) or land a hash-based exception.
  - **`blocked-uri` is a known third party (e.g. DocuSign, font CDN):** add to the appropriate `*-src` directive.
  - **`blocked-uri` is unknown / suspicious origin:** treat as a real attack signal — pivot Axiom by `userAgent` + source IP, investigate.
- **Acceptance:** if after 7 days the violation rate is < 0.1 / min and every observed `blocked-uri` has been triaged, close the watch.

### 7.2 B.5 — Advisory-lock dual-hold shim removal

**Shipped:** the `ADVISORY_LOCK_TRANSITION_DUAL_HOLD` env was never set in any environment and the shim was dead code (per [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) header note). The single-arg-form fallback was removed.

**Watch for 7 days post-deploy:**

- **`pg_locks` snapshot — any orphaned locks held > 5 min?**

  ```sql
  -- Run in Neon SQL editor against the EU writer (repeat for ME).
  -- safe-raw-sql: operator query against system catalogs, no tenant dimension.
  SELECT
    classid,
    objid,
    pid,
    mode,
    granted,
    NOW() - state_change AS held_for
  FROM pg_locks l
  LEFT JOIN pg_stat_activity a USING (pid)
  WHERE l.locktype = 'advisory'
    AND NOW() - a.state_change > INTERVAL '5 minutes'
  ORDER BY held_for DESC;
  ```

  Expected: zero rows. Any row indicates a job that held the lock past its expected duration — investigate the corresponding worker logs, decide rollback vs forward-fix.

- **Worker job duration p95 stays within baseline.** For each job that uses `withAdvisoryLock` (enumerate via grep on `packages/api/src/lib/advisory-lock.ts` callsites), compare current p95 to the staging baseline. Single-arg-form removal should be transparent; any latency regression means the two-arg form's `classid` namespacing exposed a hash collision or contention pattern.

- **Acceptance:** if after 7 days `pg_locks` snapshot is consistently empty and job p95 latencies are within baseline ± 10%, close the watch.

---

## Section 8 — Known limitations + tier-2 items still open

Cross-reference [`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §10 for the full tier-2 backlog. Items that affect what you can monitor automatically (until they land, the manual checks below are mandatory):

| Limitation | Manual check until automation lands |
|---|---|
| **Single worker pod (SPOF)** — `render.yaml:431-444`, no `scaling:` block. INFRA-REC §1 proposes `minInstances: 2`. | Watch Cronitor heartbeat tab daily for missed ticks during deploy windows. |
| **OpenTelemetry not wired** — INFRA-REC §7. Today end-to-end traces don't exist; correlate by `requestId` post-hoc. | Use the Axiom `Trace a single request by requestId` saved query (§4) and walk hops by hand. |
| **`secondaryStorage` not enabled for Better Auth rate-limit** — INFRA-REC §6. Per-pod amplification means cluster cap is up to 8× configured value. | Weekly Axiom check for any single IP exceeding 10× the per-pod cap on `/sign-in/email`. |
| **No CDN in front of `web`** — INFRA-REC §8. Origin TTFB dominated by Render Frankfurt round trip. | Track LCP p75 by user-geo via Web Vitals query (§4); migrate users complaining of non-EU latency into a CDN-adoption case. |
| **ClamAV redundancy** — `render.yaml:461-475`, single pserv. INFRA-REC §3 proposes async-via-QStash. | Watch upload failure rate; daily check that the ClamAV pserv has not OOM-restarted. |
| **No `connection_limit` tuning per service** — PRODUCTION-CHECKLIST §6. Worker pod can starve writer pool. | Weekly Neon connection-count check; correlate spikes to worker job timings. |
| **No SLO doc / monitors wired** — INFRA-REC §9 + PRODUCTION-CHECKLIST §4. SLOs in §3 above are targets, not yet enforced. | Manually compute weekly error-budget burn from Axiom + Cronitor data; track in a spreadsheet. |
| **No formal RUNBOOK.md** — PRODUCTION-CHECKLIST §9. This guide + the deploy runbook are the de-facto runbook until consolidated. | Treat §6 as the on-call playbook; promote to `docs/RUNBOOK.md` when the blocker is cleared. |
| **No tested restore drill / RPO-RTO** — PRODUCTION-CHECKLIST §13. Neon PITR is provider-managed but unexercised. | Schedule a restore drill against a staging Neon branch within 30 days of first prod traffic; capture timing + outcome. |
| **Lighthouse CI not gated** — PRODUCTION-CHECKLIST §8. Web Vitals field data lands via the beacon (§2.1) but no CI synthetic. | Manual Lighthouse run weekly against staging top-10 routes; compare to previous week. |

---

## Closing checklist

After 30 days of clean operation (no SLO miss, no rollback, no security incident):

- [ ] Promote this guide to `docs/RUNBOOK.md` (or split into runbook + monitoring guide).
- [ ] Re-evaluate every "warn" / "page" threshold against actual data — most will be too tight or too loose on first wiring.
- [ ] Schedule the next milestone with the top-3 tier-2 follow-ups from §8 ([`INFRA-RECOMMENDATIONS.md`](INFRA-RECOMMENDATIONS.md) §10 priority matrix recommends rows 1, 6, 4, 9).
- [ ] Capture lessons in a post-launch retrospective; link from [`PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md).
