# Phase 100: Theme C — Outbound Webhooks + Integration Security - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 100 makes Contractor Ops **push signed, PII-safe events to customer-supplied URLs** — and does it
without handing an attacker an SSRF primitive. It delivers twelve locked requirements
(INTEG-WEBHOOK-01..07 + INTEG-SEC-01..05):

- **`WebhookSubscription` model** — per-org, per-event-filter, target URL, per-subscription HMAC secret,
  retry policy, enabled flag, last-success / last-failure timestamps (INTEG-WEBHOOK-01).
- **Event catalog + Zod discriminated-union payloads** — `contractor.{created,updated,offboarded,
  compliance_blocked}`, `invoice.{received,matched,approved,rejected,paid}`, `payment_run.{created,
  completed}`, `workflow.{task.completed,completed}`, `classification.outcome`, `compliance_doc.
  {expiring_soon,expired}` (INTEG-WEBHOOK-02).
- **Greenfield outbound dispatcher on the EXISTING `OutboxEvent` outbox + QStash** — the outbox already
  reserves the `'integration.webhook.publish'` event type (see `outbox/handlers.ts:29`). Reuse the
  transactional-outbox seam for the fan-out trigger; per-subscription delivery gets its own drain with the
  webhook backoff (1m/5m/30m/2h/12h/24h, **max 6**), a DLQ (`webhook_failures`), and an admin alert at 5
  failures/1h (INTEG-WEBHOOK-03). **Distinct from the INBOUND `webhook-dispatcher.ts` / `WebhookDelivery`
  model** — do NOT overload it.
- **HMAC-SHA256 signature** — `X-CO-Signature: t={unix_ms},v1={hex_hmac}` (Stripe convention), per-sub
  secret, 5-minute replay window; sample verifiers in TS/Python/Go/PHP (INTEG-WEBHOOK-04, -05).
- **PII redaction** — `include_pii: false` default strips PESEL/SSN/NI/Steuer-IdNr/Emirates ID/Iqama/email/
  phone (RODO-defensible) (INTEG-WEBHOOK-07).
- **Subscription management API + UI** — Settings → Developer → Webhooks with test-fire + last-100-
  deliveries log (INTEG-WEBHOOK-06).
- **SSRF guard with DNS-rebinding protection** — customer URLs are hostile input; reject private / loopback
  / link-local / `169.254.169.254` at BOTH subscribe time AND dispatch time, re-resolve + IP-pin
  immediately before connect, redirects disabled, via `request-filtering-agent` (INTEG-SEC-01).
- **HTTPS-only by default** (HTTP only via per-org admin override + warning) (INTEG-SEC-02); per-
  subscription dispatch rate limit **100 events/min** (INTEG-SEC-03); **OWASP API Top-10 review as
  automated tests** at the phase gate (INTEG-SEC-04); **API-key leak alarm** at >3 source IPs in 24h,
  consuming the P99 `ApiKeyIpEvent` log (INTEG-SEC-05).

**Phase 100 ALSO OWNS the write flag-flip Phase 99 deferred.** Phase 99 built the public WRITE surface
DOUBLE-DARK (per-org `module.public-api` off + `hide:true` on the write routes). After the INTEG-SEC-01/-04
OWASP gate passes, Phase 100 performs the deliberate, gated act: **flip `module.public-api` per org +
un-hide the write routes + promote the SDK to include writes**. This is an explicit human-checkpoint plan
(100-09), never an automatic flip.

**Depends on:** Phase 99 (`ApiKeyIpEvent` source-IP log, `TIER_WEBHOOK_SUBSCRIPTION_CAP` in
`api-tier-limits.ts`, the double-dark write surface, `apiKeyTenantProcedure`, `writeAuditLog` with
ip/UA). **NOT this phase:** marketplace listings (Zapier/n8n/Make), full DX portal, SDK 1.0 promotion,
Postman/Insomnia, status page, sandbox tier — all **Phase 101**. `_initiatePayoutForRun` stays deferred.
</domain>

<decisions>
## Implementation Decisions

### D-01 (locked) — reuse the outbox for the FAN-OUT trigger; per-delivery retry is webhook-specific
The `OutboxEvent` outbox (`packages/api/src/services/outbox/`) is the transactional seam: a business write
`enqueueOutboxEvent({ tx, eventType: 'integration.webhook.publish', payload })` inside its existing
`$transaction`, so the event is durable iff the write commits. The outbox drain (`/outbox/_drain`, QStash
every 30s) dispatches it through a NEW handler registered for `'integration.webhook.publish'`. **That
handler is FAN-OUT ONLY**: resolve every enabled `WebhookSubscription` whose event filter matches, snapshot
the (redacted) payload, and INSERT one `WebhookDeliveryAttempt` row per subscription — then return
(outbox row → DISPATCHED). **Per-subscription delivery + retry does NOT ride the outbox's fixed backoff**
(4m base, max 5, 1h cap — mismatched with the webhook schedule). A dedicated `WebhookDeliveryAttempt` drain
(`/webhooks-outbound/_deliver` + `JobRegistry 'webhook.deliver'`) mirrors the outbox's CLAIM → DISPATCH →
FINALIZE structure (`FOR UPDATE SKIP LOCKED`) but with the webhook backoff (1m/5m/30m/2h/12h/24h, max 6)
and terminal → `webhook_failures` DLQ. **Rejected: one OutboxEvent per (event × subscription).** That
couples fan-out to the producer's transaction and forces the outbox's retry semantics onto per-endpoint
delivery. Fan-out at drain time keeps the producer cheap and gives webhooks their own retry/DLQ contract.

### D-02 (locked) — the outbound model is NAME-DISTINCT from the inbound `WebhookDelivery`
`WebhookDelivery` already exists (`integration.prisma`) for INBOUND provider webhooks (Jira/Linear/Resend/
Storecove → us). The outbound surface introduces **new** models: `WebhookSubscription` (the endpoint),
`WebhookDeliveryAttempt` (one outbound send attempt), and the DLQ `WebhookDeadLetter` (@@map
`webhook_failures`). **Never reuse `WebhookDelivery` for outbound** — the RLS policies, dedup constraints,
and reaper in `job-health.ts` are inbound-shaped. One migration adds all three; the `module.outbound-
webhooks` dispatch gate is consumed (flag already exists in the registry, default off).

### D-03 (locked) — SSRF guard is the CONTROL, checked at BOTH subscribe AND dispatch time
Customer URLs are hostile. A single `assertWebhookUrlSafe(url)` (`webhooks/ssrf-guard.ts`) is called (a) at
subscribe/update time (reject before persisting) AND (b) at dispatch time immediately before connect
(re-resolve DNS + pin the resolved IP for the actual socket, redirects disabled) to defeat DNS rebinding
(TOCTOU: a name that resolved public at subscribe time re-resolving to `10.x`/`169.254.169.254` at
delivery). Backed by `request-filtering-agent` (blocks RFC 1918, loopback, link-local, ULA `fc00::/7`, the
cloud-metadata `169.254.169.254`, `::1`, `0.0.0.0`) as the http/https Agent, plus an explicit pre-flight
resolve+classify so subscribe-time rejection does not require a live request. **HTTPS-only** by default
(INTEG-SEC-02); HTTP is a per-org admin override with a warning banner, still SSRF-checked.

### D-04 (locked) — HMAC signature is Stripe-convention, replay-resistant, per-subscription secret
`X-CO-Signature: t={unix_ms},v1={hex_hmac}` where `v1 = HMAC_SHA256(secret, "{t}.{raw_body}")`. The signed
string binds the timestamp so a captured body cannot be replayed outside the **5-minute acceptance window**
(the sample verifiers reject `|now - t| > 300s` BEFORE the constant-time digest compare). The per-
subscription secret (`whsec_…`, 256-bit) is generated at subscribe time, shown once; it CANNOT be one-way
hashed (we must re-sign every delivery), so it is stored **encrypted at rest** (reuse the existing secret-
at-rest pattern for `IntegrationConnection.configJson` secrets) and never returned after creation except
via an explicit reveal/rotate. Signing reuses the repo idiom: `createHmac('sha256', secret).update(
signedPayload).digest('hex')` + `timingSafeEqual` in the verifiers (mirrors `storecove/adapter.ts:354`,
`inpost-webhook-handler.ts`).

### D-05 (locked) — dispatch is gated behind `module.outbound-webhooks` (default off) — a kill switch
Nothing dispatches until an org is granted `module.outbound-webhooks` (already in the registry, default
false, sign-off-gated). Subscriptions can be created + tested (test-fire hits a local mock receiver in dev)
and the full DLQ/redaction/HMAC path is buildable + testable now WITHOUT the flag — the flag gates only
live event dispatch. This is the EXTERNAL-ENABLEMENT posture: the SSRF guard is the control (not a
deferral), and the flag is the kill switch.

### D-06 (locked) — the P99 write flag-flip is a GATED, human-checkpoint act at the END (100-09)
The write surface Phase 99 built stays double-dark through Phase 100 until INTEG-SEC-04 (OWASP API Top-10
automated tests) is GREEN. Then 100-09 (human-checkpoint) flips `module.public-api` per org, un-hides the
write routes (`hide:true` removed → they appear in `buildOpenApiDocument` / Scalar / SDK), and promotes the
SDK to include writes. **This is never automatic** — the OWASP gate test suite is the precondition, and a
human confirms before the flip.

### Claude's Discretion
- DLQ shape: dedicated `WebhookDeadLetter` model (`webhook_failures`) vs a terminal FAILED status on
  `WebhookDeliveryAttempt` + a replay flag (lean: dedicated model so replay + retention are first-class).
- Per-subscription secret at-rest: encrypt-at-rest (reuse `configJson` secret encryption) vs env-KMS; must
  be recoverable for re-signing (cannot be one-way hashed like an API key).
- Dispatch rate-limit backend: Upstash fixed/sliding window keyed `whrl:{subscriptionId}:{minute}` (reuse
  the P99 quota-counter idiom) vs in-memory (lean: Upstash, fail-open on limiter outage so a limiter blip
  does not drop legitimate events, but log).
- Sample-verifier home: `apps/public-api/docs/webhooks/verifiers/{ts,py,go,php}` (consumed by the Phase-101
  portal) vs a `packages/` fixtures dir the signer test asserts against (lean: docs dir + a test that
  round-trips the TS verifier against the signer so the doc cannot drift).
- Leak alarm delivery: Sentry `captureMessage` + org-admin notification (reuse `notification-service` /
  the `job-health.ts` FAILURE_ALERT_THRESHOLD idiom).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — INTEG-WEBHOOK-01..07 (lines 177-183) + INTEG-SEC-01..05 (187-191) verbatim.
- `.planning/ROADMAP.md` (Phase 100 entry) — goal + 4 success criteria + the research flag (OWASP as real
  tests; outbound SSRF greenfield via `request-filtering-agent`; do NOT overload inbound
  `webhook-dispatcher.ts`).
- `.../99-theme-c-api-keys-scopes-rate-limiting/99-CONTEXT.md` (D-03 double-dark; the write flag-flip is
  Phase 100), `99-RESEARCH.md` § A6 (writes double-dark), `99-100-HANDOFF.md` (authored by 99-08 — the
  write-flip sequencing + `TIER_WEBHOOK_SUBSCRIPTION_CAP` + `ApiKeyIpEvent` consumption; **read it if
  present**). NB: Phase 99 lands before 100 executes; these paths resolve after 99 merges.
- `.planning/EXTERNAL-ENABLEMENT.md` register row #8 (public-API write endpoints, `module.public-api` OFF)
  — the flip 100-09 performs.

### Outbox reuse (the fan-out seam — DO NOT build a new dispatcher)
- `packages/api/src/services/outbox/index.ts` — `enqueueOutboxEvent` (producer, transactional) +
  `drainOutboxBatch` (CLAIM/DISPATCH/FINALIZE with `FOR UPDATE SKIP LOCKED`, backoff/jitter,
  `MAX_OUTBOX_ATTEMPTS=5`, `CLAIM_WINDOW_MS`). **Mirror this structure for the per-delivery drain.**
- `packages/api/src/services/outbox/handlers.ts` — `OutboxEventType` (`'notification.dispatch'`;
  `'integration.webhook.publish'` reserved at :29) + `OutboxEventPayloadMap` + `outboxHandlerRegistry`.
  **Add the `'integration.webhook.publish'` literal + payload + fan-out handler.**
- `apps/api/src/routes/outbox.ts` — `/outbox/_drain` QStash route (`guardQStashRequest` +
  `withQueueObservability` + gauges). **Mirror for `/webhooks-outbound/_deliver`.**
- `packages/db/prisma/schema/outbox.prisma` — `OutboxEvent` + `OutboxStatus`; the delivery/subscription
  models mirror its shape (attempts/nextAttemptAt/lastError/status).

### QStash + queue (the delivery queue)
- `packages/api/src/services/queue.ts` — `JobRegistry` + `enqueueJob(name, payload, {dedupId, delaySeconds,
  notBefore})`; `JOB_CONFIG` route map. **Add `'webhook.deliver'` → `/webhooks-outbound/_deliver`.**
- `apps/api/src/lib/qstash-verify.ts` (`guardQStashRequest`) + `qstash-route.ts` (`defineQStashRoute`) —
  the signed-callback guard the new deliver route uses.
- `scripts/check-webhook-routes.mjs` — the webhook-route → signature-guard registry. **Register the new
  `/webhooks-outbound/_deliver` route + its `guardQStashRequest` guard here or the check fails.**

### Public-API surface (write flag-flip target — Phase 99 double-dark)
- `packages/api/src/middleware/api-key-auth.ts` — `apiKeyTenantProcedure` chain (apiKeyAuth →
  `publicApiFlagGate` → requireTier(ENTERPRISE) → demoReadOnly). The webhooks:manage public sub-router (if
  built) hangs here; P99 enriches `apiKeyActingUserId` / `sourceIp` / `userAgent`.
- `packages/api/src/middleware/require-public-api-flag.ts` — `assertPublicApiEnabled` (NOT_FOUND dark
  gate). Un-changed by 100; the FLIP is granting `module.public-api` per org in Unleash, not code.
- `apps/public-api/src/lib/build-openapi-doc.ts` — write routes are `hide:true`; **un-hide is the 100-09
  act** (write-verb count in the derived spec goes 0 → N).
- `packages/api/src/lib/scope-utils.ts` — `PUBLIC_API_SCOPES` (has `document:*`, `payment:*`, etc.) — **add
  `webhooks:manage`** (named by INTEG-AUTH-02 but absent from the taxonomy today).

### Security idioms (reuse — do NOT reinvent)
- `packages/einvoice/src/asp/storecove/adapter.ts:348-367` + `packages/api/src/services/courier/
  inpost-webhook-handler.ts` + `packages/integrations/src/adapters/{linear,jira}-adapter.ts` — the HMAC-
  SHA256 hex + `timingSafeEqual` verify idiom (INBOUND; the OUTBOUND signer is its mirror).
- `apps/api/src/lib/client-ip.ts` — trusted-proxy IP extraction (`x-forwarded-for` left-most) — the P99
  sourceIp basis the leak alarm reads; NO existing OUTBOUND SSRF guard exists (greenfield).
- `apps/cron-worker/src/jobs/handlers/job-health.ts:183-239` — `FAILURE_ALERT_THRESHOLD` + Sentry
  `captureMessage` for "N failures in 1h" — the admin-alert analog for INTEG-WEBHOOK-03.
- `packages/api/src/services/audit-writer.ts` — `writeAuditLog` (`ipAddress`/`userAgent`/`metadata`; lint-
  enforced by `scripts/lint-audit-log.mjs`). **`AuditEntityType` has NO `WEBHOOK_SUBSCRIPTION`; add it**
  for subscription-lifecycle audit rows.

### Flags
- `packages/feature-flags/src/flags-core.ts:248` — `module.outbound-webhooks` (default false, sign-off-
  gated). Dispatch gate. `:239` — `module.public-api` (the write-flip target).
- `packages/feature-flags/src/signoff-registry-flags.ts` — `module.outbound-` prefix already reserved.

### PII sources (redaction field inventory)
- `packages/validators/src/employee-country-fields.ts` + `legal/compliance-{ksa,uae}.ts` — PESEL /
  Steuer-IdNr / Emirates ID / Iqama field names to redact; `us-validators.ts` (SSN). Build the redaction
  key-set from these, not a hardcoded guess.

### web-vite Developer page (extend — mirror api-keys-tab)
- `apps/web-vite/src/components/settings/api-keys-tab.tsx` + `api-keys/` + `create/edit/revoke-api-key-
  dialog.tsx` — the CRUD pattern the Webhooks sub-tab mirrors (container+hooks, loading/empty/error,
  i18next en/de/pl/ar-RTL) per `apps/web-vite/ARCHITECTURE.md`.

### Documentation-follows-code (same change set — 100-10)
- NEW `.planning/brain/wiki/domains/outbound-webhooks.md` + `wiki/integrations/_index`; update
  `domains/public-api.md`, `patterns/{tenant-and-audit,rate-limit,feature-flags}.md`, `structure/
  {api-routers-catalog,key-services,prisma-schema-areas,cron-jobs}.md`, `log.md` + `hot.md`; `.planning/
  MEMORY.md`; `.planning/EXTERNAL-ENABLEMENT.md` (mark row #8 flipped + add an outbound-webhooks row);
  `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Transactional outbox** (`outbox/index.ts` + `handlers.ts`) — the `'integration.webhook.publish'` event
  type is already reserved; the fan-out handler slots in with zero new dispatcher.
- **QStash queue** (`queue.ts` `enqueueJob` + `JOB_CONFIG`) + `guardQStashRequest` — the per-delivery
  queue + signed callback.
- **HMAC idiom** (`storecove`/`inpost`/`linear` verifiers) — mirror for the outbound signer.
- **`module.outbound-webhooks` flag** — exists, default off; consume as the dispatch kill switch.
- **P99 `ApiKeyIpEvent` + `TIER_WEBHOOK_SUBSCRIPTION_CAP`** — consumed for the leak alarm + sub caps.
- **`job-health.ts` FAILURE_ALERT_THRESHOLD** — the admin-alert pattern for 5 failures/1h.
- **`writeAuditLog`** — subscription lifecycle + dispatch audit (needs a `WEBHOOK_SUBSCRIPTION`
  AuditEntityType).

### Established Patterns
- Transactional outbox: producer enqueues inside `$transaction`; drain fans out under `FOR UPDATE SKIP
  LOCKED`; handler idempotency-keyed by row id.
- Ship-dark behind a `module.*` flag; the SSRF guard is a hard control, not a deferral.
- Every external mutation audits; tenant from session/key, never client input.
- web-vite container+hooks; the hook is the only tRPC boundary; loading/empty/error mandatory.

### Integration Points
- `outbox/handlers.ts` gains `'integration.webhook.publish'`; a new deliver route + `JobRegistry` entry.
- New `packages/api/src/services/webhooks/` dir (ssrf-guard, signer, redact, dispatcher, subscription-svc).
- `WebhookSubscription` + `WebhookDeliveryAttempt` + `WebhookDeadLetter` (one migration) + RLS policies.
- `PUBLIC_API_SCOPES` gains `webhooks:manage`; `AuditEntityType` gains `WEBHOOK_SUBSCRIPTION`.
- Settings → Developer grows a Webhooks sub-tab.
- 100-09 flips `module.public-api` + un-hides the P99 write routes (`hide:true` removed).
</code_context>

<specifics>
## Specific Ideas
- **The SSRF guard is the load-bearing security control** — DNS-rebind defense (re-resolve + IP-pin at
  connect) is why subscribe-time validation alone is insufficient; both gates are mandatory.
- **Reuse the outbox for the trigger, not the delivery retry** — fan-out at drain time; per-endpoint retry
  is its own drain with the webhook backoff + DLQ.
- **Nothing dispatches until `module.outbound-webhooks`** — but HMAC/redaction/DLQ/SSRF are all testable now
  against a local mock receiver.
- **The write flag-flip is the deliberate END of the phase** — gated on the OWASP test suite, not a code
  side-effect.
</specifics>

<deferred>
## Deferred Ideas
- **Marketplace listings (Zapier/n8n/Make) + full DX portal + SDK 1.0 + Postman/Insomnia + status page +
  sandbox tier** → Phase 101.
- **HTTP (non-TLS) targets** → allowed only via a per-org admin override + warning (INTEG-SEC-02); default
  HTTPS-only.
- **`_initiatePayoutForRun`** → stays deferred (P99 A7; own scoped review).
- **Public `webhooks:manage` sub-router** → the scope is added + the internal staff router is primary; a
  thin public-API sub-router is optional this phase (external self-serve subscription mgmt), flagged in
  100-08 Open Questions.

None expand the phase scope — discussion stayed within INTEG-WEBHOOK-01..07 + INTEG-SEC-01..05 + the
inherited P99 write flag-flip.

---

*Phase: 100-theme-c-outbound-webhooks-integration-security*
*Context gathered: 2026-07-05*
