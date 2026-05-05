# External Integrations Resilience Audit

_Audit date: 2026-05-03_
_Scope: `packages/integrations`, `packages/einvoice/asp/storecove`, `packages/einvoice/profiles/zatca`, `packages/gov-api`, `packages/api/services/{stripe-client,billing-webhook,courier/inpost-client,courier/inpost-polling-service,resend-client,app-email}`, `apps/web/src/app/api/webhooks/{stripe,storecove,inpost,[provider],_process}`._

---

## Executive summary

The codebase has the bones of a serious integration layer — `fetch-helpers.ts`, the `BaseAdapter`, `GovApiClient`, and the QStash-fronted webhook pipeline collectively prove the team understands timeouts, signature verification, idempotency tokens, and at-least-once delivery. The good parts are very good: Stripe webhook processing is wrapped in a Serializable transaction with `StripeEvent` dedup; e-sign webhooks dedup on `providerEventId`; QStash callback uses `updateMany` compare-and-swap to claim deliveries; OAuth refresh uses a real distributed lock via `refreshLockedAt`; signature verification across DocuSign/Autenti/Slack/Linear/Jira/Storecove uses `timingSafeEqual` with strict hex/base64 gating.

The bad parts are systemic, not per-adapter: **the `fetchWithTimeout` helper is not adopted across providers**. Of the 14 outbound adapters, only 4 (Slack, DocuSign, Autenti, BoE poller) use it. The other 10 — including all OAuth callbacks for Jira, Confluence, Linear, Notion, Outlook, Google Calendar, Google Workspace, Teams — call raw `fetch()` with **no timeout**, no retry, and no Retry-After honoring. A single hung Atlassian token endpoint will pin a Render instance until the platform request timeout fires (default 5 min on Render), exhausting the connection pool. Likewise `StorecoveClient` and `InPostClient` use `AbortSignal.timeout(30_000)` but never retry, never honor Retry-After, never paginate concurrency.

Beyond timeouts, the next-largest gap is **no circuit breaker anywhere**. The grep for `circuit|breaker|CircuitBreaker` returns zero hits. When KSeF/Storecove/ZATCA goes down, every queued QStash callback will keep hitting the dead upstream, burning rate limit budget, slamming our DB on each retry, and exhausting Sentry quota. The third systemic gap is **no idempotency keys on state-changing outbound calls** — Stripe checkout sessions, Storecove `submitDocument`, InPost `createShipment`, Resend `emails.send`, Slack `chat.postMessage`, Jira/Linear issue mutations all lack an `Idempotency-Key` (or provider-equivalent). After a 502 + retry from QStash, we will get duplicate Peppol invoices, duplicate parcel shipments, and duplicate transactional emails.

Highest priorities for production hardening:
1. **F-INT-01** — make `fetchWithTimeout` mandatory; ban raw `fetch()` in adapter files via a lint rule.
2. **F-INT-04** — add an `Idempotency-Key` story (Stripe, InPost, Storecove especially).
3. **F-INT-05** — add a circuit breaker per-provider (key = `provider`, half-open after 30s).
4. **F-INT-09** — bound `Promise.all` calendar fan-outs + `getAllProviderHealth` with `p-limit`.
5. **F-INT-13** — Storecove webhook is missing event-id dedup; relies on `transmissionId+detailsJson.guid` JSON-path query which is not unique-indexed.

---

## Adapter-by-adapter matrix

Legend: ✓ correct, △ partial, ✗ missing, n/a not applicable.

| Provider | File | Timeout | Retry | Breaker | Idempotency | Webhook dedup | Token refresh | Issues |
|---|---|---|---|---|---|---|---|---|
| Slack | `adapters/slack-adapter.ts` | ✓ (helper) | ✓ (helper, OAuth=0) | ✗ | ✗ on outbound `chat.postMessage` (not in this file but used elsewhere) | ✓ ts+HMAC freshness | n/a (non-expiring bot token) | F-INT-01 (outbound API not in adapter), F-INT-04, F-INT-12 |
| Resend | `adapters/resend-adapter.ts` + `services/app-email.ts` | △ (Svix verify in-memory; SDK send has SDK default only) | △ (no in-app retry; Resend SDK auto-retries 5xx without bounds) | ✗ | ✗ no `Idempotency-Key` header on `resend.emails.send` | △ (Svix replay protection only; no `WebhookDelivery.eventId` dedup before processing — relies on PROCESSED check) | n/a | F-INT-04, F-INT-13, F-INT-15 |
| Jira | `adapters/jira-adapter.ts` | ✗ raw `fetch()` everywhere | ✗ | ✗ | ✗ | △ HMAC + idempotent processing in `processJiraWebhook` (assumed) | ✓ refresh via raw `fetch()` (no timeout — F-INT-02) | F-INT-01, F-INT-02, F-INT-04, F-INT-08 |
| Confluence | `adapters/confluence-adapter.ts` | ✗ raw `fetch()` | ✗ | ✗ | n/a (read-only) | n/a (no webhooks) | ✗ raw `fetch()` | F-INT-01, F-INT-02 |
| Linear | `adapters/linear-adapter.ts` | ✗ raw `fetch()` (OAuth + GraphQL) | ✗ | ✗ | ✗ on outbound mutations | ✓ HMAC verify + dedup in `_process` | ✗ raw `fetch()` | F-INT-01, F-INT-02, F-INT-04 |
| Notion | `adapters/notion-adapter.ts` | ✗ raw `fetch()` | ✗ | ✗ | n/a (read-only) | n/a | ✗ raw `fetch()` | F-INT-01, F-INT-02 |
| Google Calendar | `adapters/google-calendar-adapter.ts` | ✗ raw `fetch()` for token + freebusy + CRUD | ✗ | ✗ | △ etag for `If-Match` on update only | n/a (no webhooks) | ✗ raw `fetch()` | F-INT-01, F-INT-02, F-INT-04 |
| Google Workspace | `adapters/google-workspace-adapter.ts` | ✗ raw `fetch()` | ✗ paginates uncapped (`while pageToken`) | ✗ | n/a | n/a | ✗ raw `fetch()` | F-INT-01, F-INT-02, F-INT-09 |
| Outlook Calendar | `adapters/outlook-calendar-adapter.ts` | ✗ raw `fetch()` | ✗ | ✗ | ✗ no `If-Match` etag | n/a | ✗ raw `fetch()` | F-INT-01, F-INT-02 |
| MS Teams | `adapters/teams-adapter.ts` | ✗ raw `fetch()` | ✗ | ✗ | n/a | n/a (Bot Framework owns) | ✗ raw `fetch()`; calls `decryptCredentials(credentials.accessToken,…)` which looks like a bug — accessToken is not the encrypted blob | F-INT-01, F-INT-02, F-INT-19 |
| Clockify | `adapters/clockify-adapter.ts` | n/a (no outbound code in adapter — sync layer not audited here) | n/a | n/a | n/a | n/a | n/a (API key) | none in this file |
| KSeF | `services/ksef-api-client.ts` (+ `adapters/ksef-adapter.ts` stub) | ✗ raw `fetch()` (own `fetchWithRetry` does not bound wall-clock — no AbortController) | ✓ exp backoff, honors Retry-After, GET-only by default | ✗ | ✗ no client-supplied invoice ID; KSeF assigns ref number on accept (acceptable) | n/a (polling only) | n/a (token-based) | F-INT-02, F-INT-03, F-INT-05 |
| DocuSign | `adapters/docusign-adapter.ts` | △ helper for OAuth only; SDK calls (`createEnvelope`, `getDocument`, `voidEnvelope`, `updateRecipients`) have **no timeout** — DocuSign SDK uses internal HTTP without configurable bounds | ✗ on SDK calls | ✗ | ✗ no client-supplied envelope ID; envelope `EmailSubject` is the only correlator | ✓ HMAC + `providerEventId` dedup in `esign-webhook-handler` | ✓ via helper | F-INT-04, F-INT-06, F-INT-16 |
| Autenti | `adapters/autenti-adapter.ts` | △ helper for OAuth; `autentiFetch()` for all REST is **raw `fetch()` no timeout** | ✗ | ✗ | ✗ | ✓ HMAC + `providerEventId` dedup | ✓ via helper | F-INT-02, F-INT-04, F-INT-06 |
| Claude OCR | `adapters/claude-ocr-adapter.ts` | △ Anthropic SDK has its own (default 600s) | △ SDK auto-retries; no app-level bound | ✗ | ✗ (extraction is read-only — low risk) | n/a | n/a (API key) | F-INT-06, F-INT-15 |
| Stripe (billing) | `services/stripe-client.ts`, `services/billing-webhook.ts`, `webhooks/stripe/route.ts` | △ Stripe SDK default timeout (80s) | ✓ SDK retries 5xx with backoff | ✗ | △ checkout sessions use stable `metadata.organizationId` for dedup but no `Idempotency-Key` header on `checkout.sessions.create` / `subscriptions.retrieve` | ✓ Serializable tx + `StripeEvent.processedAt` claim | n/a | F-INT-04 |
| Storecove (Peppol) | `einvoice/asp/storecove/client.ts`, `webhooks/storecove/route.ts` | ✓ `AbortSignal.timeout(30_000)` | ✗ | ✗ | ✗ on `submitDocument` (POST without idempotency key — Storecove docs list `Idempotency-Key` header) | △ JSON-path lookup on `eInvoiceLifecycleEvent.detailsJson.guid` (no unique index → race possible) | n/a (API key) | F-INT-04, F-INT-05, F-INT-13 |
| ZATCA | `einvoice/profiles/zatca/api-client.ts` (extends `GovApiClient`) | ✓ via `GovApiClient` (30s default) | ✓ exp backoff + jitter, idempotent-only | ✗ | △ ZATCA uses `uuid` per invoice + `invoiceHash` as dedup key — provider-managed (acceptable) | n/a (no inbound webhooks) | n/a (mTLS-cert/secret) | F-INT-05 |
| HMRC VAT / VIES | `gov-api/clients/{hmrc-vat,vies}-client.ts` | ✓ via `GovApiClient` | ✓ | ✗ | △ HMRC GovTalk uses `correlationId`; VIES is read-only | n/a | n/a / mTLS | F-INT-05 |
| InPost (ShipX) | `api/services/courier/inpost-client.ts`, `webhooks/inpost/route.ts`, `inpost-polling-service.ts` | ✗ raw `fetch()` no timeout, no signal | ✗ | ✗ | ✗ no `reference` dedup before POST (uses `external_customer_id` only) | △ HMAC verify + signature-match-or-payload-match resolves org; **no event-ID dedup on shipment events** (relies on `isEventDuplicate` shape comparison) | n/a (Bearer) | F-INT-02, F-INT-04, F-INT-09, F-INT-13 |
| Bank of England | `services/boe-base-rate-poller.ts` | ✓ AbortController 15s, body-read inside scope | ✗ (idempotent insert with manual override guard) | ✗ | n/a | n/a | n/a | minor |
| QStash (Upstash) | `services/qstash-client.ts` | △ SDK default | ✓ retries=3 on publish; Upstash retries delivery 3× | n/a | △ idempotency by `deliveryId` payload; no Upstash deduplication-id on publish | ✓ `verifySignatureAppRouter` | n/a | F-INT-11 |
| Infisical | `services/infisical-client.ts` | ✗ SDK default | ✗ no client-side retry on `get`/`set`/`delete` | ✗ | n/a | n/a | △ SDK `auth().universalAuth.login()` cached at module level; **never refreshed on token expiry** | F-INT-10, F-INT-14 |
| Anthropic (logger / OCR) | `claude-ocr-adapter.ts` | △ SDK default | △ SDK auto-retries | ✗ | n/a | n/a | n/a | F-INT-06 |
| Sentry | n/a | SDK-managed | SDK-managed | n/a | n/a | n/a | n/a | none |

---

## Findings

### F-INT-01: Most adapters bypass the shared `fetchWithTimeout` helper

- **Severity:** CRITICAL
- **Provider:** Jira, Confluence, Linear, Notion, Google Calendar, Google Workspace, Outlook Calendar, MS Teams (and partially Autenti REST + DocuSign SDK)
- **Location:**
  - `packages/integrations/src/adapters/jira-adapter.ts:80,128,279`
  - `packages/integrations/src/adapters/confluence-adapter.ts:66,116,168,230`
  - `packages/integrations/src/adapters/linear-adapter.ts:81,135,311`
  - `packages/integrations/src/adapters/notion-adapter.ts:69,128,182`
  - `packages/integrations/src/adapters/google-calendar-adapter.ts:73,123,190,257,295,328,353`
  - `packages/integrations/src/adapters/google-workspace-adapter.ts:97,147,204,248`
  - `packages/integrations/src/adapters/outlook-calendar-adapter.ts:73,124,210,282,314,338`
  - `packages/integrations/src/adapters/teams-adapter.ts:86,141`
  - `packages/integrations/src/adapters/autenti-adapter.ts:442` (`autentiFetch`)
- **Failure mode:** A hung upstream (TCP handshake completes, server stops sending bytes, or DNS times out at the OS level after 75s+) pins the Node event loop until Render's platform timeout fires — typically 5 minutes. During that time the request handler holds a Prisma connection from the pool (`packages/db` typically caps at 10 per region). Eight hung Atlassian OAuth refreshes will saturate the pool and 500 every other request. There is no circuit breaker to prevent the pile-up.
- **Fix:**
  1. Refactor every raw `fetch()` in `packages/integrations/src/adapters/*.ts` to call `fetchWithTimeout` from `services/fetch-helpers.ts`. For OAuth POSTs use `{ timeoutMs: 30_000, retries: 0 }` (matches Slack/DocuSign/Autenti precedent). For REST GETs use `{ timeoutMs: 15_000, retries: 2 }`.
  2. Add a Biome / ESLint rule banning bare `fetch(` in `packages/integrations/src/adapters/**/*.ts`. The single-source-of-truth helper is wasted unless it's enforced.
- **Effort:** M (mechanical refactor across 8 files; ~60 call sites).

---

### F-INT-02: No timeout on Atlassian / Microsoft / Google token refresh

- **Severity:** CRITICAL
- **Provider:** Jira, Confluence, Linear, Notion, Google Calendar, Google Workspace, Outlook, MS Teams
- **Location:** Same files as F-INT-01, in the `refreshToken()` methods.
- **Failure mode:** `token-refresh.ts:96` (`lazyRefresh`) and `:24` (`refreshExpiring` cron) acquire a DB-level lock and then call `adapter.refreshToken(credentials)`. If the upstream OAuth endpoint hangs, the lock is held for the full Render request timeout (5 min for `lazyRefresh`) or the cron's wall time (15 min for `refreshExpiring`). Other workers see the lock as fresh and back off. With 100 connections expiring within the cron window and a hung Atlassian endpoint, a single cron run cannot complete within the 15-minute boundary and the next cron starts on top, doubling the in-flight refresh count and tripling Atlassian outbound traffic when they recover.
- **Fix:** Same as F-INT-01 (use the helper). Specifically every `refreshToken()` body should be a `fetchWithTimeout(tokenUrl, init, { timeoutMs: 30_000, retries: 0 })`.
- **Effort:** S (already covered by the F-INT-01 sweep).

---

### F-INT-03: KSeF client owns its own retry loop with no wall-clock bound

- **Severity:** HIGH
- **Provider:** KSeF
- **Location:** `packages/integrations/src/services/ksef-api-client.ts:412` (`attemptFetch`), the polling loops at `:117-141` (auth) and `:217-250` (queryInvoices) sleep 30s and 120s in 1-2s increments.
- **Failure mode:** `attemptFetch` calls `fetch(url, options)` with no AbortController; the polling loops compound this — `authenticate()` can wait `30 × (fetch_timeout + 1s)` per session, and `queryInvoices()` can wait `60 × (fetch_timeout + 2s)`. With Node's default `fetch` (75s connect timeout), a hung KSeF endpoint can hold a request handler for over an hour. KSeF outages happen — they post planned maintenance windows on the gov portal — and during a real outage the cron-driven invoice import will stack handlers until Render OOM-kills the instance.
- **Fix:** Either (a) replace `fetchWithRetry` with `fetchWithTimeout` from the shared helper (recommended; reuse the same retry semantics) or (b) add an `AbortController` with a per-attempt timeout inside `attemptFetch`. Also cap the total polling wall-clock with a single `AbortController` shared across the loop.
- **Effort:** M.

---

### F-INT-04: No idempotency keys on state-changing outbound API calls

- **Severity:** CRITICAL
- **Provider:** Stripe, InPost, Storecove, Resend, Slack outbound, Jira issue creation, Linear issue creation, DocuSign envelope creation
- **Location:**
  - `packages/api/src/services/billing-service.ts:88` (`stripe.checkout.sessions.create`) — no `Idempotency-Key`
  - `packages/api/src/services/courier/inpost-client.ts:95` (`POST .../shipments`) — no idempotency header
  - `packages/einvoice/src/asp/storecove/client.ts:45` (`POST /document_submissions`) — no `Idempotency-Key` (Storecove documents this header)
  - `packages/api/src/services/app-email.ts:67,82` (`resend.emails.send`) — no `Idempotency-Key` header (Resend supports `x-idempotency-key`)
  - `packages/integrations/src/adapters/docusign-adapter.ts:345` (`envelopesApi.createEnvelope`)
  - Slack `chat.postMessage` callers (not audited here, but the adapter file shows no helper for outbound posts)
- **Failure mode:** QStash retries failed callbacks 3 times. Stripe webhook handler retries on 5xx. The cron jobs retry on next tick. Any handler that performs a state-changing outbound call between a successful upstream response and the local DB commit will, on retry, **call upstream again**: duplicate Peppol invoices to the receiver, duplicate parcels with two physical labels printed, duplicate trial-end emails to billing contacts. For Peppol, a duplicate transmission is a compliance issue (the receiver gets two copies, e-archives diverge from sender ledger).
- **Fix:**
  1. Stripe: add `idempotencyKey: deterministic(orgId, priceId, billingPeriod)` to every `checkout.sessions.create`, `subscriptions.update`, `customers.create`, `paymentMethods.attach` call.
  2. Storecove: add `headers: { 'Idempotency-Key': sha256(xml) }` on `submitDocument`.
  3. InPost: add `reference` (already present) + a hash header; or pre-flight a `GET /shipments?reference=…` lookup to detect a prior creation.
  4. Resend: add `'x-idempotency-key': sha256(to+subject+templateId+date)` (or a per-notification UUID) to every `resend.emails.send`.
  5. DocuSign: pass `application/json; charset=utf-8` with the SDK's `headers` argument for `X-DocuSign-Idempotency-Key`.
- **Effort:** L (touches multiple service files; needs a `withIdempotencyKey()` wrapper to standardize).

---

### F-INT-05: No circuit breakers anywhere in the integration layer

- **Severity:** HIGH
- **Provider:** All
- **Location:** `grep -r "circuit\|breaker" packages/integrations packages/einvoice packages/gov-api packages/api/src/services` returns zero hits.
- **Failure mode:** When KSeF, Storecove, ZATCA, DocuSign, or Resend has a regional outage, every queued QStash callback will keep hitting the dead upstream. Each failed call burns: (a) a Render request handler (max 1 min hold per fetch attempt + retries), (b) Sentry event quota (500 events/hour on the typical free plan), (c) outbound rate budget on the upstream when it half-recovers, and (d) a Prisma connection waiting for the audit insert. Without a breaker, the recovery storm slams the upstream the moment it returns, often re-tripping the outage. Stripe, Resend, and Anthropic specifically rate-limit aggressively after sustained 5xx — this is exactly the scenario their docs warn about.
- **Fix:** Add a per-provider in-process breaker (e.g. `opossum` or a hand-rolled counter keyed on `provider`) at the `fetchWithTimeout` layer. State machine: closed → open after N consecutive failures (default 5) → half-open after `resetTimeout` (default 30s). Persist the breaker state in Redis if you want cross-instance coordination (recommended for production). Surface the breaker state to `health-service.ts:18` so the health endpoint reports `DEGRADED` when a breaker is open.
- **Effort:** M.

---

### F-INT-06: DocuSign / Anthropic / Autenti SDK calls have no app-level timeout

- **Severity:** HIGH
- **Provider:** DocuSign, Anthropic Claude, Autenti REST
- **Location:**
  - `packages/integrations/src/adapters/docusign-adapter.ts:345,384,409,427,454,468,497` — every `envelopesApi.*` call uses the SDK's internal HTTP without a configurable per-call deadline
  - `packages/integrations/src/adapters/claude-ocr-adapter.ts:275` — `client.messages.create` uses Anthropic SDK default (600s + auto-retry)
  - `packages/integrations/src/adapters/autenti-adapter.ts:442` — `autentiFetch()` is bare `fetch()` for every REST call
- **Failure mode:** A signed-document download (`getSignedDocument`) for a large PDF can stream slowly; without a wall-clock the QStash callback can run >10 min and Upstash will deliver again. Anthropic's SDK auto-retry has a 600s default ceiling that compounds with our outer retry loop in `_process` if any code path opts in. Autenti REST GETs that include large signed PDFs (`getSignedDocument` calls `autentiFetch(..., { rawResponse: true })`) can hang on body read.
- **Fix:**
  1. DocuSign: pass `apiClient.timeout = 30_000` (the SDK's `ApiClient` exposes a `timeout` property) inside `getApiClient`. For `getSignedDocument`, raise to 60s.
  2. Anthropic SDK: pass `{ timeout: 90_000, maxRetries: 1 }` to the `Anthropic` constructor in `claude-ocr-adapter.ts:247`.
  3. Autenti: convert `autentiFetch` to use `fetchWithTimeout` (timeoutMs varies by op; default 15s, 60s for `rawResponse`).
- **Effort:** S each, M total.

---

### F-INT-07: Generic webhook ingress route stores raw body without schema validation

- **Severity:** MEDIUM
- **Provider:** Slack, Resend, Jira, Linear (all routed through `[provider]/route.ts`)
- **Location:** `apps/web/src/app/api/webhooks/[provider]/route.ts:67-71`
- **Failure mode:** The route falls back to `payloadJson = { raw: rawBody.slice(0, 10000) }` when JSON parsing fails. This persists to `WebhookDelivery.payloadJson` and the `_process` callback reads `delivery.payloadJson` and passes it to `adapter.handleWebhook`. Each adapter has its own ad-hoc `payload as DocuSignConnectPayload` cast — a malformed payload that survives signature verification but fails JSON parse will produce a `{ raw: '…' }` object that downstream handlers will treat as a real event and fail in unpredictable ways.
- **Fix:** Reject with 400 if the body cannot be parsed as JSON (Slack form-encoded path is the only legitimate exception and is already special-cased). At the `_process` boundary, validate `delivery.payloadJson` against a per-provider Zod schema before dispatch.
- **Effort:** S.

---

### F-INT-08: Jira webhook signature verification falls open when no secret is configured

- **Severity:** HIGH (security-adjacent, ranked under integrations resilience because it changes failure semantics)
- **Provider:** Jira
- **Location:** `packages/integrations/src/adapters/jira-adapter.ts:185-197`
- **Failure mode:** The adapter explicitly returns `{ valid: true }` when no secret is present, on the rationale that 3LO dynamic webhooks may not support custom secrets. In production with a misconfigured connection (`x-webhook-secret` header dropped at the proxy, or `IntegrationConnection.configJson.webhookSecret` accidentally cleared), an attacker who knows a `cloudId` can spoof Jira events. The risk note in the code says "the webhook pipeline falls back to ExternalLink matching for validation" but `apps/web/src/app/api/webhooks/[provider]/route.ts` does not perform that fallback — it just persists the delivery and queues processing.
- **Fix:** Either (a) require a webhook secret at connection-creation time and fail closed if absent, or (b) implement the documented `ExternalLink` fallback in the route layer with a `signatureValid: false` flag stored on the delivery so the `_process` route can decline to mutate state for unsigned events.
- **Effort:** S.

---

### F-INT-09: Unbounded fan-outs in calendar service and health aggregator

- **Severity:** MEDIUM
- **Provider:** Google Calendar, Outlook Calendar, all providers (health)
- **Location:**
  - `packages/api/src/services/calendar-event-service.ts:140,237,261` — `Promise.allSettled` over an array of contractor calendar invites with no concurrency cap
  - `packages/integrations/src/services/health-service.ts:113` — `Promise.all(adapters.map(a => getProviderHealth(...)))` runs all 14 adapter health queries in parallel; each issues 4 Prisma queries → up to 56 concurrent Prisma queries on every `/api/health` poll
  - `packages/integrations/src/adapters/google-workspace-adapter.ts:194` — `do…while(pageToken)` loops have no max-page guard (a directory with 100k users will fan 200 pages in serial; OK, but no safety)
  - `packages/api/src/services/courier/inpost-polling-service.ts:78` — sequential loop is fine but limited to 50; with hundreds of orgs this becomes a per-org cron stampede
- **Failure mode:** A single org with 500 contractors can saturate the Prisma pool (10 connections) on calendar invite creation, causing 503s for unrelated requests. The health endpoint scaling is the more dangerous case — operators or k8s liveness probes hammering `/api/health` will drag the DB to its knees.
- **Fix:**
  1. Wrap the calendar fan-outs in `p-limit(5)` keyed per provider (Google's `calendar.events.insert` has a 600 req/min quota; 5 is safe).
  2. Cache `getAllProviderHealth` in Redis with a 30s TTL.
  3. Add a per-org rate limit / queue for the calendar invite worker.
- **Effort:** S.

---

### F-INT-10: Infisical secrets are cached forever — no rotation handling

- **Severity:** HIGH
- **Provider:** Infisical
- **Location:** `packages/integrations/src/services/infisical-client.ts:73,182-207`
- **Failure mode:** `InfisicalSecretStore` caches the SDK instance and the auth token on first use (`this.sdk` + `this.initPromise`). There is no refresh path: when Infisical rotates a machine-identity token (default 7 days), every subsequent `get`/`set`/`delete` will fail with 401 until the process restarts. ZATCA certificate rotation specifically (T-48-14 referenced in the file) is impossible with the current code — even when a new secret is `set`, the in-memory copy of the prior `get` result is still held by the caller (e.g. `zatca-submission.ts:115` reads cert + key + secret in parallel and uses them locally).
- **Fix:**
  1. Detect 401 from any SDK call, null out `this.sdk` + `this.initPromise`, retry once via `ensureInitialized()`.
  2. Add a TTL on the cached SDK (e.g. recreate every 6 days) so the auth token never goes stale.
  3. For ZATCA in particular, document that callers must NOT cache secret values — every submission re-fetches.
- **Effort:** M.

---

### F-INT-11: QStash publish has no Upstash deduplication-id

- **Severity:** MEDIUM
- **Provider:** QStash (Upstash)
- **Location:** `packages/integrations/src/services/webhook-dispatcher.ts:70`, `apps/web/src/app/api/webhooks/[provider]/route.ts:122`
- **Failure mode:** QStash supports the `Upstash-Deduplication-Id` header to prevent duplicate publishes. Without it, a webhook delivered by Slack twice (Slack does retry on 5xx within 1 minute) will create two `WebhookDelivery` rows and queue two QStash messages. The downstream `_process` route's compare-and-swap claim does prevent double-processing of the *same* `deliveryId`, but it cannot prevent two `deliveryId`s for the same Slack event from racing — both could insert a JIRA issue in `processJiraWebhook`, etc.
- **Fix:** Pass `'upstash-deduplication-id': hash(provider, signaturePrefix, eventTypePrefix)` in `qstash.publishJSON({ headers: ... })`. Also extract a stable provider-event-id (Stripe's `event.id`, Slack's `envelope_id`, etc.) and put it on `WebhookDelivery.providerEventId` (new column) with a unique index `(provider, providerEventId)` so the *outer* dedup is at the DB layer.
- **Effort:** M.

---

### F-INT-12: Outbound Slack/Teams messages have no rate-limit awareness

- **Severity:** MEDIUM
- **Provider:** Slack, MS Teams (outbound), Linear/Jira mutations
- **Location:** Outbound `chat.postMessage`/`channels.history` calls live in `packages/api/src/services/notification-service.ts` and similar — none of them honor Slack's per-channel `1 req/sec` limit or Teams' bot-conversation throttle.
- **Failure mode:** When a contractor with 50 Slack DMs is bulk-notified (e.g. monthly reminder fan-out), all 50 messages are sent concurrently. Slack returns 429s, the helper's exponential backoff kicks in **per call**, and the cron stretches from seconds into minutes. Slack also penalises sustained over-quota by lengthening the `Retry-After` window (up to 1 hour), which can stall reminder cycles entirely.
- **Fix:** Wrap outbound Slack calls in `p-limit(1)` keyed per channel. Teams: `p-limit(2)` per conversation. For the rate limit itself, keep `fetchWithTimeout`'s `Retry-After` honoring but wrap the whole bulk-send in a single `Bottleneck` instance per workspace.
- **Effort:** M.

---

### F-INT-13: Storecove / Resend webhook dedup relies on JSON-path queries without a unique index

- **Severity:** HIGH
- **Provider:** Storecove (and Resend follows the same pattern)
- **Location:**
  - `apps/web/src/app/api/webhooks/storecove/route.ts:151-158` — `prisma.eInvoiceLifecycleEvent.findFirst({ where: { detailsJson: { path: ['guid'], equals: guid } } })`
  - `apps/web/src/app/api/webhooks/[provider]/route.ts:110` — creates `WebhookDelivery` with no per-event ID
- **Failure mode:** Two concurrent webhook deliveries for the same Storecove `guid` both reach the `findFirst` check, both see `null`, both proceed to insert. No unique constraint exists on `eInvoiceLifecycleEvent.detailsJson->>'guid'` (Postgres can't index a JSON path easily without a generated column). Result: duplicate `DELIVERY_ACK` events, duplicate audit trail entries, and the lifecycle row may be flipped from DELIVERED to FAILED if the second event arrived while a corrective transmission is in flight.
- **Fix:** Add `EInvoiceLifecycleEvent.providerEventId String? @unique`, populate it from `payload.metadata.guid`, and let the unique constraint do the dedup (catch `P2002` and return 200). Same pattern for `WebhookDelivery.providerEventId` (see F-INT-11). Drop the `detailsJson.path` query.
- **Effort:** S (migration + 4-line route change).

---

### F-INT-14: Infisical SDK / KSeF / Resend errors not classified — every failure is "transient"

- **Severity:** MEDIUM
- **Provider:** Infisical, KSeF, Resend (Svix verify)
- **Location:**
  - `packages/integrations/src/services/infisical-client.ts:99,121,151` — `isNotFoundError` does substring matching on `error.message` (fragile across SDK versions)
  - `packages/integrations/src/services/ksef-api-client.ts:383` — `isNonRetryableApiError` only matches messages that start with `KSeF API error`
  - `packages/integrations/src/adapters/resend-adapter.ts:91-100` — every `webhooks.verify` failure is logged as "signature failure" even when the cause is e.g. an SDK bug or invalid JSON
- **Failure mode:** A poison-pill webhook (e.g. invalid base64 in Resend's signature) keeps getting retried forever. KSeF auth-credential failures (token expired, NIP unauthorized) are treated as retryable (they manifest as 401/403 in the wrong code path). Infisical not-found errors are masked but other 4xx errors (permission denied, invalid path) flow through as "Failed to retrieve secret" 500s.
- **Fix:** Build a small `classifyError(err): 'permanent' | 'transient' | 'auth'` helper per provider keyed on (a) HTTP status, (b) provider error code (where present in the payload), (c) SDK error class. Use it in the retry loop and surface to Sentry tags so on-call can grep by class.
- **Effort:** M.

---

### F-INT-15: Resend SDK `webhooks.verify` is rebuilt per webhook, allocating Svix machinery on hot path

- **Severity:** LOW
- **Provider:** Resend
- **Location:** `packages/integrations/src/adapters/resend-adapter.ts:25-30` and `apps/web/src/app/api/webhooks/[provider]/route.ts:48`
- **Failure mode:** Each webhook reconstructs the Resend client (`new Resend(apiKey)`) when the API key is the cache miss path. Under burst (Resend retries failed deliveries 6 times in 5 minutes), the per-call SDK cost adds latency that pushes the route past the 30s edge-runtime ceiling.
- **Fix:** The cache key already exists, but the comment at line 22 admits the verify path doesn't make a network call so the cost is module load only. Acceptable as-is. If we move this off the edge runtime to a Node Lambda the issue vanishes.
- **Effort:** S.

---

### F-INT-16: DocuSign embedded signing URL has no TTL surfaced; re-issue logic missing

- **Severity:** MEDIUM
- **Provider:** DocuSign
- **Location:** `packages/integrations/src/adapters/docusign-adapter.ts:360-400`
- **Failure mode:** The comment at line 396 acknowledges DocuSign doesn't return a TTL and we omit `expiresAt`. But the caller (in `packages/api/src/services/esign-orchestrator` per the wiring) has no signal to re-request the URL — if a recipient takes >5 min to click the link from a notification email, they get a confusing DocuSign error page. There is no exponential refresh on failure.
- **Fix:** Either (a) document the URL must be requested at click-time, not at email-send-time (and update the contract router accordingly), or (b) add a wrapper that re-issues the URL on the front-end if it returns 410. Option (a) is the production pattern.
- **Effort:** M.

---

### F-INT-17: BoE poller is the only outbound code that bounds body-read time

- **Severity:** LOW (positive note + reminder for the rest)
- **Provider:** All others
- **Location:** `packages/integrations/src/services/boe-base-rate-poller.ts:267-295` — model implementation: AbortController bounds both fetch + `response.text()`.
- **Failure mode:** Every other fetch in the codebase reads the body **outside** the timeout's protective scope: `const r = await fetch(...); const j = await r.json();` lets the body read run unbounded after the connect timer fires. This is most painful for `getSignedDocument` (DocuSign + Autenti) — the body is the actual signed PDF and can be megabytes.
- **Fix:** The `fetchWithTimeout` JSDoc already explains this pattern. Standardize on a `fetchJsonWithTimeout(url, init, opts)` helper that does the body read inside the same `try/finally` and clears the timer afterwards.
- **Effort:** S (one helper + adopt across adapters in the F-INT-01 sweep).

---

### F-INT-18: No backoff jitter in `fetch-helpers.ts` (only in `gov-api`)

- **Severity:** MEDIUM
- **Provider:** All adapters using `fetchWithTimeout`
- **Location:** `packages/integrations/src/services/fetch-helpers.ts:50` — `exponentialBackoffMs(attempt)` returns `Math.min(1000 * 2^attempt, 10_000)` — no jitter.
- **Failure mode:** When a regional outage trips many connections at once, all retries fire at exactly `+1s`, `+2s`, `+4s`, `+8s` — the classic thundering herd. The `gov-api/client.ts:203` retry uses **full jitter** (AWS recommendation): `random(0, min(base*2^n, cap))`. The integrations helper should do the same.
- **Fix:** Replace `exponentialBackoffMs(attempt)` with `Math.floor(Math.random() * Math.min(1000 * 2^attempt, 10_000))`.
- **Effort:** S.

---

### F-INT-19: Teams adapter `refreshToken` decrypts the wrong value

- **Severity:** HIGH (functional bug)
- **Provider:** MS Teams
- **Location:** `packages/integrations/src/adapters/teams-adapter.ts:127`
- **Failure mode:** `const decrypted = decryptCredentials(credentials.accessToken, 'microsoft_teams');` — but `credentials` is already a `CredentialBlob` (returned by `decryptCredentials` upstream in `token-refresh.ts:151`), so `credentials.accessToken` is the bearer token, NOT the encrypted blob. This call will throw `Invalid encrypted credentials format. Expected iv:authTag:ciphertext` every time. Either Teams refresh has never been exercised in production or the refresh path is dead code. Either way, no Teams connection can survive past its initial token expiry (typically 1 hour).
- **Fix:** Drop the `decryptCredentials` call. The `credentials` parameter is already the decrypted blob. Use `credentials.refreshToken` directly. (Compare to `jira-adapter.ts:124` which does the same correctly.)
- **Effort:** XS.

---

### F-INT-20: KSeF session polling has no shared bounding signal

- **Severity:** MEDIUM
- **Provider:** KSeF
- **Location:** `packages/integrations/src/services/ksef-api-client.ts:117-141,217-250`
- **Failure mode:** Both polling loops use a sleep+retry pattern with hard-coded counts (30 / 60 attempts) and no AbortController. If `authenticate()` is called from a tRPC mutation that already has its own deadline (`apps/web/src/trpc/init.ts:22` enforces 30s), the tRPC handler will return to the client at 30s but the KSeF poll keeps running for another 5+ seconds — "fire and forget" within a request handler that has already responded. Worse: there's no propagation if the caller cancels.
- **Fix:** Accept an optional `signal: AbortSignal` parameter on `authenticate`, `queryInvoices`, `downloadInvoiceXml` and check it inside each polling iteration. Plumb the request-scoped signal from tRPC.
- **Effort:** M.

---

### F-INT-21: Stripe webhook does not guard against very-late deliveries

- **Severity:** LOW
- **Provider:** Stripe
- **Location:** `apps/web/src/app/api/webhooks/stripe/route.ts:42-48`
- **Failure mode:** Stripe's `constructEvent` enforces a 5-minute timestamp tolerance by default. Good. But there is no max-age check on the *event* itself (`event.created`). A delayed Stripe redelivery (Stripe retries up to 3 days) can still push old credit allocations into the current period. The `OcrCreditLedger.stripeEventId` dedup catches the exact duplicate but not a stale event arriving after a manual `OcrCreditLedger` adjustment.
- **Fix:** Reject (with 200 + log) events older than 24h unless they are explicitly classified as "settlement" events (e.g. `charge.refunded`) where late arrival is normal.
- **Effort:** S.

---

### F-INT-22: No connection reuse signaling — every call uses `globalThis.fetch` with default keep-alive

- **Severity:** LOW
- **Provider:** All
- **Location:** Across the package; no shared `undici.Agent` configured.
- **Failure mode:** Node 20's default `fetch` (undici) uses keep-alive, so this isn't broken — but there's no shared agent with explicit `keepAliveTimeout` / `keepAliveMaxTimeout` tuning. Under heavy load against the same upstream (e.g. 100 calendar inserts to Google in a burst), default agent state may close idle sockets too aggressively, causing TLS handshake costs to dominate.
- **Fix:** Create a single `undici.Agent` per provider host with `{ keepAliveTimeout: 60_000, keepAliveMaxTimeout: 600_000, connections: 10 }`, set as the dispatcher in `fetchWithTimeout`. Defer until profiling shows TLS handshake is on the critical path.
- **Effort:** M.

---

### F-INT-23: `health-service.ts` does not surface dependency health at process level

- **Severity:** MEDIUM
- **Provider:** All
- **Location:** `packages/integrations/src/services/health-service.ts:18-100`
- **Failure mode:** The function reports per-(org, provider) connection state from DB rows — it doesn't actually probe the upstream. The Render readiness probe and any external `/api/health` endpoint will return "healthy" while the integrations layer is wholly down. There is no breaker-state, no per-provider error rate, no upstream RTT.
- **Fix:** Add a separate `checkProviderLiveness(provider)` that does a low-cost probe per provider (Storecove `GET /version`, Stripe `balance.retrieve`, Anthropic `models.list` — pick the cheapest billed/non-billed endpoint each). Cache the result in Redis with a 60s TTL. Surface in `/api/health` for k8s/Render readiness.
- **Effort:** M.

---

## Cross-cutting recommendations (priority order)

1. **Make `fetchWithTimeout` mandatory** (F-INT-01, F-INT-02). One mechanical PR that converts every `fetch(` in `packages/integrations/src/adapters/*.ts` and adds a Biome/ESLint rule. This fixes the highest-impact gap.
2. **Add an idempotency-key story** (F-INT-04). Build a `withIdempotencyKey<T>(key, fn)` wrapper plus per-provider conventions (Stripe SDK option, Storecove header, Resend header, etc.). Document it in `packages/integrations/README` if one exists, otherwise add the convention to the adapter base class.
3. **Add a circuit breaker** (F-INT-05) at the `fetchWithTimeout` layer keyed by provider host. Use Redis-backed state for cross-instance coordination. Surface in `/api/health`.
4. **Bound fan-outs** (F-INT-09) — `p-limit(5)` for calendar fan-outs, `p-limit(1)` per Slack channel, cache `getAllProviderHealth`.
5. **Webhook event-ID dedup at DB level** (F-INT-11, F-INT-13). Add `WebhookDelivery.providerEventId` and `EInvoiceLifecycleEvent.providerEventId` with unique indexes; let DB do the dedup work.
6. **Fix the Teams refresh bug** (F-INT-19) — XS effort, eliminates a complete loss-of-functionality.
7. **Infisical token-rotation** (F-INT-10) — needed before the first Infisical machine-identity TTL expires in production.
