# Observability Audit

Date: 2026-05-03
Scope: contractor-ops monorepo (apps/web, apps/public-api, apps/landing, packages/*)
Audit type: Production-readiness review of logging, tracing, error handling, and monitoring.

---

## Executive summary

The platform has a strong **logger foundation** (`packages/logger`, Pino with PII redact, Axiom transport, lint guard) and a working **tRPC observability middleware** (per-procedure requestId, Sentry span, metrics). The web app has **Sentry wired across client/server/edge**. Stripe webhook, OCR job, and the job-health cron are well-instrumented. These are real strengths.

However, **multiple production-incident-class gaps exist**:

1. **`apps/public-api` has no Sentry, no request logging, no requestId propagation, no per-request observability whatsoever.** A 500 in the Enterprise REST API today produces only `log.error({ err }, 'unhandled error')` (apps/public-api/src/lib/error-handler.ts:80) with no trace ID, no auth context, no procedure path. Impossible to triage. (F-OBS-01)

2. **The `requestId` minted in `observabilityMiddleware` (packages/api/src/middleware/observability.ts:43) is never propagated to inner code.** Every router and service uses a *module-level* `createLogger({ service: 'foo-router' })` whose child bindings are fixed at import time — calls like `log.error({ err }, 'calendar sync failed')` (contract.ts:265) emit no orgId, userId, or requestId. Cross-system correlation breaks at the procedure boundary. (F-OBS-02)

3. **No correlation across QStash boundary.** `qstash.publishJSON({ body: { extractionId, organizationId, storageKey } })` (ocr.ts:152, ksef.ts:234, late-payment-interest.ts:529, etc.) does not include `requestId` or `traceparent`. Consumer side (`api/ocr/_process/route.ts`) has its own logger with no link back to the producer. End-to-end "user clicked X → job ran" trace impossible. (F-OBS-03)

4. **No `process.on('uncaughtException')` / `process.on('unhandledRejection')` anywhere.** `apps/web/worker-cron.mjs` (long-running node-cron scheduler) and the public-api Hono server (`apps/public-api/src/index.ts`) will both die silently on a stray async error. `grep -rn "uncaughtException\|unhandledRejection" --include="*.ts"` returns zero matches outside `axiom-stream.ts`. (F-OBS-04)

5. **Sensitive admin actions are not in the audit log.** API key creation/revocation (api-key.ts), member role change (`user.updateRole`), member deactivation (`user.deactivate`), invitation send (`user.invite`), organization rename/billing email change (organization.ts) — none call `writeAuditLog`. Only 13 of 79 routers write audit rows. The launch checklist claims "Audit log covers all access to sensitive data" but the code does not back this up. (F-OBS-05)

6. **No outbound HTTP observability.** Adapters (Jira, Linear, Notion, Google Workspace, Confluence, Autenti, DocuSign, Slack, Outlook, Teams, KSeF) call `fetch(...)` directly with no duration logging, no status logging, no retry counting, no Sentry breadcrumb. When "Stripe is slow" or "Jira returns 503" you have no signal. (F-OBS-06)

Several lower-priority issues round out the picture: `/api/health` only checks DB (not Redis/QStash/R2/ClamAV), no Prisma slow-query log, no `Sentry.beforeSend` PII scrubber, ~45 silent `} catch {}` blocks in source paths (many of which would mask real bugs), and `console.warn` in two e2e setup files (low risk but breaks the "no console.* in source" guarantee in spirit).

The good news: most fixes are mechanical and the logger plumbing already exists. Priority order for production readiness: F-OBS-01, F-OBS-04, F-OBS-05, F-OBS-02, F-OBS-03 — in that order.

---

## Findings

### F-OBS-01 — `apps/public-api` has zero Sentry/observability instrumentation [CRITICAL]

**Evidence:**
- `grep -rn Sentry /Users/mateusz.pitura/Repos/projects/contractor-ops/apps/public-api/src` returns **no matches**.
- `apps/public-api/src/index.ts:1-45` does not import Sentry, does not register `instrumentation.ts`, does not add a request-logging middleware.
- `apps/public-api/src/app.ts:41` registers `requestId()` (Hono middleware) but the resulting ID is never logged or attached to errors. CORS headers expose `X-Request-Id` to clients (line 57) but the server never logs it.
- `apps/public-api/src/lib/error-handler.ts:73-86` emits `log.error({ err }, 'unhandled error')` then a 500 with no requestId, no organizationId, no API key ID, no route path. Tracing a customer's 500 to a stack trace is impossible.

**Impact:** This is the *Enterprise* tier API. Customer reports of "I got a 500" cannot be resolved. There is no error capture, no alerting, no request-rate signal, no per-customer debug ability. Production-incident-blocking.

**Fix:** Mirror `apps/web/src/sentry.server.config.ts` for the Hono app, add a Hono logger middleware that emits `requestId`, `apiKeyId`, `path`, `method`, `status`, `durationMs`, and call `Sentry.captureException(err)` from `handleError`.

---

### F-OBS-02 — `requestId` does not propagate beyond the tRPC middleware

**Evidence:**
- `packages/api/src/middleware/observability.ts:43` mints `crypto.randomUUID()` per procedure and creates a child logger with `{ procedure, type, userId, organizationId, requestId }`.
- The child logger is *only* used inside the middleware itself (lines 58, 79, 98). It is not stored on `ctx`, not exported, not accessed by handlers.
- Routers use module-level loggers — `packages/api/src/routers/core/contract.ts:22` `const log = createLogger({ service: 'contract-router' });` — whose bindings are fixed at module import.
- Result: `contract.ts:265` `log.error({ err }, 'calendar sync on create failed')` emits no orgId, no userId, no requestId, no contractId. Sample inspection of router logs across 13+ files shows the same pattern (`document.ts:67`, `bacs.ts`, `late-payment-interest.ts`, etc.).
- Service-layer is identical — `packages/api/src/services/audit-writer.ts:22`, `packages/api/src/services/billing-service.ts:6`, etc. all hold one module logger.
- `grep -rn "ctx\.\(log\|logger\)" packages/api/src` returns zero matches.

**Impact:** When you grep Axiom for "calendar sync on create failed" you get a row with no way to know *which* contractor, *which* org, *which* user. To correlate with the parent trpc span you have to manually match by timestamp. Practically useless for support.

**Fix:** Pass the child logger through `next({ ctx: { ...ctx, log, requestId } })` in `observabilityMiddleware`, type it on `Context`, and have routers/services accept `ctx.log` (or pass it down).

---

### F-OBS-03 — QStash producer → consumer correlation is broken

**Evidence:**
- Producers do not include a trace/request ID in the QStash body:
  - `packages/api/src/routers/core/ocr.ts:152-161` — body is `{ extractionId, organizationId, storageKey }` only.
  - `packages/api/src/services/ocr-extraction.ts:53` — same.
  - `packages/api/src/routers/integrations/ksef.ts:234` — same shape, no trace id.
  - `packages/api/src/routers/finance/late-payment-interest.ts:529` — same.
  - `packages/api/src/services/zatca-submission.ts:315` — same.
- Consumers create fresh loggers with no link back: `apps/web/src/app/api/ocr/_process/route.ts:15` `createCronLogger('ocr-process')`; `apps/web/src/app/api/webhooks/_process/route.ts:13` `createWebhookLogger('process')`. No `requestId` field on any log line.
- Sentry spans are *not* connected: the `Sentry.startSpan` in observability.ts terminates with the producer's HTTP response — there is no `traceparent` header propagated into the QStash payload.

**Impact:** "User uploaded invoice → OCR ran → KSeF submission failed" is unfollowable across systems. Three separate Axiom queries by approximate timestamp.

**Fix:** Include `parentRequestId` (and ideally a `traceparent` per W3C) in every QStash payload. Consumer extracts and seeds its child logger / Sentry span.

---

### F-OBS-04 — No process-level handlers for `uncaughtException` / `unhandledRejection` in long-running processes [HIGH]

**Evidence:**
- `grep -rn "process\.on\|uncaughtException\|unhandledRejection" --include="*.ts"` across apps + packages returns only two hits in `packages/logger/src/axiom-stream.ts:43-44` (`beforeExit`, `SIGTERM` for flushing).
- `apps/web/worker-cron.mjs` (the Render `worker` Background Worker — `render.yaml:341`) is a long-running node-cron scheduler with no `uncaughtException`/`unhandledRejection` handlers. A stray async throw inside `triggerCron` is swallowed (it has try/catch) but a throw inside `cron.schedule` callback creation, or any module-level promise rejection, exits the process silently.
- `apps/public-api/src/index.ts` (Hono `node-server`) has no process-level handlers. A bug in any unawaited promise crashes the worker with no last-gasp Sentry capture.

**Impact:** Production worker silently dies → cron jobs stop → token refresh stops → integrations expire → customer impact, no alert. Render restart will recover, but you'll see the symptom not the cause.

**Fix:** Add at the top of each entrypoint:
```ts
process.on('unhandledRejection', (reason) => { log.fatal({ reason }, 'unhandledRejection'); Sentry.captureException(reason); });
process.on('uncaughtException', (err) => { log.fatal({ err }, 'uncaughtException'); Sentry.captureException(err); process.exit(1); });
```

---

### F-OBS-05 — Sensitive admin actions are not written to the audit log [HIGH]

**Evidence:**
- `packages/api/src/services/audit-writer.ts` exists and is solid. But only 13/79 routers call `writeAuditLog` (or `auditLog.create`):
  - `grep -rln writeAuditLog packages/api/src/routers` → 13 files (contract, contractor, classification, statusfeststellungsverfahren, gdpr, equipment*, bacs, invoice, portal, workflow-execution).
- **Routers with sensitive mutations that emit no audit row:**
  - `packages/api/src/routers/core/user.ts:156` `invite` — sends invitation, no audit.
  - `packages/api/src/routers/core/user.ts:176` `updateRole` — changes RBAC, no audit.
  - `packages/api/src/routers/core/user.ts:197` `deactivate` — bans user + reassigns approvals + transfers contractor ownership (lines 209-210), no audit.
  - `packages/api/src/routers/core/api-key.ts:43` `create` — issues API key (long-lived bearer token), no audit. `grep -n "writeAuditLog" api-key.ts` returns nothing.
  - `packages/api/src/routers/core/organization.ts:128` `update` — changes org name / billing email, no audit.
  - `packages/api/src/routers/core/settings.ts` — billing email change, no audit.
- The launch checklist (line 107) claims "Audit log covers all access to sensitive data — Comprehensive audit log in place" — code does not match.

**Impact:** Compliance/forensics gaps. A malicious admin can change roles, mint API keys, and lock other admins out, leaving no immutable trail. Also blocks SOC 2 / ISO 27001 evidence.

**Fix:** Mandatory `writeAuditLog` calls inside `user.updateRole`, `user.deactivate`, `user.invite`, `apiKey.create`, `apiKey.revoke`, `organization.update`, `settings.update*`. Consider a tRPC middleware that auto-emits AuditLog rows for any procedure annotated with a metadata flag (e.g., `t.procedure.meta({ audit: { action: 'org.update', resource: 'ORGANIZATION' } })`).

---

### F-OBS-06 — Outbound HTTP calls to integrations have no duration/status logging

**Evidence:**
- 30+ raw `fetch()` calls in `packages/integrations/src/adapters/*` with the pattern (jira-adapter.ts:80, 128, 279; notion-adapter.ts:69, 128, 182; google-workspace-adapter.ts:97, 147, 204, 248; google-calendar-adapter.ts:73, 123, 190, 257, 295, 328, 353; teams-adapter.ts:86, 141; outlook-calendar-adapter.ts:73, 124; confluence-adapter.ts:66, 116, 168, 230; linear-adapter.ts:81, 135, 311; autenti-adapter.ts:442; ksef-api-client.ts:412):
  ```ts
  const response = await fetch(url, { ... });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jira OAuth exchange failed: ${text}`);
  }
  ```
- No `start = performance.now()`, no `log.info({ provider, url, status, durationMs })`, no Sentry breadcrumb, no metrics.
- `packages/logger/createIntegrationLogger` exists and is used at module-scope but never wraps requests.

**Impact:** "Why is invoice intake slow?" → zero data. "Is Jira returning 429?" → no metric. "Did this OAuth refresh take 8s?" → unknowable.

**Fix:** Introduce a thin `loggedFetch(provider, url, init)` helper in `packages/integrations/src/lib/http.ts` that wraps fetch with duration + status logging + Sentry breadcrumb + metrics counter. Replace direct `fetch` in adapters.

---

### F-OBS-07 — `/api/health` is not a real health check

**Evidence:**
- `apps/web/src/app/api/health/route.ts:9-22` runs `prisma.$queryRaw\`SELECT 1\`` and returns 200. That is the entire check.
- `render.yaml:264` configures `healthCheckPath: /api/health` for the web service. Render uses this to decide when an instance is healthy.
- Critical dependencies NOT verified: Upstash Redis (rate limiter — middleware fails open if Redis is down per `apps/web/src/middleware.ts:87`), Upstash QStash (background jobs silently stall), Cloudflare R2 (uploads fail with cryptic errors), ClamAV pserv (file scanning broken), Unleash (feature flags fall back to default — may silently disable features), regional DBs (`DATABASE_URL_EU`/`DATABASE_URL_ME`).
- `apps/public-api/src/app.ts:77` is even simpler: `c.get('/health', c => c.json({ status: 'ok' }))` — does not check DB at all (`render.yaml:324` uses it as the public-api healthcheck).

**Impact:** Render reports the service as healthy even when uploads, rate limits, jobs, or feature flags are broken. Latent failures persist until customer reports.

**Fix:** Build a `/api/health/deep` (auth-gated) that actually pings each dependency with a 1s timeout and returns per-dep status. Keep `/api/health` cheap (DB only) for Render's frequent ping but flesh out `/api/health/deep` for monitoring. The public-api `/health` should at minimum check DB.

---

### F-OBS-08 — No PII scrubbing on Sentry events (Sentry can leak what Pino redacts)

**Evidence:**
- `apps/web/src/sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts` — none define `beforeSend`, `beforeBreadcrumb`, `sendDefaultPii: false`, `denyUrls`, or `ignoreErrors` for tax/bank fields.
- `packages/api/src/middleware/observability.ts:100-106` does `Sentry.captureException(error, { extra: { requestId, userId, organizationId } })` which is fine.
- But other call sites pass entire error objects whose `.message` may contain bank account numbers, tax IDs, emails (e.g. `apps/web/src/app/api/webhooks/stripe/route.ts:106` passes the raw error). Pino's `redact: { paths }` (`packages/logger/src/pii-mask.ts:14-67`) does NOT apply to Sentry payloads — they are independent transports.
- The shared PII keyword list (`PII_MASK_KEYWORDS`) is exported but never wired into Sentry.

**Impact:** A Zod validation error message containing the raw `vatNumber` or `iban` reaches Sentry uncensored. GDPR Art. 32 risk.

**Fix:** Add `beforeSend` to all three Sentry configs that walks the event (`event.exception.values[].value`, `event.request.data`, `event.extra`, `event.contexts`) and applies the same regex-based scrub used by Pino. There's also an opportunity to share `PII_MASK_KEYWORDS` between the two transports.

---

### F-OBS-09 — Auth endpoints have zero observability

**Evidence:**
- `apps/web/src/app/api/auth/[...all]/route.ts` is 4 lines: `export const { GET, POST } = toNextJsHandler(auth);` — no logging, no rate-limit metric, no Sentry instrumentation. Better Auth handles login, logout, magic-link, sign-up, password reset, OAuth callbacks via this endpoint.
- Login attempts (success/failure), magic-link sends, password resets, OAuth callbacks are all invisible to Pino and Sentry.
- `apps/web/src/components/auth/login-form.tsx:76-79` and similar forms swallow non-field errors into a generic `tc('networkError')` toast.

**Impact:** No way to detect a credential-stuffing attack from logs alone (rate limiter handles it but emits no per-attempt log line). No way to debug "user can't log in" without DB introspection.

**Fix:** Wrap `toNextJsHandler(auth)` with a thin logger middleware that records `path`, `method`, `status`, `durationMs`, IP (from Better Auth's request context), and forwards 5xx/auth errors to Sentry.

---

### F-OBS-10 — No Prisma slow-query log; no DB observability at all

**Evidence:**
- `packages/db/src/client.ts:17-20`: `new PrismaClient({ adapter })` — no `log: ['query', 'warn', 'error']`, no event subscription.
- `packages/db/src/region.ts` and `packages/db/src/raw.ts` — same.
- No `query` event handler that emits to Pino. No N+1 detection in dev.
- No metric for query duration histograms. The only DB observability is `prisma.$queryRaw\`SELECT 1\`` in the health check.

**Impact:** A slow query in production looks like "the app is slow" with no signal as to which procedure or which query is the culprit. No way to spot accidental N+1 in PR review without running the app and reading raw network logs.

**Fix:** In production, set `log: [{ emit: 'event', level: 'warn' }, { emit: 'event', level: 'error' }]` and pipe events to Pino. In dev, add `log: ['query']` behind a `PRISMA_LOG_QUERIES=1` env flag. Consider a per-request query counter via tRPC middleware (warn at >20 queries/request).

---

### F-OBS-11 — Background webhook processor swallows errors silently

**Evidence:**
- `apps/web/src/app/api/webhooks/_process/route.ts:197-208`:
  ```ts
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { deliveryStatus: 'FAILED', processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Processing failed' },
    });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
  ```
  No `log.error`, no `Sentry.captureException`. The error is persisted to the DB but never lands in Axiom or Sentry. The dead-letter health-check (`api/cron/job-health/route.ts`) eventually surfaces a *count* of failures, but the actual stack trace is lost (only the truncated `error.message`).
- `apps/web/src/app/api/webhooks/inpost/route.ts:118-124` — fire-and-forget `void handleInPostWebhook(...).catch(_err => { /* errors are logged inside */ })`. Comment claims errors are logged inside; if they aren't, they vanish.

**Impact:** Webhook processing failures (Jira, Linear, Resend, e-sign completion, InPost) are invisible until aggregate count crosses threshold. Single-event failures debugging requires hitting the DB.

**Fix:** Add `log.error({ err: error, deliveryId, provider })` and `Sentry.captureException(error, { tags: { 'webhook.provider': provider }, extra: { deliveryId } })` in the catch block. Verify `handleInPostWebhook` actually logs internally.

---

### F-OBS-12 — Standalone scripts use raw `pino()` not the shared baseOptions

**Evidence:**
- `packages/db/scripts/check-generated-drift.ts:37` — `const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });`
- `packages/db/scripts/push-all-regions.ts:21` — same.
- `packages/db/scripts/backfill-compliance-policy.ts:28` — same.
- `packages/db/scripts/backfill-scope-capabilities.ts:23` — same.
- `packages/db/prisma/seed/index.ts:6` — same.
- `apps/web/worker-cron.mjs:26-35` — inlines a partial copy of `baseOptions` (level, timestamp, formatters, base) but is missing `redact: { paths: PII_MASK_PATHS }`. PII written by the worker's logs is not masked.

**Impact:** Memory note explicitly says these should use `pino` "with same baseOptions" — they don't. Inconsistent log shapes across scripts (no `service` binding on db scripts; no PII redact on worker-cron.mjs).

**Fix:** Either expose the bare baseOptions from `packages/logger` (a `getBaseOptions()` factory) for consumers that can't import the full module, or build a tiny pure-JS sibling package consumable from `.mjs` scripts. Worker-cron MUST get the redact paths or it must never log user-supplied data.

---

### F-OBS-13 — ~45 `} catch {}` blocks in source paths suppress potentially important errors

**Evidence:**
- `grep -rEn "} catch \{$" apps packages --include="*.ts" --include="*.tsx" --exclude-dir=__tests__` returns ~45 hits.
- Worst offenders (mask actual errors that should reach the user or be alerted on):
  - `apps/web/src/components/auth/login-form.tsx:76,103` — login + magic-link errors collapse to a generic `tc('networkError')` toast.
  - `apps/web/src/components/auth/register-form.tsx:82`, `invite-accept-form.tsx:85`, `social-buttons.tsx:24` — same pattern in registration.
  - `apps/web/src/app/api/portal/clear-session/route.ts:26`, `set-session/route.ts:53` — silent failures during portal session handling.
  - `apps/web/src/app/api/health/route.ts:16` — health check eats the actual DB error and returns "Database connection failed". DB error message would be useful in logs.
  - `apps/web/src/components/portal/invoice-submit-form.tsx:402,593` — invoice submission errors swallowed.
  - `apps/web/src/components/payments/new-payment-run-dialog/step-{review,confirmation}.tsx:137,77` — payment run creation errors swallowed.
- Plus two literally-empty inline `} catch(e) {}` in `apps/landing/src/app/layout.tsx:62` and `apps/web/src/app/layout.tsx:51` (theme-init scripts; low-risk but a bad pattern).

**Impact:** Real bugs masked as "network error" toasts; DB outages surface as a generic 503 with no detail in Pino. Frontend-side these are slightly less critical (the user re-tries) but server-side every catch should at minimum log.

**Fix:** Sweep the list and either (a) re-throw / surface, (b) `log.warn({ err })` with context, or (c) add a `// reason: ...` comment explaining the safe-to-swallow case (similar to the `LOG_BODY_INCLUDE_PREFIXES` allowlist convention).

---

### F-OBS-14 — Sentry has no user/org scope set per request (only span tags)

**Evidence:**
- `grep -rn "Sentry.setUser\|Sentry.configureScope\|Sentry.setContext"` — zero matches across the entire codebase.
- `packages/api/src/middleware/observability.ts:60-70` sets the span attributes `user.id` and `org.id` but does NOT call `Sentry.getCurrentScope().setUser({ id: userId })` or `setTag('org.id', organizationId)`.
- Result: Sentry's UI "users affected" feature is empty, and you cannot filter all errors by user/org from the Sentry dashboard.

**Impact:** "How many customers are affected by this bug?" — Sentry can't tell you. "Show me all errors for org_acme" — manual span search.

**Fix:** In `observabilityMiddleware`, call `Sentry.getCurrentScope().setUser({ id: userId }).setTag('org.id', organizationId)` inside the `withIsolationScope` from `apps/web/src/app/api/trpc/[trpc]/route.ts:18` so per-request scope is enforced.

---

### F-OBS-15 — No RED metrics emitted for HTTP routes (only tRPC procedures)

**Evidence:**
- `packages/api/src/middleware/observability.ts:81-90` emits `trpc.duration` distribution and `trpc.calls` counter — good.
- `apps/web/src/app/api/trpc/[trpc]/route.ts` and the portal twin emit info logs but no metrics counter or histogram.
- Webhook routes (`api/webhooks/*`), cron routes (`api/cron/*`), public-api routes (`apps/public-api/src/routes/*`), auth route, OAuth callback — none emit metrics.
- Stripe webhook does emit `metrics.increment('webhook.processed', ...)` and `webhook.failed` — good. Generic webhook processor (`api/webhooks/_process/route.ts`) does not.

**Impact:** No request rate, error rate, or latency P95 dashboards possible for non-tRPC endpoints. "Are public-api 5xxs spiking?" is invisible.

**Fix:** Wrap each HTTP route with a small middleware (Hono in public-api, manual wrap in Next route handlers) that emits `http.requests` (counter, tags: route, method, status) and `http.duration` (distribution).

---

### F-OBS-16 — Worker-cron logs PII without redact

**Evidence:**
- `apps/web/worker-cron.mjs:26-35` instantiates Pino with `level`, `timestamp`, `formatters`, `base` — but no `redact`.
- Same script logs `{ job: job.name, status: res.status, durationMs }` (line 73) — currently safe, but any future field added (e.g., response body, error.message containing user emails) bypasses the central PII allowlist.

**Impact:** Drift risk. The worker is the easiest place to accidentally leak PII into Axiom because the lint:logs guard (scripts/lint-logs.mjs:34) excludes `*.mjs` (only globs `*.{ts,tsx}`).

**Fix:** Either (a) require the worker to be `.ts` and pass through the lint guard, (b) replicate `redact: { paths: PII_MASK_PATHS, censor: '[REDACTED]' }` inline, or (c) extend the `lint:logs` glob to cover `.mjs`.

---

### F-OBS-17 — Email addresses logged in plaintext in integration sync paths

**Evidence:**
- `packages/api/src/services/linear-issue-sync.ts:175` `{ email: assigneeEmail }` and line 182 `log.warn({ assigneeEmail }, 'no user found for email...')` — logs full email.
- The PII redact paths in `packages/logger/src/pii-mask.ts:14-67` redact tax IDs, bank/IBAN, auth tokens, but NOT `email`. There is no `'*.email'` entry.
- Memory note says "taxIds are masked for non-finance roles in UI" — but the email is also PII (GDPR Art. 4).

**Impact:** GDPR audit risk. Axiom retention policy now governs email PII. Right-to-erasure becomes harder if emails are scattered across log indexes.

**Fix:** Decide policy: either (a) add `'*.email'`, `'*.assigneeEmail'`, `'*.contactEmail'`, etc. to `PII_MASK_PATHS` and switch logs to log only a hash or domain, or (b) document explicit retention/deletion policy for log indexes containing email. Option (a) is the safer default.

---

### F-OBS-18 — `console.warn` lingers in two e2e setup files (lint-logs gap)

**Evidence:**
- `apps/web/e2e/perf/global-setup.ts:26` `console.warn(...)`
- `apps/web/e2e/functional/global-setup.ts:25` `console.warn('[functional] E2E_EMAIL / E2E_PASSWORD not set...')`

**Impact:** Low — these are test setup files, not in the production bundle. But the lint guard's exclusion of `e2e/` means new console.* in test setup paths won't be caught either. Minor consistency issue.

**Fix:** Replace with a small Pino script logger or drop to `process.stderr.write`. Update `scripts/lint-logs.mjs:36-38` exclude list documentation.

---

## Summary table

| ID | Severity | Title | Files |
|---|---|---|---|
| F-OBS-01 | CRITICAL | public-api has no Sentry/observability | apps/public-api/src/{app,index,lib/error-handler}.ts |
| F-OBS-02 | HIGH | requestId not propagated past tRPC middleware | packages/api/src/middleware/observability.ts |
| F-OBS-03 | HIGH | QStash producer/consumer correlation broken | packages/api/src/{routers,services}/* |
| F-OBS-04 | HIGH | No process-level error handlers | apps/public-api/src/index.ts, apps/web/worker-cron.mjs |
| F-OBS-05 | HIGH | Sensitive admin actions skip audit log | packages/api/src/routers/core/{user,api-key,organization,settings}.ts |
| F-OBS-06 | HIGH | No outbound HTTP observability | packages/integrations/src/adapters/* |
| F-OBS-07 | MEDIUM | Health endpoints are stubs | apps/web/src/app/api/health/route.ts, apps/public-api/src/app.ts:77 |
| F-OBS-08 | MEDIUM | Sentry has no PII scrubbing | apps/web/src/sentry.*.config.ts |
| F-OBS-09 | MEDIUM | Auth endpoint has zero logging | apps/web/src/app/api/auth/[...all]/route.ts |
| F-OBS-10 | MEDIUM | No Prisma slow-query log | packages/db/src/client.ts |
| F-OBS-11 | MEDIUM | Webhook processor swallows errors silently | apps/web/src/app/api/webhooks/_process/route.ts:197 |
| F-OBS-12 | MEDIUM | Scripts use raw pino without baseOptions | packages/db/scripts/*.ts, apps/web/worker-cron.mjs |
| F-OBS-13 | MEDIUM | ~45 silent catch blocks in source paths | various |
| F-OBS-14 | MEDIUM | Sentry user/org scope never set | packages/api/src/middleware/observability.ts |
| F-OBS-15 | MEDIUM | RED metrics only for tRPC, not HTTP routes | apps/web/src/app/api/*, apps/public-api/src/routes/* |
| F-OBS-16 | LOW | Worker-cron logs lack PII redact | apps/web/worker-cron.mjs:26 |
| F-OBS-17 | LOW | Email PII logged in linear sync | packages/api/src/services/linear-issue-sync.ts:175,182 |
| F-OBS-18 | LOW | console.warn in two e2e setup files | apps/web/e2e/{perf,functional}/global-setup.ts |

---

## What's working well (do not regress)

- `packages/logger/src/index.ts` — clean factory pattern (`createTrpcLogger`, `createCronLogger`, `createWebhookLogger`, `createIntegrationLogger`), pino-pretty in dev, JSON+Axiom in prod, `multistream` correctly switched on env.
- `packages/logger/src/pii-mask.ts` — comprehensive PII path list for UK/DE tax IDs, auth headers, bank fields. Body redact-by-default with explicit opt-in via `LOG_BODY_INCLUDE_PREFIXES` (currently empty — good default).
- `packages/api/src/middleware/observability.ts` — Sentry span + structured log per procedure with org/user attribution. The `LOG_BODY_EXCLUDE_PREFIXES` for `classification.*` (line 17) is exemplary.
- `packages/api/src/services/cron-monitor.ts` — Cronitor heartbeat wrapping for cron jobs.
- `apps/web/src/app/api/cron/job-health/route.ts` — full-loop monitoring: counts queue depth, fires Sentry alerts past threshold, marks stale deliveries as FAILED.
- `apps/web/src/app/api/webhooks/stripe/route.ts:104-116` — exemplary error path: log + Sentry + metric + correct retry semantics.
- `scripts/lint-logs.mjs` + `packages/logger/src/log-body-include-prefixes.ts` — body-log allowlist enforced by lint with baseline tolerance. Strong governance.
