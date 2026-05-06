# Runbook — Phase 2/3 Audit Deploy

**Last updated:** 2026-05-05
**Owner:** Platform / on-call
**Companion docs:**
- [`/contractor-ops-launch-checklist.md`](../contractor-ops-launch-checklist.md) — product launch gates (multi-tenancy, GDPR, payments)
- [`docs/PRODUCTION-CHECKLIST.md`](PRODUCTION-CHECKLIST.md) — operational checklist (CI/CD, observability, DR)
- [`docs/COMMIT-ATTRIBUTION.md`](COMMIT-ATTRIBUTION.md) — Phase 2/3 commits whose subject lines drift from their actual file content (lint-staged race side-effect)
- [`.audit-2026-05-03/`](../.audit-2026-05-03/) — nine deep audits the work below closes out

This runbook is the operational counterpart to those documents. **Read this before every Phase 2/3 deploy.** It distills the six-audit / three-tier work into the steps ops must run on the day. Aim to clear sections 1–5 in under thirty minutes.

---

## 1. Overview

The May 2026 production-readiness audit produced **129 findings** across six tracks (db performance, security, integrations resilience, async/notifications, observability, scalability). Remediation shipped in three tiers:

| Tier | Scope | Outcome |
|---|---|---|
| **Tier 1** | Security bleeds, money/data correctness, resilience quick wins | ~30 atomic commits, ~28 findings closed |
| **Phase 2** | Architectural — outbox, resilience layer, defense-in-depth, OAuth+upload, observability propagation, async exports | 6 work units, schema + service-layer changes |
| **Phase 3** | Sweeps — DB hygiene, integration nits, observability hygiene, scalability nits, async leftovers | ~75 mechanical fixes |

**Roll-up:** roughly **125 findings closed**, **~190 commits** on `main` since the audit, code green, all CI gates passing. The remaining work is **environmental + operational** — the surface this runbook covers.

The branches of unfinished work are summarized in §9 (Tier-2 follow-ups).

---

## 2. New environment variables introduced

Set every entry below in the deploy environment (Render dashboard, Infisical, or equivalent). Values that say *"Required-pre-deploy: yes (blocking)"* will prevent the app from booting cleanly or will fail-closed on the relevant code path. *"Graceful degradation"* means the feature degrades but the app still serves traffic.

| Name | Purpose | Where used | Default | Required pre-deploy | Notes |
|---|---|---|---|---|---|
| `PLATFORM_OPERATOR_ORG_ID` | UUID of the dedicated org whose members hold the `platform_operator` role; gates `/admin/*` (F-SEC-04). | `apps/web/src/lib/admin-auth.ts`, `packages/validators/src/env.ts` | unset → admin shell disabled | **Yes (blocking for admin shell)** | If unset, every `/admin/*` route 403s. Seed one org + assignment as part of bootstrap (see §4). |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key for signup bot protection (F-SEC-22). | Server-side rendering of signup form. | unset → widget renders inert | **Graceful degradation** | Pair with the public form below; both come from the same Turnstile site. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public twin of the above; ships to the browser. | Client-side widget. | unset → widget hidden | **Graceful degradation** | Public is OK by design — Cloudflare site keys are non-secret. |
| `TURNSTILE_SECRET_KEY` | Server-side verifier secret. **Fails closed in production** (`packages/auth/src/turnstile.ts`): if unset and `NODE_ENV=production`, signup is rejected. | Better Auth signup `before` hook. | unset → in dev returns ok; in prod rejects every signup | **Yes (blocking)** | Store in Infisical / Render env. Never commit. |
| `TRUSTED_PROXIES` | Comma-separated `proxy-addr` keywords or CIDRs treated as trusted hops when parsing `X-Forwarded-For` (F-SEC-17). | `apps/web/src/middleware.ts` | `loopback,linklocal,uniquelocal` (safe for Render direct) | **No, but verify** | If you front Render with Cloudflare, switch to Cloudflare's IP ranges. Wrong value = remote IP spoof for rate-limit bypass. |
| `R2_HEALTHCHECK_KEY` | Object key R2 probe reads to validate the bucket connection (F-OBS-07). | `apps/web/src/app/api/health/route.ts`, `packages/integrations/src/services/health-service.ts` | `_health/canary.txt` | **Yes (blocking for /api/health)** | Upload a small canary file under that key in **each region's** bucket before deploy. UptimeRobot/Cronitor pings will fail until this exists. |
| `INFISICAL_TOKEN_TTL_MS` | TTL for the cached Infisical machine-identity token; refresh kicks in 60 s before expiry (F-INT-10). | `packages/integrations/src/services/infisical-client.ts` | `3600000` (1 h) | **No** | Lower (e.g. `300000` = 5 min) only for rotation testing. |
| `EMAIL_FROM` | Sender for transactional email (Better Auth, portal magic link, notifications). | `packages/api/src/services/email/*`, Better Auth handlers (F-SEC-13). | `noreply@contractor-ops.com` | **Yes (blocking)** | Must match a verified Resend sender in the domain whose SPF/DKIM/DMARC are live. |
| `RESEND_API_KEY` | Resend API key for outbound email + inbound webhook auth (already documented). | `packages/api/src/services/email/*` | unset → email no-ops in dev | **Yes (blocking)** | Without it, signup verification, magic-link, invitation, password-reset all silently fail (F-SEC-13). |
| `DATABASE_URL_EU_RO` | EU Neon read-replica URL for read routing (F-SCALE-06, scaffolded). | `packages/db/src/index.ts` (read-replica routing helper, behind a flag). | unset → reads go to primary | **No (graceful degradation)** | Full rollout is Tier-2; without it, query procedures still work, just hit primary. |
| `DATABASE_URL_ME_RO` | ME Neon read-replica URL — twin of above. | Same. | unset → reads go to primary | **No (graceful degradation)** | Same as above; ME deploys without read-replica until Tier-2 lands. |
| `PRISMA_SLOW_QUERY_THRESHOLD_MS` | Threshold above which Prisma logs slow queries via Pino (F-OBS-10). | `packages/db/src/client.ts` | `200` | **No** | Tune up in production once traffic baseline known; do not disable. |
| `TRPC_MAX_BODY_MB` | JSON body cap on `/api/trpc` to mitigate DoS via giant payloads (F-SCALE-17). | `apps/web/src/app/api/trpc/[trpc]/route.ts` | `1` (MB) | **No** | Raise only if a documented use case demands it. |
| `BETTER_AUTH_SECRET` | Random secret seeding Better Auth's HMAC. | `packages/auth/src/config.ts` | unset → auth boot fails | **Yes (blocking)** | Already present pre-audit; verify it survived env migration. |
| `DOCUSIGN_EMBEDDED_URL_TTL_SECONDS` | TTL for re-issued embedded signing URLs (F-INT-16). | `packages/integrations/src/adapters/docusign-adapter.ts` | adapter default | **No** | Override only if customer signing flows hit the default expiry. |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Sentry destination — **F-OBS-08 PII scrubber assumes Sentry is wired**. | `apps/web/src/sentry.{client,server,edge}.config.ts` | unset → Sentry no-op | **Yes (blocking for observability)** | Without DSN, the `beforeSend` PII scrub is moot — but you also lose all error visibility. Verify in **all three runtimes** (server / client / edge). |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` endpoints; F-SEC-11 hardened the comparison so an empty value can no longer satisfy a length-bypass. | All cron routes + `exchangeRate.fetchDaily`. | unset → cron rejects with 401 | **Yes (blocking)** | Already documented; re-verify post-deploy. |

### Underdocumented in `.env.example` (flag for follow-up)

While distilling §2 we noticed three under-described entries in `.env.example` that ops would benefit from clarifying:

- **`R2_HEALTHCHECK_KEY`** is **not present** in `.env.example` despite being read by `apps/web/src/app/api/health/route.ts` and the integrations health service. Add a section explaining the canary-key pattern (one key per regional bucket) so deploys don't ship with a broken probe.
- **`TRPC_MAX_BODY_MB`** is **not present** in `.env.example`. The default of 1 MB is reasonable but ops should know it exists before they have to debug a "request too large" 413 in production.
- **`PRISMA_SLOW_QUERY_THRESHOLD_MS`**, **`DATABASE_URL_EU_RO`**, **`DATABASE_URL_ME_RO`** are **not present** in `.env.example`. They are referenced from `packages/db/src/client.ts` and `packages/db/src/index.ts` (the latter as a comment) — adding them with defaults removes a class of "is this even configurable?" support tickets.
- **`DOCUSIGN_EMBEDDED_URL_TTL_SECONDS`** is **not present** in `.env.example` despite being read by the DocuSign adapter.

These are documentation-only fixes; the code already handles unset gracefully. They are NOT in scope for this runbook (do not modify `.env.example` from this task per agent boundaries).

---

## 3. Schema migrations

Phase 2/3 introduced new models and constraints that must be applied to production before code is deployed:

**New models (Phase 2 / Phase 3):**
- `PendingUpload` — server-derived storage keys for direct uploads (F-SEC-01).
- `OAuthChallenge` — single-use OAuth state replay protection (F-SEC-05 / F-SEC-21).
- `Export` — async export framework (F-SCALE-01, F-SCALE-08).
- `OutboxEvent` — transactional outbox for at-least-once side effects (F-ASYNC-03).

**Field-level changes:**
- `Member.disabledAt` — per-membership soft-disable (replaces global ban, F-SEC-07).
- `Notification.dedupKey` + unique constraint — DB-enforced notification dedup (F-ASYNC-04).
- `WebhookDelivery.attempts` — retry-counter / DLQ surfacing (F-ASYNC-05).
- `WebhookDelivery.providerEventId` + `EInvoiceLifecycleEvent.providerEventId` — DB-enforced webhook event dedup (F-INT-13).

**Status:**
- **Dev** — applied via `pnpm db:push` (Prisma 7 generator output committed).
- **Production** — **BLOCKED** on the multi-region migration plan (per project memo, the multi-region rollout is a separate quarter's infra work and is explicitly out of scope here).

**Order of operations when production is unblocked:**

1. Run all reversible Prisma-managed migrations first (table creates, additive columns, additive indexes).
2. Run `scripts/sql-migrations/` raw SQL only for things Prisma can't express: partial unique indexes, `CREATE POLICY` (deferred to Tier-2), advisory-lock helpers, and the dedup unique constraints that depend on backfill order. **Read `scripts/sql-migrations/README.md` for the run order** — agent B-B1 owns that file.
3. Re-generate the Prisma client (`pnpm db:generate`) and redeploy the app simultaneously.

> The `scripts/sql-migrations/` directory is provisional — if it does not yet exist when this runbook is read, treat that as a pre-deploy blocker and pull B-B1's deliverable before continuing.

---

## 4. Pre-deploy checklist

Run this in order before every Phase 2/3 release. Skip none.

- [ ] All env vars in §2 set (or explicitly waived with a known graceful-degradation owner)
- [ ] R2 canary key uploaded — `_health/canary.txt` (or `R2_HEALTHCHECK_KEY` value) **in each regional bucket**: `R2_BUCKET_NAME_EU` and `R2_BUCKET_NAME_ME`
- [ ] Cloudflare Turnstile site provisioned (free tier OK), site + secret key threaded into env per §2
- [ ] Better Auth email handlers verified live: trigger a real signup against staging; `Verify your email` arrives within 60 s in Resend logs
- [ ] OAuth start cookie domain matches deployed origin — `__Host-` cookies require HTTPS + apex domain (no `.www.` mismatch). Test by clicking "Connect Slack" on staging and confirming the callback round-trip
- [ ] Render proxy IPs documented in `TRUSTED_PROXIES` (or default keywords still appropriate for the chosen platform topology)
- [ ] Sentry DSN present in **all three runtimes** (server, client, edge) — open a 500 test page after deploy and confirm three events with matching `traceparent`
- [ ] At least **one organization seeded with `platform_operator` role assignment** so the admin shell is reachable (without this, you cannot manage feature flags, view audit-log archive, or approve flag sign-off requests)
- [ ] CRON jobs scheduled in Render; `CRON_SECRET` matches what scheduler hosts send
- [ ] **QStash schedule for `/api/outbox/_drain` registered (F-ASYNC-03).** This is the *only* mechanism that drains `OutboxEvent` — without it the table fills up and no transactional side effects (welcome notification, webhook dispatch, etc.) ever leave the box. **Render's cron jobs do not cover this** because the drain endpoint authenticates via `verifySignatureAppRouter` (Upstash signature), not the Bearer `CRON_SECRET` Render sends. Steps:
  1. **Register via Upstash console** (recommended): Upstash dashboard → QStash → Schedules → Create. Cadence: `*/30 * * * * *` (every 30 s) or `*/1 * * * *` (every 1 min — fine if the 30 s cron isn't supported on the plan tier). Destination: `https://<deploy-host>/api/outbox/_drain`. Method: `POST`. Empty body. Retries: 2.
  2. **Or via the QStash REST API:**
     ```bash
     curl -X POST https://qstash.upstash.io/v2/schedules/https://<deploy-host>/api/outbox/_drain \
       -H "Authorization: Bearer $QSTASH_TOKEN" \
       -H "Upstash-Cron: */1 * * * *" \
       -H "Upstash-Retries: 2"
     ```
     (No project script registers this — schedules created by the SDK in `packages/api/src/routers/integrations/{ksef,peppol,google-workspace}.ts` are per-tenant integration jobs, not the global outbox drain.)
  3. **Verify** by inserting one PENDING `OutboxEvent` row (any flow that emits one — see §5.9) and confirming it transitions to `DISPATCHED` within 60 s. If it doesn't, the schedule is missing or the deploy host URL is wrong.
  4. **Note on `render.yaml`:** the existing cron entries (`cron-token-refresh`, `cron-data-purge` at `render.yaml:492` / `:517`) are HTTP curls with `Authorization: Bearer $CRON_SECRET`. The outbox drain is **not** registered in `render.yaml` and should not be — its handler rejects anything without a valid Upstash signature. Treat **this runbook** as the single source of truth for the outbox-drain schedule.
- [ ] Resend domain SPF / DKIM / DMARC records verified at the registrar (separate from app deploy, but emails won't deliver without it)

---

## 5. Smoke tests after deploy

Run these as a checklist immediately after the cutover. They map 1-to-1 onto Phase 2/3 closed findings; if a step fails, the related finding has regressed.

```bash
# 5.1 Health probe — exercises DB, Redis, QStash, R2, QStash backpressure (F-OBS-07, F-SCALE-19)
curl -fsS https://$APP_HOST/api/health | jq .
# Expect (top-level): { status: "ok", timestamp, durationMs, probes: ProbeResult[] }
# `probes` is an ARRAY of 5 objects, one per probe, each shaped:
#   { name, status, durationMs, reason? }
# where `name` is one of: "database" | "redis" | "qstash" | "r2" | "backpressure"
# and `status` is one of: "ok" | "fail" | "skipped".
# (Verify shape against `apps/web/src/app/api/health/route.ts` lines ~48 / ~270.)
#
# Quick array-aware assertions:
curl -fsS https://$APP_HOST/api/health \
  | jq -e '.status == "ok" and ([.probes[] | select(.status == "fail")] | length) == 0'
# Per-probe lookup (note: this is a filter on the array, NOT a nested key):
curl -fsS https://$APP_HOST/api/health | jq '.probes[] | select(.name == "r2")'
#
# CAUTION — passing `r2` probe is not proof of canary upload. The probe at
# `apps/web/src/app/api/health/route.ts` ~line 222 treats `NotFound` /
# `NoSuchKey` (HTTP 404) as `ok` so a missing canary file does not fail
# healthchecks. After deploy, manually confirm `R2_HEALTHCHECK_KEY` is
# present in **each regional bucket** (see §4) — only then is a green r2
# probe a real signal that R2 is fully wired.

# 5.2 Turnstile gate — without token (F-SEC-22)
curl -fsS -X POST https://$APP_HOST/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"Test1234!"}'
# Expect: 403 from the verifier (or 400 missing-token in Better Auth)

# 5.3 Stripe late-event guard (F-INT-21)
# Use Stripe CLI to replay an event whose `created` is >24h old:
stripe trigger payment_intent.succeeded --override created=$(($(date +%s) - 90000))
# Expect: 200 OK + log line "F-INT-21: stripe event older than 24h, dropping"

# 5.4 OAuth start mints challenge cookie (F-SEC-05)
# Cookie name is `__Host-oauth_state` (verified at
# `apps/web/src/app/api/oauth/[provider]/start/route.ts:27`); grep must
# include the `__Host-` prefix or it will silently miss.
curl -i https://$APP_HOST/api/oauth/slack/start | grep -i 'set-cookie:.*__Host-oauth_state'
# Expect: __Host-oauth_state=…; HttpOnly; Secure; SameSite=Lax; Path=/
# Hit the callback with a forged state — expect 401.

# 5.5 Portal magic-link (F-SEC-13)
# From the portal login page, request a magic link; check Resend logs for delivery.

# 5.6 Admin gate (F-SEC-04)
# Sign in as a non-platform-operator user; visit /admin/feature-flags;
# expect 403 / not-found page.

# 5.7 Audit log on user.invite (F-OBS-05)
# As an org admin, invite a teammate; query AuditLog for actor + action="user.invite".
# Expect a row with before/after JSON populated.

# 5.8 tRPC body cap (F-SCALE-17)
# Send a 2 MB JSON body to /api/trpc/<any-mutation>; expect 413.

# 5.9 Outbox drain alive (F-ASYNC-03)
# After triggering any outbox-emitting flow (e.g. signup → welcome notification),
# tail the outbox table:
psql $DATABASE_URL -c "SELECT status, COUNT(*) FROM \"OutboxEvent\" GROUP BY status;"
# Expect: rows are flushing PENDING → DISPATCHED within 30-60s.
```

If 5.9 shows `PENDING` rows accumulating with `attempts > 0`, the QStash drain schedule is misconfigured — verify the `/api/outbox/_drain` route is reachable and the QStash scheduled message is alive.

---

## 6. Rollback strategy

Each Phase 2/3 commit is **atomic and revertable**. To roll back a single finding:

1. Identify the finding ID — every audit-related commit message embeds `F-XXX-NN` (DB, SEC, INT, ASYNC, OBS, SCALE).
2. `git log --grep='F-SEC-04'` — locate the commit.
3. `git revert <sha>` — produce a forward-revert commit (do NOT use `--hard` reset on shared `main`).
4. Re-deploy.

**Schema rollback:**
- Additive columns/indexes — drop them in order opposite to the run order in `scripts/sql-migrations/README.md` (B-B1's deliverable).
- Unique constraints (`webhook_delivery_provider_event_uniq`, `einvoice_lifecycle_event_org_eid_uniq`, `Notification.dedupKey`) — `ALTER TABLE … DROP CONSTRAINT …`. Be aware that the application code expects these constraints to exist; rolling back the DB without rolling back the app will crash with `P2002` translation errors.
- New models (`PendingUpload`, `OAuthChallenge`, `Export`, `OutboxEvent`) — drop in reverse dependency order; verify no FK references survive (none expected in HEAD).

**Feature-flag fallback:** Long-term, every Phase 2/3 finding ought to be guarded by an Unleash flag so a roll-back can flip a switch instead of redeploying. **This is backlog** — currently flag-gating exists for a subset (cf. `packages/feature-flags/src/registry.ts`); broader coverage is tracked in `docs/PRODUCTION-CHECKLIST.md` § 10.

---

## 7. Post-deploy monitoring

For 48 hours after the cutover, pay attention to:

**Sentry**
- The drain handler at `apps/web/src/app/api/outbox/_drain/route.ts:63` calls `Sentry.captureException(err, { tags: { 'outbox.outcome': 'drain-error' } })` whenever a tick throws. Filter Sentry on tag `outbox.outcome:drain-error` for the canonical "outbox is broken" signal — a spike means the drain consumer is down or a handler is throwing on every retry.
- Webhook dispatch failures and backpressure rejections surface through their own Sentry captures; baseline them on staging first by replaying a known-bad payload.
- Beforehand, confirm the `beforeSend` PII scrub is working: search Sentry for any event containing the literal strings `bankAccount`, `taxId`, `Authorization` — there should be zero hits.

**Outbox gauges (Pino / Axiom / metrics backend)**
- The drain emits four gauges per tick from `apps/web/src/app/api/outbox/_drain/route.ts:51-54`:
  - `outbox.drain.scanned` — rows considered this tick
  - `outbox.drain.dispatched` — rows successfully dispatched
  - `outbox.drain.retried` — rows requeued for another attempt
  - `outbox.drain.exhausted` — rows that hit max attempts and moved to terminal failure (the "watch this for failures" signal)
- A non-zero `outbox.drain.exhausted` over a 5-minute window means real, terminal dispatch failures — investigate the underlying handler. There is **no `outbox.failed` metric** (an earlier draft of this runbook referenced one; it was never implemented).
- Queue depth is also recorded as `queue.depth queue:outbox` via `recordQueueDepth('outbox', ...)` at the top of every tick — useful for alerting on a growing backlog independent of dispatch outcomes.

**Pino / Axiom**
- Tail `traceparent` correlation across QStash producer → consumer hops — every QStash callback (ocr/_process, ksef/_sync, google-workspace/_sync, zatca/_submit, peppol/{inbound,outbound,poll}, webhooks/_process, cron/inpost-status-poll, late-interest/_render-claim-pdf) reseeds an ALS frame from `Upstash-Forward-x-request-id` and `Upstash-Forward-traceparent`. A click-to-job trace should be one continuous chain.
- Slow-query log entries above `PRISMA_SLOW_QUERY_THRESHOLD_MS` — flag any query > 1 s for review.

**Database**
- `pg_stat_activity` — verify the new RLS sessions are actually running with `app.org_id` set on tenant-scoped transactions. **NOTE:** Prisma does not set an `application_name` containing `"tenant"` by default, so the obvious `application_name LIKE '%tenant%'` filter returns zero rows even on a healthy deploy. Filter on the per-transaction GUC instead:
  ```sql
  SELECT pid, state, query,
         current_setting('app.org_id', true) AS org_id
  FROM pg_stat_activity
  WHERE current_setting('app.org_id', true) IS NOT NULL
    AND current_setting('app.org_id', true) <> ''
  LIMIT 20;
  ```
  (`current_setting(name, true)` returns NULL when the GUC is unset, so the filter cleanly partitions tenant-scoped sessions from connection-pool idle rows. `app.org_id` is set inside `withRlsSession` via `SET LOCAL` — see `packages/api/src/middleware/tenant.ts`.)
- Connection-pool exhaustion (Neon Console → Monitoring → Connections). Phase 3's pagination caps and Phase 2-C's hot-path reductions should reduce sustained connection count; if it climbs, the cross-region cache layer (F-DB-03) is missing or misconfigured.

**Cronitor**
- All four cron heartbeats green: `reminders`, `token-refresh`, `trial-notifications`, `job-health`. Phase 3's advisory-lock work (F-ASYNC-06, F-ASYNC-07) means a missed heartbeat is a real outage, not a duplicate run.

---

## 8. Known TODOs in code

The following deferred items remain in HEAD as `TODO(F-XXX)` annotations. Each has a documented reason for deferral; they are NOT pre-deploy blockers but are tracked.

**Resilience / integrations**
- `packages/integrations/src/adapters/google-calendar-adapter.ts:17` — `TODO(F-INT-04)`: opt-in to Idempotency-Key once createEvent passes a deterministic key.
- `packages/integrations/src/adapters/outlook-calendar-adapter.ts:17` — same for Outlook calendar.
- `packages/integrations/src/services/webhook-dispatcher.ts:78` — `TODO(F-INT-11, coord with P2-A)`: pass `Upstash-Deduplication-Id` once the canonical typed enqueue helper is everywhere.

**Scalability**
- `packages/integrations/src/adapters/register-all.ts:66` — `TODO(F-SCALE-14 follow-up)`: convert to per-adapter dynamic import so adapter cold-start cost stays bounded as we add providers.
- `apps/web/src/middleware.ts:529` — `F-SCALE-19 — QStash queue-depth backpressure (deferred — TODO)`. Documented decision; revisit when queue depth p95 sustains > 50.

**Defense-in-depth**
- `packages/api/src/middleware/tenant.ts:117` — `TODO(F-DB-04)`: non-transactional `ctx.db.X.findMany()` calls still bypass the RLS session SET; full coverage requires either wrapping every read in a tenant tx or moving to real Postgres `CREATE POLICY`. Tier-2 work.

**Observability**
- `apps/web/src/app/api/cron/job-health/route.ts:81` — `TODO(P2-B, F-INT-13)`: once `WebhookDelivery.attempts` is consistently populated by every dispatcher, switch the alert threshold logic from queue-depth to per-row attempt count.

---

## 9. Tier-2 follow-ups (post-deploy backlog)

Three audit items intentionally **scoped only** in the May 2026 work and now need full rollout. They are not regressions; they are explicit deferrals.

| ID | Title | Status | Pickup criteria |
|---|---|---|---|
| **F-SCALE-06** | Read-replica routing per region | Scaffolded by B-B2 (env vars `DATABASE_URL_EU_RO` / `DATABASE_URL_ME_RO` plumbed; routing helper behind a flag) | When read p95 on the primary climbs above 100 ms sustained, OR a region reports cross-region tail latency > 250 ms |
| **F-DB-04** | Defense-in-depth RLS coverage | B-A2 wired `withRlsSession` into the tenant tRPC middleware (`SET LOCAL app.org_id`); coverage is partial | When a real Postgres `CREATE POLICY` migration is approved by a DB engineer + DPO; needs auth-side schema review |
| **F-INT-05** | Circuit-breaker rollout to all 14 adapters | P2-B foundation in place (`opossum` 9 + `p-retry` + `p-limit`, per-provider config table, helper exported) | Mechanical rollout — wire `withResilience(call, …)` around the 10 adapters that don't yet use it. ~1 day's work under one fixer; needs no design |

Owner / sequencing decisions live in `.audit-2026-05-03/NEXT-PHASE-PLAN.md` § Recommended sequencing.

---

## 10. Reference

- **Audit reports** — [`.audit-2026-05-03/01-db-performance.md`](../.audit-2026-05-03/01-db-performance.md) through [`06-scalability.md`](../.audit-2026-05-03/06-scalability.md)
- **Synthesis** — [`.audit-2026-05-03/00-SYNTHESIS.md`](../.audit-2026-05-03/00-SYNTHESIS.md)
- **Phase plan** — [`.audit-2026-05-03/NEXT-PHASE-PLAN.md`](../.audit-2026-05-03/NEXT-PHASE-PLAN.md)
- **Market scan** — [`.audit-2026-05-03/MARKET-SCAN.md`](../.audit-2026-05-03/MARKET-SCAN.md)
- **Commit attribution caveats** — [`docs/COMMIT-ATTRIBUTION.md`](COMMIT-ATTRIBUTION.md)
- **Render deployment** — [`docs/DEPLOYMENT-RENDER.md`](DEPLOYMENT-RENDER.md)
- **Tech debt** — [`docs/TECH-DEBT.md`](TECH-DEBT.md)
