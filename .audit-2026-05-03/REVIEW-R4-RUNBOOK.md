# R4 Runbook Reality Check

**Reviewer:** R4 (post-Phase-2/3 deploy reality-check)
**Target:** `docs/RUNBOOK-PHASE-2-3-DEPLOY.md` (last-updated 2026-05-05)
**Date:** 2026-05-05
**Mode:** READ-ONLY (no runbook edits applied — all corrections enumerated as `RUNBOOK-FIX-NN` at the end)

---

## TL;DR

The runbook is structurally sound and the rollback plan is honest, but a deploying user will hit **three concrete bugs** in the first 30 minutes:

1. **Smoke test 5.1 will fail** — `/api/health` returns probes named `database, redis, qstash, r2, backpressure` (5 probes), not the `db, redis, qstash, r2` shape the runbook documents (`apps/web/src/app/api/health/route.ts:49`). A grep-for-shape healthcheck script written from §5.1 will report a regression that isn't real.
2. **The "underdocumented in `.env.example`" claim in §2 is partially wrong** — `INFISICAL_TOKEN_TTL_MS`, `DATABASE_URL_EU_RO`, `DATABASE_URL_ME_RO` ARE in `.env.example` (lines 155, 27, 28). Only `R2_HEALTHCHECK_KEY`, `TRPC_MAX_BODY_MB`, `PRISMA_SLOW_QUERY_THRESHOLD_MS`, `DOCUSIGN_EMBEDDED_URL_TTL_SECONDS` are actually missing.
3. **Post-deploy monitoring §7 references metric names that do not exist in code** — `outbox.failed` is never emitted (the outbox emits `outbox.drain.{scanned,dispatched,retried,exhausted}` gauges, not a `.failed` counter; see `apps/web/src/app/api/outbox/_drain/route.ts:51-54`).

Beyond those, §3 mis-leads on schema-migration ordering, §4 omits the QStash `outbox-drain` schedule, and §6 silently relies on the existence of `scripts/sql-migrations/` which does exist but only ships **3** SQL files, not the open-ended set the runbook implies. The COMMIT-ATTRIBUTION spot-checks both confirmed clean.

Severity rollup: 1 BLOCKING bug (smoke 5.1 wrong shape), 4 WRONG (env-var doc claims, missing metric names, missing checklist items, missing migration files), ~6 minor wording/imprecision items.

---

## Pass 1: Env-var completeness

| Env var | Runbook says | Reality (file:line) | Verdict |
|---|---|---|---|
| `PLATFORM_OPERATOR_ORG_ID` | Blocking for `/admin/*` | `apps/web/src/lib/admin-auth.ts:45-55` reads it; admin shell 403s when unset. In `.env.example:212`. Validator `packages/validators/src/env.ts:227` (optional UUID). | **CONFIRMED** |
| `TURNSTILE_SITE_KEY` | Graceful (widget renders inert) | `packages/validators/src/env.ts:177` (optional). Used SSR-side for form. | **CONFIRMED** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Graceful | `apps/web/src/components/auth/register-form.tsx:26` — `if (TURNSTILE_SITE_KEY)` gate hides widget when unset. | **CONFIRMED** |
| `TURNSTILE_SECRET_KEY` | "Fails-closed in production" | **CONFIRMED** at `packages/auth/src/turnstile.ts:52-64`: `if (!secret)` → if `NODE_ENV === 'production'`, returns `false` and logs `auth.turnstile.unconfigured`. Dev returns `true`. The runbook claim is accurate. | **CONFIRMED** |
| `TRUSTED_PROXIES` | Default `loopback,linklocal,uniquelocal` | `apps/web/src/middleware.ts:251` — `process.env.TRUSTED_PROXIES ?? 'loopback,linklocal,uniquelocal'`. | **CONFIRMED** |
| `R2_HEALTHCHECK_KEY` | Default `_health/canary.txt`, blocking-for-/api/health | `packages/integrations/src/services/health-service.ts:248` and `apps/web/src/app/api/health/route.ts:40` both read with `?? '_health/canary.txt'`. NOT in `.env.example` (confirmed missing). | **CONFIRMED** but "blocking" overstates — see Pass 2 §5.1 below: when key absent, R2 probe returns `ok` because the AWS SDK 404 is caught as success on line 223 (`if (isNotFound) return ok('r2', start)`). The runbook's "blocking" framing is misleading. |
| `INFISICAL_TOKEN_TTL_MS` | Default `3600000` | `packages/integrations/src/services/infisical-client.ts:109`. **IS in `.env.example:155`** with the documented default. | **CONFIRMED** (but runbook §2 trailing note implying it's missing from `.env.example` is wrong — see Pass 1.5) |
| `EMAIL_FROM` | Default `noreply@contractor-ops.com`; blocking | `packages/auth/src/env.ts:60` — `z.email().default('noreply@contractor-ops.com')`. In `.env.example:50`. Not strictly "blocking" — has a default. | **WRONG** classification: graceful (defaults to a value), not blocking. |
| `RESEND_API_KEY` | Blocking | `packages/auth/src/env.ts:143-145` — throws in production when unset. | **CONFIRMED** |
| `DATABASE_URL_EU_RO` | Graceful | `packages/db/src/replica.ts:73`. **IS in `.env.example:27`** (well-commented section). | **CONFIRMED** code; runbook §2 trailing note (claims missing from `.env.example`) is **WRONG**. |
| `DATABASE_URL_ME_RO` | Graceful | `packages/db/src/replica.ts:74`. **IS in `.env.example:28`**. | Same as above. |
| `PRISMA_SLOW_QUERY_THRESHOLD_MS` | Default `200` | `packages/db/src/client.ts:11` reads with `?? '200'`. **NOT in `.env.example`** — runbook trailing note correct. | **CONFIRMED** |
| `TRPC_MAX_BODY_MB` | Default `1` | `apps/web/src/app/api/trpc/[trpc]/route.ts:28` — `Math.max(1, parseFloat(... ?? '1'))`. **NOT in `.env.example`** — runbook trailing note correct. | **CONFIRMED** |
| `BETTER_AUTH_SECRET` | Blocking | `packages/auth/src/env.ts:135-136` throws in production. In `.env.example:31`. | **CONFIRMED** |
| `DOCUSIGN_EMBEDDED_URL_TTL_SECONDS` | Adapter default | `packages/integrations/src/adapters/docusign-adapter.ts:393-396`. **NOT in `.env.example`** — runbook trailing note correct. | **CONFIRMED** |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` | Blocking-for-observability | Read at `apps/web/src/sentry.{server,client,edge}.config.ts`. In `.env.example:232`. | **CONFIRMED** |
| `CRON_SECRET` | Blocking | All `/api/cron/*` routes + `exchangeRate.fetchDaily`. In `.env.example:191`. | **CONFIRMED** |

### Pass 1.5: Trailing-note "underdocumented in .env.example" claim accuracy

The runbook §2 trailing block claims **6 vars** are missing from `.env.example`. Grep against the live `.env.example`:

| Var | Runbook says missing | Actually in .env.example? |
|---|---|---|
| `R2_HEALTHCHECK_KEY` | YES | **NOT present** — runbook correct |
| `TRPC_MAX_BODY_MB` | YES | **NOT present** — runbook correct |
| `PRISMA_SLOW_QUERY_THRESHOLD_MS` | YES | **NOT present** — runbook correct |
| `DATABASE_URL_EU_RO` | YES | **PRESENT at line 27** with multi-line block comment — **runbook WRONG** |
| `DATABASE_URL_ME_RO` | YES | **PRESENT at line 28** — **runbook WRONG** |
| `DOCUSIGN_EMBEDDED_URL_TTL_SECONDS` | YES | **NOT present** — runbook correct |

Plus `INFISICAL_TOKEN_TTL_MS` (mentioned in body, not in trailing note): **PRESENT at line 155**. Body description is accurate; runbook is internally consistent here.

### Pass 1.6: Env vars READ in code but not in runbook §2 table

Spot-search of new audit-era env vars used in code but absent from §2:

- `QSTASH_HEALTH_URL` — `apps/web/src/app/api/health/route.ts:134` (used by health probe). Optional; defaults to `https://qstash.upstash.io`. Not blocking. Could be added.
- `LOAD_TEST_BYPASS` / `LOAD_TEST_SECRET` — middleware bypass for k6 (`.env.example` warns "never set on production"). Worth a security-tone callout in the runbook.
- `SLACK_TOKEN_ENCRYPTION_KEY`, `BANK_ACCOUNT_ENCRYPTION_KEY` — encryption keys; absence means tokens stored plaintext-equivalent. Not Phase 2/3 work but missing key on prod is dangerous. Out of scope but flagging.

These are minor; the §2 table covers the **audit-era** new vars accurately apart from the `.env.example` documentation drift above.

---

## Pass 2: Smoke tests

### 5.1 — `/api/health` shape (BROKEN)

Runbook claim:
```
Expect: { status: "ok", probes: { db: ok, redis: ok, qstash: ok, r2: ok } }
```

Actual code at `apps/web/src/app/api/health/route.ts:49`:
```ts
name: 'database' | 'redis' | 'qstash' | 'r2' | 'backpressure';
```

The probe array names the DB probe **`database`, not `db`**, and ships a fifth probe **`backpressure`** the runbook doesn't mention. Also: the response is an array `probes: ProbeResult[]` (per line 173), not a flat object. A `jq '.probes.db'` would print `null` even on a perfectly-healthy deploy.

**Severity:** BLOCKING-FOR-RUNBOOK (false-positive regression in 5 minutes). See `RUNBOOK-FIX-01`.

### 5.2 — Turnstile gate

Runbook expects `403 from the verifier (or 400 missing-token in Better Auth)`. Verified at `packages/auth/src/turnstile.ts:55-75`: when `TURNSTILE_SECRET_KEY` is set in production AND the body lacks a token, `verifyTurnstileToken` returns `false` and the Better Auth `before` hook throws. Better Auth typically maps that to **422** (validation) or **400** (missing-token), not 403. The "403 from the verifier" wording is misleading — Cloudflare's siteverify endpoint never returns 403 here. **MINOR** wording fix.

### 5.3 — Stripe late-event guard

Verified `apps/web/src/app/api/webhooks/stripe/route.ts:57-79`. The route does drop late events and emits `metrics.increment('webhook.late_delivery_rejected', ...)`. The runbook says: *"Expect: 200 OK + log line `F-INT-21: stripe event older than 24h, dropping`"* — the actual log message wording is on a comment at line 57 ("F-INT-21") but the log entry text differs. Searching for the literal `F-INT-21: stripe event older than 24h, dropping` will not match. The metric `webhook.late_delivery_rejected` is the durable signal. **MINOR** — replace the log-line assertion with the metric name. See `RUNBOOK-FIX-02`.

Also note: the runbook says "24h" but the actual route comment at line 57 says *"Stripe redelivery window is 3 days"*. The 24h literal in the smoke test (`90000` seconds = 25h) may or may not actually trigger the guard depending on the threshold constant — needs verification of the actual MAX_AGE_MS.

### 5.4 — OAuth start cookie

Verified at `apps/web/src/app/api/oauth/[provider]/start/route.ts:27` — cookie name is `__Host-oauth_state`. The grep `'set-cookie: oauth_state'` in the runbook is **case-sensitive and missing the `__Host-` prefix** — it will not match the actual `Set-Cookie: __Host-oauth_state=...` header. **WRONG**. Use `grep -i "set-cookie:.*oauth_state"`. See `RUNBOOK-FIX-03`.

### 5.5 — Portal magic-link

Manual test, untestable from runbook alone — passes through.

### 5.6 — Admin gate

Verified `apps/web/src/lib/admin-auth.ts:45-55`. When `PLATFORM_OPERATOR_ORG_ID` is unset OR active session org doesn't match, response is `notFound()` (Next.js 404), not 403. Runbook says "403 / not-found" — the slash is correct, but the "/" implies "or"; in fact only the not-found path is reachable in current code. **MINOR** wording.

### 5.7, 5.8 — pass through structurally; no obvious mismatch.

### 5.9 — Outbox drain

Verified `apps/web/src/app/api/outbox/_drain/route.ts`. `OutboxEvent` table exists (`packages/db/prisma/schema/outbox.prisma`). The `psql` query is correct.

---

## Pass 3: Checklist gaps

§4 pre-deploy checklist gaps verified against schema/migrations/code:

1. **Missing: register the QStash `outbox-drain` schedule.** §3 says outbox drain runs at 30-60s, §5.9 references "/api/outbox/_drain", §7 mentions QStash drain consumer, but §4 has **no checklist item** for "register QStash schedule pointing at `/api/outbox/_drain`". The cron-token-refresh (`render.yaml:492`) and cron-data-purge (`render.yaml:517`) are wired in `render.yaml`; the outbox drain is not visibly registered there. A deployer who follows §4 to the letter ships with a non-draining outbox. **BLOCKING**. See `RUNBOOK-FIX-04`.

2. **Missing: SQL-migration run order.** §3 mentions `scripts/sql-migrations/README.md` "owned by agent B-B1". Confirmed present (3 SQL files: `2026-05-04-F-DB-13`, `F-DB-14`, `F-DB-17`). The runbook should pull the run order **into the checklist itself** so the deployer doesn't context-switch — at minimum:
   - Run `F-DB-13` (integration-connection partial unique index) — additive.
   - Run `F-DB-14` (signing envelope dedupe + unique) — **REQUIRES** the dedupe step to actually run before the unique constraint, or the migration fails on duplicates.
   - Run `F-DB-17` (drop redundant einvoice-lifecycle unique) — last; depends on the new unique from F-DB-14 being live.

   §3 says "Read README.md for the run order" — that indirection is fine for triage but not for a 30-min runbook. See `RUNBOOK-FIX-05`.

3. **Missing: schema-migration step explicitly.** §3 has a generic "run all reversible Prisma-managed migrations first" but §4 (the actual checklist) has **no checkbox for `prisma migrate deploy`**. Easy to forget. See `RUNBOOK-FIX-06`.

4. **Missing: seed `platform_operator` role assignment, with concrete command.** Runbook §4 says "*At least one organization seeded with `platform_operator` role assignment*" but doesn't link to the seed script or provide a one-liner. `packages/db/scripts/seed-dev.ts:1001` exists but is dev-mode. Production needs a documented `pnpm db:seed:platform-operator -- --org-id=<UUID> --user-id=<UUID>` or equivalent. See `RUNBOOK-FIX-07`.

5. **Missing: explicit DB-migration order for new models.** New models (`PendingUpload`, `OAuthChallenge`, `Export`, `OutboxEvent`) and field changes (`Member.disabledAt`, `Notification.dedupKey`, `WebhookDelivery.attempts`, `WebhookDelivery.providerEventId`, `EInvoiceLifecycleEvent.providerEventId`) are listed but the deployer has no clear sequence for which Prisma migration files are involved. If the schema is in `packages/db/prisma/schema/*.prisma` but migrations are not generated, `pnpm db:push` is the only path — and §3 admits production multi-region migration is "BLOCKED on the multi-region migration plan". This is honest but the deployer needs to know **what to do *today* for the first single-region prod cutover** if multi-region is deferred. The current §3 reads as "you can't deploy" — likely not the intent.

---

## Pass 4: Rollback verification

Spot-checked 3 commits via `git log` over recent Phase 2/3 SHAs.

**`8c79880c` (F-OBS-03)** — verified by `git show --stat`. Touches 15 files including `packages/db/src/rls.ts` (new, +72) and `packages/db/src/__tests__/rls.test.ts` (+83) which are F-DB-04 work, NOT F-OBS-03. Reverting this commit by SHA to "roll back F-OBS-03" would also drop the F-DB-04 RLS scaffolding (`withRlsSession` etc.) — that's a non-trivial side effect the runbook §6 doesn't warn about. The COMMIT-ATTRIBUTION doc *does* call it out (line 21), but §6 of the runbook says "each commit is atomic and revertable" without cross-linking to COMMIT-ATTRIBUTION as a caveat. See `RUNBOOK-FIX-08`.

**`e26dd055` (F-OBS-08)** — verified via `git show --stat`. Touches `packages/api/src/services/oauth-challenge.ts` (new, +207), `packages/db/prisma/schema/oauth-challenge.prisma` (new, +49), and the OAuth callback/start route additions. Reverting "F-OBS-08" by this SHA would drop the entire `OAuthChallenge` table. **Same caveat as above** — COMMIT-ATTRIBUTION flags this; runbook §6 should cite it.

**Schema rollback SQL** — runbook §6 says *"Unique constraints — `ALTER TABLE … DROP CONSTRAINT …`. Be aware that the application code expects these constraints to exist; rolling back the DB without rolling back the app will crash with `P2002` translation errors."* — that warning is accurate. But it does **not provide the actual constraint names** (`webhook_delivery_provider_event_uniq`, `einvoice_lifecycle_event_org_eid_uniq`, `Notification_organizationId_dedupKey_key` Prisma-derived). Concrete `DROP CONSTRAINT` SQL belongs inline. See `RUNBOOK-FIX-09`.

**Feature-flag fallback** — §6 says "currently flag-gating exists for a subset (cf. `packages/feature-flags/src/registry.ts`); broader coverage is tracked in `docs/PRODUCTION-CHECKLIST.md` § 10." — verified `packages/feature-flags/src/registry.ts` exists. The runbook does NOT name **which specific Phase 2/3 features already have flags**. From the registry, the audit-era flags worth calling out for emergency-disable include `classification-engine` and the OAuth provider flags. A deployer in a fire-fight will not have time to grep. See `RUNBOOK-FIX-10`.

---

## Pass 5: Post-deploy monitoring — metric existence verified

| Metric the runbook tells ops to watch | Code site | Verdict |
|---|---|---|
| `webhook.failed` | `apps/web/src/app/api/webhooks/stripe/route.ts:161` — `metrics.increment('webhook.failed', 1, {...})` | **CONFIRMED** — Stripe-only. Other webhook providers (Slack, Linear, Jira, DocuSign, Resend) use different metric names. The runbook implying a uniform `webhook.failed` is misleading. |
| `outbox.failed` | **NOT FOUND** in any source file. The outbox drain emits `outbox.drain.{scanned,dispatched,retried,exhausted}` *gauges* at `apps/web/src/app/api/outbox/_drain/route.ts:51-54`. | **WRONG** — searching Sentry for `outbox.failed` will yield zero events even if the drain is broken. The deployer will conclude "no problem" and miss real failures. |
| `backpressure.rejected` | `packages/api/src/services/qstash-backpressure.ts:269` — `metrics.increment('backpressure.rejected', 1, { route: routeKey })` | **CONFIRMED**, tagged with `route` only (no `provider` or `orgId`). Runbook implies richer tagging — see below. |

**Sentry tags (`app.org_id`)** — searched for `setTag.*org`. Found at `packages/api/src/middleware/observability.ts:136` — `scope.setTag('org.id', organizationId)`. The runbook references the literal `app.org_id` but the actual tag key is `org.id`. **MINOR** — tag-name search will miss in Sentry UI. See `RUNBOOK-FIX-11`.

**Pino traceparent correlation** — verified `packages/integrations/src/services/qstash-client.ts` exposes `publishJSONWithContext` that injects `Upstash-Forward-x-request-id` and `Upstash-Forward-traceparent` (commit `8c79880c`). Consumer routes read those headers via `runWithRequestContext`. The runbook's claim of "one continuous chain" is structurally accurate. But the runbook does NOT give the deployer an example **grep query** for tailing one such trace. A useful pattern:
```
# At Axiom / Pino destination:
| where requestId == "<id from browser DevTools>"
| sort by _time
```
See `RUNBOOK-FIX-12`.

**`pg_stat_activity` query** — runbook §7 SQL filters `WHERE application_name LIKE '%tenant%'`. The actual Prisma client doesn't set a `application_name` parameter that contains the literal "tenant" by default. Without verifying the Prisma client init at `packages/db/src/client.ts` sets a tenant-aware app name, this query may return zero rows even on a healthy deploy. Likely **WRONG**. See `RUNBOOK-FIX-13`.

---

## Pass 6: Tier-2 follow-ups

### F-SCALE-06 read-replica rollout

Runbook says "scaffolded, dashboard.kpis is the only consumer". Verified `packages/db/src/replica.ts:73-74` and the env-var comment block in `.env.example:21-25`. Other obvious-low-risk consumers worth listing:

- **Dashboard widgets** — counts, charts, MRR roll-ups (any `findMany` that's pure aggregation and tolerates a few seconds of replica lag).
- **Search index reads** — `packages/api/src/routers/core/search.ts` if it does paginated full-text search (caveat: writes need primary).
- **Reports** — `packages/api/src/routers/core/report.ts` CSV export reads (already streams; lag is a non-issue for an export).
- **Audit-log archive viewer** — strictly read-only, lag-tolerant.

Not safe yet: any read inside a `$transaction`, anything that immediately follows a write the user just performed (read-after-write), and any `count()` used as a precondition for a write.

### F-DB-04 RLS coverage

Runbook says scoped to 5 tables. Migration path to fuller coverage:

1. Audit which tenant-scoped models (those with `organizationId`) lack `withRlsSession` wrapping.
2. Inventory: Prisma schemas with `organizationId` field — likely 30+ models. The `withRlsSession` middleware at `packages/api/src/middleware/tenant.ts:117` has a `TODO(F-DB-04)` for non-transactional `findMany` paths.
3. Convert to true Postgres `CREATE POLICY` migrations one model at a time, starting with the highest-risk (Member, Document, Invoice, BillingProfile, BankAccount). Needs DB-engineer + DPO sign-off per project memo.

### F-INT-05 circuit-breaker rollout

Runbook says "P2-B foundation in place; not all 14 adapters opt in". Audited `withResilience` usage. Total adapters: **17** files in `packages/integrations/src/adapters/*.ts`.

**Confirmed using `withResilience`:**
- `slack-adapter.ts` (line 256)
- `claude-ocr-adapter.ts` (referenced; the comment on line 249 confirms it's *inside* a withResilience loop)

Other adapters need a manual sweep — the data above doesn't show wide adoption. The runbook's "14 adapters" count is approximately right; the "10 don't yet use it" is plausible. Concrete audit beyond this would require running:
```
for f in packages/integrations/src/adapters/*.ts; do
  grep -l withResilience "$f" || echo "MISSING: $f"
done
```
See `RUNBOOK-FIX-14`.

---

## Pass 7: Commit-attribution spot-check

Picked 2 entries from `docs/COMMIT-ATTRIBUTION.md` and verified via `git show --stat`.

### `8c79880c` — claim: F-OBS-03 + F-DB-04 RLS scaffolding

`git show --stat 8c79880c` confirms:
- **F-OBS-03 files** (described in body): `apps/web/src/app/api/{ocr,ksef,zatca,peppol,webhooks,cron,late-interest,google-workspace}/**/route.ts`, `packages/integrations/src/index.ts`. Confirmed.
- **F-DB-04 over-staged files**: `packages/db/src/rls.ts` (NEW, +72), `packages/db/src/__tests__/rls.test.ts` (+83), `packages/db/src/index.ts` (+4), `packages/api/src/middleware/tenant.ts` (+36). All exactly as documented in COMMIT-ATTRIBUTION line 21.

**ACCURATE**.

### `e26dd055` — claim: F-OBS-08 + F-SEC-05/F-SEC-21 OAuthChallenge

`git show --stat e26dd055` confirms:
- **F-OBS-08 files**: `apps/web/src/lib/sentry-scrub.ts` (NEW, +154), `apps/web/src/sentry.{client,server,edge}.config.ts` (+9, +11, +8). Confirmed.
- **F-SEC-05/21 over-staged**: `packages/api/src/services/oauth-challenge.ts` (NEW, +207), `packages/db/prisma/schema/oauth-challenge.prisma` (NEW, +49), OAuth `[provider]/{callback,start}/route.ts` and tests, regenerated Prisma client outputs (`packages/db/src/generated/prisma/client/*` — multiple files, hundreds of lines). All match.

**ACCURATE**.

COMMIT-ATTRIBUTION is reliable. Recommend §6 of the main runbook cross-link to it.

---

## Recommended runbook updates (numbered RUNBOOK-FIX-NN)

These are **suggested patches**, NOT applied. Apply in a follow-on PR.

**RUNBOOK-FIX-01 (BLOCKING):** §5.1 — fix the expected `/api/health` response shape:
```
Expect: { status: "ok", probes: [
  { name: "database", status: "ok" },
  { name: "redis",    status: "ok" },
  { name: "qstash",   status: "ok" },
  { name: "r2",       status: "ok" },
  { name: "backpressure", status: "ok" }
] }
```
And note that `r2` returns `ok` on a 404 of the canary key (`apps/web/src/app/api/health/route.ts:223`) — so a missing R2_HEALTHCHECK_KEY upload does NOT fail the health probe. To actually verify R2 wiring, upload the canary file and confirm the probe latency is non-trivial.

**RUNBOOK-FIX-02:** §5.3 — replace the log-line assertion with `webhook.late_delivery_rejected` metric increment as the durable signal. Also reconcile "24h" wording with the actual route comment ("3 days redelivery window"); verify the constant in `apps/web/src/app/api/webhooks/stripe/route.ts`.

**RUNBOOK-FIX-03:** §5.4 — change `grep -i 'set-cookie: oauth_state'` to `grep -i 'set-cookie:.*__Host-oauth_state'` so the test actually matches the live cookie name.

**RUNBOOK-FIX-04 (BLOCKING):** §4 — add a checklist item: *"QStash schedule for `/api/outbox/_drain` registered at 30s interval; verify via Upstash console; outbox events drain within 60s of insertion (smoke 5.9)."*

**RUNBOOK-FIX-05:** §4 — inline the SQL-migration run order from `scripts/sql-migrations/README.md`:
1. F-DB-13 (additive)
2. F-DB-14 (REQUIRES dedupe data step before unique constraint)
3. F-DB-17 (drops redundant unique — runs after F-DB-14)

**RUNBOOK-FIX-06:** §4 — add an explicit `pnpm db:migrate:deploy` (or platform equivalent) checkbox; today the schema-migration step is implied by §3 but not in the actionable checklist.

**RUNBOOK-FIX-07:** §4 — add a concrete one-liner for the platform_operator seed: e.g. `pnpm tsx scripts/seed-platform-operator.ts --org=<uuid> --user=<uuid>` (or whatever the actual script name is — needs author confirmation; the dev seed at `packages/db/scripts/seed-dev.ts:1001` is dev-only).

**RUNBOOK-FIX-08:** §6 — cross-reference `docs/COMMIT-ATTRIBUTION.md` and warn: *"Before reverting any of the SHAs in COMMIT-ATTRIBUTION.md, read the over-staged column — reverting one commit may also drop work belonging to a different finding."*

**RUNBOOK-FIX-09:** §6 — provide concrete `DROP CONSTRAINT` SQL inline:
```sql
ALTER TABLE "WebhookDelivery"      DROP CONSTRAINT IF EXISTS "WebhookDelivery_providerEventId_key";
ALTER TABLE "EInvoiceLifecycleEvent" DROP CONSTRAINT IF EXISTS "EInvoiceLifecycleEvent_providerEventId_key";
ALTER TABLE "Notification"          DROP CONSTRAINT IF EXISTS "Notification_organizationId_dedupKey_key";
ALTER TABLE "OutboxEvent"           DROP CONSTRAINT IF EXISTS "OutboxEvent_organizationId_dedupKey_key";
```
(Names are Prisma-default-derived; verify against `pg_constraint` post-migration.)

**RUNBOOK-FIX-10:** §6 — list which Phase 2/3 features already have feature flags (from `packages/feature-flags/src/registry.ts`) so a fire-fight knows which switches are flippable vs. which require a redeploy.

**RUNBOOK-FIX-11:** §7 — change `app.org_id` to `org.id` (actual tag set at `packages/api/src/middleware/observability.ts:136`). Either fix the code to set both names, or fix the runbook.

**RUNBOOK-FIX-12:** §7 — add a worked example of the click → background-job trace, naming the actual log fields:
```
1. Browser DevTools → Network → click any tRPC call → copy the `traceparent` request header.
2. In Axiom: where service in ("web","api","integrations") | filter traceparent == "<value>" | sort _time
3. In Sentry: search for tag `traceparent:<value>`.
```

**RUNBOOK-FIX-13:** §7 — verify or fix the `pg_stat_activity` query. If the Prisma client doesn't set `application_name` containing "tenant", the query returns nothing. Either set the application_name in `packages/db/src/client.ts` PrismaClient constructor (e.g. `?application_name=contractor-ops-tenant`) or rewrite the runbook query to look for `current_setting('app.org_id', true) IS NOT NULL`.

**RUNBOOK-FIX-14:** §9 (Tier-2) — replace the prose "10 of 14 adapters don't use withResilience" with the concrete list, derived from a one-shot grep over `packages/integrations/src/adapters/*.ts`.

**RUNBOOK-FIX-15 (cosmetic):** §2 trailing note — remove `DATABASE_URL_EU_RO`, `DATABASE_URL_ME_RO` from the "underdocumented in `.env.example`" list (they ARE there, lines 27-28 with full comment block). Keep `R2_HEALTHCHECK_KEY`, `TRPC_MAX_BODY_MB`, `PRISMA_SLOW_QUERY_THRESHOLD_MS`, `DOCUSIGN_EMBEDDED_URL_TTL_SECONDS`.

**RUNBOOK-FIX-16 (cosmetic):** §2 — `EMAIL_FROM` is graceful (has default), not blocking. Reclassify.

**RUNBOOK-FIX-17 (cosmetic):** §5.6 — remove "/" between "403" and "not-found page"; the actual response is the 404 not-found page only (`notFound()` in admin-auth).

**RUNBOOK-FIX-18 (cosmetic):** §2 R2_HEALTHCHECK_KEY — soften "Yes (blocking for /api/health)" to "Yes (blocking for *meaningful* /api/health)" — the probe returns `ok` on 404 (canary missing), so the probe **lies** if the canary isn't uploaded. That's worse than "blocking" — it's silent.

---

## Severity summary

| Severity | Count | Items |
|---|---|---|
| BLOCKING (will cause a real false-positive or false-negative on cutover day) | 3 | FIX-01 (health shape), FIX-04 (missing outbox-drain schedule), and the absent `outbox.failed` metric ops will watch in vain (FIX-12 / Pass 5 row 2) |
| WRONG (factually inaccurate documentation) | 6 | FIX-03, FIX-11, FIX-13, FIX-15, FIX-16, COMMIT-ATTRIBUTION-cross-link gap (FIX-08) |
| MISSING (actionable info absent from §4 checklist) | 4 | FIX-05, FIX-06, FIX-07, FIX-09 |
| MINOR (wording / cosmetic) | 5 | FIX-02, FIX-10, FIX-14, FIX-17, FIX-18 |

**Recommendation:** publish a v1.1 of the runbook addressing FIX-01, FIX-04, FIX-11, FIX-13 before the next deploy; the rest can ship in a follow-on cleanup PR.

---

*End R4 — Runbook Reality Check.*
