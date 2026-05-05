# Next-Phase Fix Plan

**Date:** 2026-05-03 (post-Tier-1)
**Tier 1 status:** 30 commits landed, ~28 findings closed, all green.
**Remaining:** ~101 findings — 26 architectural (Phase 2), ~75 sweeps (Phase 3).

---

## Phase 2 — Architectural fixes (need design before code)

Six work units. Each starts with a 15–30 min design discussion (file in `.planning/`), then 1–2 fixer agents per unit. Total Phase 2 effort: **~5–7 working days**, parallelizable to **~2–3 wall-clock days** under 6 concurrent agents after designs are signed off.

### Unit P2-A — Outbox + canonical enqueue + notification correctness
**Goal:** Stop losing notifications on crash; stop double-firing on retry; one canonical "enqueue" helper.
**Findings:** F-ASYNC-02, F-ASYNC-03, F-ASYNC-04, F-ASYNC-05, F-ASYNC-06, F-ASYNC-07, F-ASYNC-08, F-ASYNC-09, F-ASYNC-12, F-ASYNC-15, F-ASYNC-16, F-ASYNC-18, F-DB-23, F-SCALE-05.
**Touches:** new `OutboxEvent` table + processor route, `notification-service.ts`, all `dispatch().catch(_=>{})` callsites (~12), `qstash-client.ts`, every `_process`/`_sync` route (return code mapping), reminders/trial cron locks.
**Effort:** L (largest unit — ~2 days under 2 fixers).
**Open Qs:** schema shape (single typed `OutboxEvent` table vs per-event-type tables), polling cadence (QStash schedule every 30s vs LISTEN/NOTIFY), replay/retention window, single processor or per-org sharding.

### Unit P2-B — Resilience layer (timeouts, retries, breakers, idempotency)
**Goal:** Eliminate the "no idempotency key + no breaker + custom retry loop" pattern across providers.
**Findings:** F-INT-03, F-INT-04, F-INT-05, F-INT-06, F-INT-11, F-INT-13, F-INT-14, F-INT-15, F-INT-17, F-INT-18, F-INT-20, F-INT-21, F-INT-22.
**Stack decision:** **`opossum` 9 + `p-retry` + `p-limit`** (per `MARKET-SCAN.md`). Opossum for circuit breaker (Red Hat–backed, active 9.x line); p-retry for exponential backoff with jitter; p-limit for per-origin concurrency cap (bulkhead). Cockatiel rejected: stale release pipeline. Roll-our-own rejected: poor leverage on a critical reliability primitive.
**Touches:** new `packages/integrations/src/services/resilience.ts` exporting `withResilience(call, { provider, breaker, retry, limit })` (~30 LOC glue), `fetch-helpers.ts` (error classification helper for retryable vs permanent), Stripe + Storecove + InPost + Resend + DocuSign call sites (idempotency-key threading via `Idempotency-Key` header or QStash `Upstash-Deduplication-Id`), KSeF/Anthropic/Autenti/DocuSign SDK wrappers (AbortController), Storecove/Resend webhook unique indexes.
**Effort:** L (~1.5 days under 2 fixers).
**Settled (was open):**
- Library = opossum 9 + p-retry + p-limit ✓
- Breaker state = per-process Map (not Redis — cold-start retries cheaper than Redis RTT per call)
- Per-provider config table lives in `packages/integrations/src/services/resilience-config.ts`
- Idempotency key = `sha256(\`${orgId}:${businessKey}:${operation}\`)` server-derived, never client-supplied

### Unit P2-C — Defense-in-depth + DB hot paths
**Goal:** Plug remaining tenant-isolation gaps; remove EU-primary lookup tax on every request; fix in-memory-pagination OOMs.
**Findings:** F-DB-03 (cross-region cache), F-DB-04 (RLS defense), F-DB-05 + F-DB-12 (compliance gaps in-memory), F-DB-06 + F-DB-07 + F-DB-08 (sequential awaits in transactions).
**Touches:** `tenantMiddleware` (Redis cache layer + RLS session SET), `withRlsSession` wiring, `compliance/report-helpers.ts` rewrite to cursor-stream, workflow `instantiateTaskRuns` → `createMany`, contract `bulkTransition` → batched audit, equipment courier mutations → grouped writes.
**Effort:** M (~1 day under 1–2 fixers).
**Open Qs:** RLS approach (full Postgres `CREATE POLICY` vs `SET LOCAL app.org_id` + extension guard), cross-region cache TTL (5m? 15m?), invalidation on org update.

### Unit P2-D — OAuth + file-upload security
**Goal:** Close residual auth-surface gaps from the Tier-1 sweep.
**Findings:** F-SEC-05 (OAuth state ↔ session binding), F-SEC-21 (state replay), F-SEC-17 (XFF rightmost-trusted), F-SEC-18 (MIME sniffing on confirmUpload), F-SEC-19 (per-content-type max bytes), F-SEC-22 (signup email enumeration).
**Touches:** `oauth-state.ts` (cookie + nonce or DB challenge row), all OAuth callback routes (cookie verify), `apps/web/src/middleware.ts` (XFF parsing), `confirmUpload` (file-type sniff + delete-on-mismatch), Better Auth `before` hook on signup.
**Effort:** M (~1 day under 1–2 fixers).
**Open Qs:** stateless HMAC nonce (no DB, simplest) vs `OAuthChallenge` table (single-use guarantee). MIME sniff: synchronous on confirm vs async via QStash + quarantine.

### Unit P2-E — Observability propagation
**Goal:** End-to-end traceability of "user click → tRPC → service → DB → outbound HTTP → QStash → consumer". No more incidents you can't follow.
**Findings:** F-OBS-02 (requestId via AsyncLocalStorage), F-OBS-03 (QStash traceparent header + consumer ingestion), F-OBS-06 (outbound HTTP duration/status — wrap `fetchWithTimeout`), F-OBS-07 (health check actually checks DB/Redis/QStash/R2), F-OBS-08 (Sentry `beforeSend` PII scrub), F-OBS-09 (auth-route observability), F-OBS-10 (Prisma slow-query log + warn threshold).
**Touches:** `packages/logger/src/request-context.ts` (new ALS module), `packages/api/src/middleware/observability.ts` (seed ALS), `qstash-client.ts` (inject `traceparent`/`requestId` headers), QStash consumer routes (read & seed), `fetch-helpers.ts` (log entry/exit), `apps/web/src/app/api/health/route.ts` (real probes), Sentry config, Prisma client init.
**Effort:** L (~1.5 days under 2 fixers).
**Open Qs:** ALS overhead acceptable in serverless? (Yes, used in many Next.js apps.) Use W3C `traceparent` or custom `x-request-id` everywhere.

### Unit P2-F — Async exports + sync work offload
**Goal:** Remove all blocking sync work from request path; bound exports.
**Findings:** F-SCALE-01 (5 unbounded report exports → R2 + email link), F-SCALE-02 (3 sync PDF generators → QStash), F-SCALE-04 (dashboard layout cache + RSC parallel fetch), F-SCALE-08 (CSV streaming), F-SCALE-11 (dashboard.kpis singleflight + Redis cache), F-SCALE-12 (dashboard widget query batching).
**Touches:** new `apps/web/src/app/api/exports/_process/route.ts` (QStash consumer that writes R2 + emails link), all 5 `report.export*` mutations, classification document SDS/DRV/GDPR PDF routes, `apps/web/src/app/[locale]/(dashboard)/layout.tsx`, `dashboardKpis` route + dashboard widget components.
**Effort:** L (~1.5 days under 2 fixers).
**Open Qs:** export framework — single typed registry vs ad-hoc per route. Email link delivery: Resend with signed R2 URL valid 7d. Cache invalidation triggers for dashboard.

---

## Phase 3 — Sweeps (parallel-agent batchable)

**Total ~75 findings**, mostly contained MEDIUM/LOW items. Estimated **~1–2 wall-clock days** under 4 concurrent agents. Group by file area to avoid agent collisions.

### Sweep S3-1 — DB hygiene (~17 items)
F-DB-09, F-DB-10, F-DB-11, F-DB-13, F-DB-14, F-DB-15, F-DB-16, F-DB-17, F-DB-18, F-DB-19, F-DB-20, F-DB-21, F-DB-22, F-DB-24, F-DB-25, F-DB-26, F-DB-27, F-DB-28.
Pagination caps on remaining list endpoints, missing indexes (Session.expiresAt, IntegrationConnection unique, SigningEnvelope.externalEnvelopeId unique, Invoice (org, dueDate, paymentStatus)), soft-delete extension covering update/updateMany, query consolidation, file buffer out of payment-export tx.

### Sweep S3-2 — Integration nits (~7 items)
F-INT-07, F-INT-09, F-INT-12, F-INT-16, F-INT-23.
Generic webhook schema validation, calendar fan-out caps, Slack/Teams self-throttle, DocuSign URL TTL refresh, health-service dep surface.

### Sweep S3-3 — Observability hygiene (~8 items)
F-OBS-05 (audit log coverage on ~60 missing routers — biggest of the sweeps), F-OBS-11, F-OBS-12, F-OBS-13 (45 silent catch blocks), F-OBS-14, F-OBS-15, F-OBS-16, F-OBS-17, F-OBS-18.
Sentry user/org scope per request, RED metrics for HTTP routes, worker-cron PII redact, email plaintext fix, console.warn in e2e setup.

### Sweep S3-4 — Scalability nits (~10 items)
F-SCALE-06 (read replica routing — possibly Tier 2 if non-trivial), F-SCALE-07, F-SCALE-09, F-SCALE-10, F-SCALE-13, F-SCALE-14 (lazy adapter registration), F-SCALE-15, F-SCALE-16 (cardinality cap), F-SCALE-17 (request size limit), F-SCALE-19, F-SCALE-20 (Better Auth rate limiter).

### Sweep S3-5 — Async leftovers (~2 items)
F-ASYNC-14 (notification preferences org-scope), F-ASYNC-17 (queue depth metrics — overlaps with P2-E).

---

## Recommended sequencing

**Week 1:** Phase 2 designs + start P2-A (outbox) and P2-B (resilience) in parallel. These are the biggest and most impactful; everything else builds on them. P2-D (OAuth) is small enough to slot in alongside.

**Week 2:** P2-C (defense + DB hot paths), P2-E (observability), P2-F (async exports). Phase 3 sweeps in parallel toward end of week.

## Open design questions to answer before code

(Pick a default and proceed; flag in commits.)

1. **Outbox shape** (P2-A): single typed `OutboxEvent { id, organizationId, type, payload, status, attempts, nextAttemptAt, createdAt, processedAt }` table polled every 30s by a QStash schedule, vs typed event tables. **Recommendation:** single table — simpler, indexed correctly is fine for our scale.
2. ~~**Circuit breaker** (P2-B): roll our own vs `opossum` vs `cockatiel`.~~ **Settled:** opossum 9 + p-retry + p-limit. Red Hat backing + active 9.x release line + built-in event metrics that map cleanly to Pino/Sentry. See `MARKET-SCAN.md` § P2-B.
3. **OAuth state binding** (P2-D): `__Host-oauth_state` cookie + nonce in HMAC vs DB `OAuthChallenge` row. **Recommendation:** DB row. Costs one insert per OAuth start; gives true single-use replay protection (also closes F-SEC-21) and cleaner debug story than HMAC failure.
4. **RLS approach** (P2-C): full Postgres `CREATE POLICY` vs `SET LOCAL app.org_id` session variable + extension guard. **Recommendation:** `SET LOCAL` first (low effort, defense-in-depth). Full RLS is a separate quarter's work.
5. **Cross-region tenant cache** (P2-C): Upstash Redis with 5min TTL, key `org:${id}:meta`, invalidate on `Organization.update`. **Recommendation:** as stated.
6. **MIME sniffing** (P2-D): synchronous in `confirmUpload` (`file-type` npm — pulls 10KB head from R2). Reject + delete on mismatch. **Recommendation:** as stated; quarantine adds complexity.
7. **Async export framework** (P2-F): single typed registry — `defineExport({ type, query, columnsMapper, filename })` + one `/api/exports/_process` consumer + one `Export` table tracking status. **Recommendation:** as stated.
8. **requestId carrier** (P2-E): use W3C `traceparent` (already supported by Sentry, OTel-friendly) for cross-system; `x-request-id` for HTTP visibility. **Recommendation:** both — `traceparent` for trace correlation, `x-request-id` (UUID v7) as the human-readable ID in logs and error pages.
