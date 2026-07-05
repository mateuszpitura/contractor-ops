# Phase 100 — Research: Outbound Webhooks + Integration Security

**Compiled:** 2026-07-05 · Grounded in the live tree (paths + line numbers verified).

This phase is **security-critical, medium-novelty**: the transactional-outbox seam
(`packages/api/src/services/outbox/`) and the HMAC/`timingSafeEqual` idiom already exist, but the
**outbound SSRF guard with DNS-rebind protection is greenfield** and the **customer-supplied target URL is
hostile input**. Two genuinely new controls carry the phase: the SSRF/DNS-rebind guard (A1) and the
replay-resistant HMAC signer (A2). Everything else is wiring onto proven seams + the inherited P99 write
flag-flip (A8).

---

## A. Assumptions & Seams (decisions the executor must not re-litigate)

### A1 — SSRF guard is the control; DNS-rebind needs re-resolve + IP-pin at connect (THE decision)
No outbound SSRF guard exists (`semble "SSRF"` returns only `apps/api/src/lib/client-ip.ts` — inbound
trusted-proxy IP extraction — and infra WAF rules; nothing outbound). Greenfield. Build
`packages/api/src/services/webhooks/ssrf-guard.ts`:

- **`assertWebhookUrlSafe(url): void`** — parse URL; reject non-`https:` (unless the org HTTP override is
  set — INTEG-SEC-02); resolve the host (`dns.lookup` all addresses) and classify EVERY resolved IP;
  reject if ANY is private (RFC 1918 `10/8` `172.16/12` `192.168/16`), loopback (`127/8`, `::1`), link-
  local (`169.254/16`, `fe80::/10`), ULA (`fc00::/7`), unspecified (`0.0.0.0`, `::`), or the cloud-metadata
  `169.254.169.254`. Reject literal-IP hosts in those ranges too (skip DNS).
- **`webhookHttpAgent`** — a `request-filtering-agent`-wrapped http/https Agent that re-applies the same
  block list at socket-connect time (the library's whole purpose), so a name that passed `assertWebhookUrlSafe`
  but **re-resolves** to a private IP at delivery time (DNS rebinding / TOCTOU) is blocked when the socket
  actually connects. **`maxRedirects: 0`** — a `302 → http://169.254.169.254/` must NOT be followed.
- Both gates run: `assertWebhookUrlSafe` at subscribe/update time (fail before persist) AND both
  `assertWebhookUrlSafe` + the filtering agent at dispatch time.

`request-filtering-agent` is NOT yet a dependency (`grep` of lockfile = absent) → new dep in
`packages/api` under the **7-day release-age** rule (`.npmrc min-release-age=7`); pin a version ≥7 days old,
`pnpm audit` + typosquat-check after add. If blocked, the hand-rolled `assertWebhookUrlSafe` + a custom
`lookup` hook on the Agent that re-validates the resolved IP is the fallback (documented in 100-02).

### A2 — HMAC signer is Stripe-convention + replay window (the second new control)
Mirror the inbound verify idiom (`storecove/adapter.ts:354` `createHmac('sha256', secret).update(rawBody)
.digest('hex')` + `timingSafeEqual`) into an OUTBOUND signer `webhooks/signer.ts`:

- Header: **`X-CO-Signature: t={unix_ms},v1={hex}`** where `signedPayload = "{t}.{rawBody}"`,
  `v1 = HMAC_SHA256(secret, signedPayload)` hex. (Stripe `t=…,v1=…` convention — RFC-free, widely
  understood, verifier-friendly.) Also emit `X-CO-Event: {eventType}`, `X-CO-Delivery: {attemptId}`,
  `X-CO-Webhook-Id: {subscriptionId}`.
- **Replay window 5 min**: verifiers compute `Math.abs(Date.now() - t)` and reject `> 300_000` ms BEFORE
  the constant-time compare (documented in the sample verifiers). The receiver is responsible for replay
  rejection; we sign the timestamp so it can.
- **Per-subscription secret** `whsec_` + 32 random bytes hex. It must be **recoverable** (we re-sign every
  delivery) so it is stored **encrypted at rest** — reuse the `IntegrationConnection.configJson` secret
  encryption path (NOT the one-way HMAC used for API keys). Reveal-once at create; `rotateSecret` mints a
  new one (old invalid immediately — webhooks have no grace need like API keys).

### A3 — reuse the outbox for FAN-OUT; a dedicated drain for per-delivery retry
`outbox/handlers.ts:28-29` already declares `OutboxEventType = 'notification.dispatch'` with
`// Future: 'integration.webhook.publish' | …`. Add that literal + payload + a fan-out handler:

- **Producer**: business writes call `enqueueOutboxEvent({ tx, eventType: 'integration.webhook.publish',
  payload: { eventType: 'invoice.paid', aggregateId, data } })` inside their existing `$transaction`
  (wrap in a thin `enqueueWebhookEvent(tx, org, event)` helper so producers do not hand-assemble the
  envelope).
- **Fan-out handler** (runs in the existing `/outbox/_drain`): load enabled `WebhookSubscription`s for the
  org whose `eventFilter` matches; for each, redact (A5) + snapshot the payload and INSERT a
  `WebhookDeliveryAttempt` (status PENDING, attempt 0), then `enqueueJob('webhook.deliver', { attemptId })`.
  Handler returns → the OutboxEvent is DISPATCHED. **No network I/O in the fan-out** (keeps the shared
  outbox drain fast; a slow endpoint must not stall notification.dispatch).
- **Per-delivery drain** `/webhooks-outbound/_deliver` (QStash callback, `guardQStashRequest`): claim the
  attempt (CAS `PENDING|FAILED → SENDING`, mirror `webhooks/process.ts:201` `updateMany` idiom), SSRF-check
  + sign + POST via `webhookHttpAgent` (10s timeout), then FINALIZE: 2xx → DELIVERED + bump
  `WebhookSubscription.lastSuccessAt`; else schedule the next attempt with the **webhook backoff**
  (1m/5m/30m/2h/12h/24h, max 6) or, on exhaustion, move to `webhook_failures` DLQ + bump `lastFailureAt`.
  QStash's own retry re-invokes the route if it 500s, and `delaySeconds` schedules the next attempt — but
  the authoritative backoff lives in the DB row (mirror `outbox/index.ts:computeBackoffMs`, new schedule).

**Why not one OutboxEvent per (event × subscription):** it forces the outbox's fixed 5-attempt/4m/1h
backoff onto per-endpoint retry and couples fan-out to the producer's transaction (N sub lookups inside the
business write). Fan-out at drain time is cheaper and gives webhooks their own retry/DLQ contract.

### A4 — outbound models are NAME-DISTINCT from inbound `WebhookDelivery`
`integration.prisma` `WebhookDelivery` is INBOUND (provider → us; `deliveryStatus RECEIVED|PROCESSING|
PROCESSED|FAILED`, dedup `@@unique([provider, providerEventId])`, reaper in `job-health.ts:183`). The
outbound migration adds THREE new models (`webhook.prisma`, new schema file):

| Model | Purpose | Key fields |
|-------|---------|-----------|
| `WebhookSubscription` | the endpoint | `organizationId`, `url`, `eventFilter String[]`, `secretEncrypted`, `includePii Boolean @default(false)`, `httpAllowed Boolean @default(false)`, `enabled`, `lastSuccessAt?`, `lastFailureAt?`, `maxRetries Int @default(6)`, audit ts |
| `WebhookDeliveryAttempt` | one send attempt | `subscriptionId`, `outboxEventId?`, `eventType`, `payloadJson` (redaction-applied snapshot), `status`, `attempts`, `nextAttemptAt`, `responseStatus?`, `lastError?`, `deliveredAt?` |
| `WebhookDeadLetter` (`@@map("webhook_failures")`) | DLQ | `subscriptionId`, `attemptId`, `eventType`, `payloadJson`, `lastError`, `attempts`, `failedAt`, `replayedAt?` |

All three: `organizationId` required (RLS auto-scope, mirror `OutboxEvent`), `@@index([status,
nextAttemptAt])` on the attempt (drain predicate). RLS policies mirror `WebhookDelivery`'s
(`migration.sql:4722`). `WebhookDeliveryStatus` enum reuse risk — the inbound enum is
`RECEIVED|PROCESSING|PROCESSED|FAILED`; the outbound needs `PENDING|SENDING|DELIVERED|FAILED|DEAD` → a
**separate** `OutboundWebhookStatus` enum (do NOT reuse the inbound one).

### A5 — PII redaction is a key-set strip on the payload snapshot (INTEG-WEBHOOK-07)
`webhooks/redact.ts` `redactPii(payload, { includePii }): payload`. When `includePii === false` (default),
deep-strip keys matching the PII inventory (build from `packages/validators/src/employee-country-fields.ts`
+ `legal/compliance-{ksa,uae}.ts` + `us-validators.ts`, NOT a hardcoded guess): PESEL, SSN, NI number,
Steuer-IdNr / taxId, Emirates ID, Iqama, `email`, `phone`, IBAN/bank account. Redaction runs in the FAN-OUT
handler (before the snapshot is persisted to `WebhookDeliveryAttempt.payloadJson`) so a redacted event is
never stored in a deliverable row → no leak even if the DLQ is inspected. `includePii: true` is a
per-subscription opt-in (RODO-defensible default-off).

### A6 — dispatch rate limit + leak alarm reuse existing counter/alert idioms
- **INTEG-SEC-03** (100 events/min per subscription): an Upstash fixed-window counter keyed
  `whrl:{subscriptionId}:{YYYYMMDDHHmm}` in the deliver drain BEFORE the POST; over-limit → requeue with a
  short `delaySeconds` (do NOT drop; anti-fanout throttle, not a hard reject). Mirror the P99
  `enforceApiTierQuota` counter idiom. Fail-OPEN on limiter outage (log) so a Redis blip does not silently
  drop events.
- **INTEG-SEC-05** (>3 source IPs / 24h leak alarm): a cron-worker job reads the P99 `ApiKeyIpEvent` log,
  groups distinct `sourceIp` per `apiKeyId` over 24h, and on `> 3` fires the admin alert (Sentry
  `captureMessage` + org-admin notification) — mirror `job-health.ts:196` `FAILURE_ALERT_THRESHOLD`. The
  `ApiKeyIpEvent` model lands in Phase 99 (A8); this phase CONSUMES it.

### A7 — admin alert at 5 failures/1h mirrors the job-health reaper
INTEG-WEBHOOK-03's "admin alert at 5 failures/1h" mirrors `job-health.ts:183-239`: count
`WebhookDeliveryAttempt` rows FAILED/DEAD in the last hour (per org or global); over the threshold →
Sentry `captureMessage` + notification. Reuse the same pattern (a cron-worker gauge/alert), not a new
alerting stack.

### A8 — the P99 write flag-flip is INHERITED and GATED (do NOT flip early)
Phase 99 built the public WRITE surface double-dark (`99-CONTEXT.md` D-03): per-org `module.public-api` off
(`assertPublicApiEnabled` → NOT_FOUND) + `hide:true` on the write Hono routes (absent from
`buildOpenApiDocument`). Phase 99 also lands `ApiKeyIpEvent`, `apiKeyActingUserId`, and
`TIER_WEBHOOK_SUBSCRIPTION_CAP` in `api-tier-limits.ts`. **Phase 100 does NOT flip anything until
INTEG-SEC-04 (OWASP tests) is GREEN.** 100-09 (human-checkpoint) then: (1) removes `hide:true` from the
write routes (write-verb count in the derived spec 0 → N), (2) the per-org `module.public-api` grant is an
Unleash/ops act recorded in EXTERNAL-ENABLEMENT row #8, (3) the SDK regenerates to include writes. The
`webhooks:manage` scope is absent from `PUBLIC_API_SCOPES` today (`scope-utils.ts:41`) — add it.

---

## B. Locked event catalog + delivery contract

### Event catalog (INTEG-WEBHOOK-02) — Zod discriminated union on `type`
```
contractor.created | contractor.updated | contractor.offboarded | contractor.compliance_blocked
invoice.received | invoice.matched | invoice.approved | invoice.rejected | invoice.paid
payment_run.created | payment_run.completed
workflow.task.completed | workflow.completed
classification.outcome
compliance_doc.expiring_soon | compliance_doc.expired
```
Envelope: `{ id, type, created_at, organization_id, data: <per-type payload>, include_pii }`. The union is
authored in `packages/validators/src/webhooks/index.ts` (`.strict()` per variant); `WebhookEventType` is a
`z.enum`. Producers reference the catalog — a new event type is a compile error until added.

### Signature + headers (INTEG-WEBHOOK-04/-05)
```
POST {subscription.url}
Content-Type: application/json
X-CO-Event: invoice.paid
X-CO-Webhook-Id: whsub_...
X-CO-Delivery: whatt_...
X-CO-Signature: t=1751731200000,v1=<64-hex sha256>
User-Agent: ContractorOps-Webhooks/1.0
```
`v1 = HMAC_SHA256(secret, "1751731200000.{rawBody}")`. Verifier: reject `|now - t| > 300000`ms →
recompute → `timingSafeEqual`.

### Retry/DLQ (INTEG-WEBHOOK-03, INTEG-SEC-03)
Backoff `[1m, 5m, 30m, 2h, 12h, 24h]`, max 6 attempts. Non-2xx or timeout → schedule next; after attempt 6
→ `webhook_failures` DLQ (`status DEAD`) + `lastFailureAt`. Per-sub dispatch cap 100/min. Admin alert at
5 failures/1h.

---

## C. Patterns

### Pattern 1 — outbox fan-out handler (add to `outbox/handlers.ts`)
```
// OutboxEventType gains 'integration.webhook.publish'
'integration.webhook.publish': WebhookPublishPayload   // { eventType, aggregateId?, data }

const handleWebhookPublish: OutboxHandler<'integration.webhook.publish'> = async (payload, ctx) => {
  const subs = await prisma.webhookSubscription.findMany({
    where: { organizationId: ctx.organizationId, enabled: true, eventFilter: { has: payload.eventType } },
  });
  for (const sub of subs) {
    const body = redactPii(payload.data, { includePii: sub.includePii });
    const attempt = await prisma.webhookDeliveryAttempt.create({ data: {
      subscriptionId: sub.id, organizationId: ctx.organizationId, outboxEventId: ctx.outboxEventId,
      eventType: payload.eventType, payloadJson: body, status: 'PENDING', attempts: 0, nextAttemptAt: new Date() }});
    await enqueueJob('webhook.deliver', { attemptId: attempt.id }, { dedupId: attempt.id });
  }
};
```

### Pattern 2 — deliver drain (`/webhooks-outbound/_deliver`, mirror `outbox.ts` + `webhooks/process.ts` CAS)
```
const claim = await prisma.webhookDeliveryAttempt.updateMany({
  where: { id: attemptId, status: { in: ['PENDING','FAILED'] } }, data: { status: 'SENDING' } });
if (claim.count === 0) return 200; // already claimed/dead
const attempt = await prisma.webhookDeliveryAttempt.findUniqueOrThrow(...);
if (!moduleOutboundWebhooksEnabled(org, region)) return finalizeSkipped(attempt); // kill switch
if (await overDispatchRateLimit(sub.id)) return requeue(attempt, 5); // INTEG-SEC-03
assertWebhookUrlSafe(sub.url, { httpAllowed: sub.httpAllowed });     // INTEG-SEC-01/-02 (dispatch-time)
const t = Date.now(); const raw = JSON.stringify(envelope);
const sig = `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex')}`;
const res = await fetch(sub.url, { method:'POST', body: raw, agent: webhookHttpAgent, redirect:'error',
  headers: { 'X-CO-Signature': sig, /* ...event/id headers */ }, signal: AbortSignal.timeout(10_000) });
res.ok ? finalizeDelivered(attempt) : scheduleOrDeadLetter(attempt, res.status);  // backoff / DLQ
```

### Pattern 3 — SSRF guard (`webhooks/ssrf-guard.ts`)
```
export function assertWebhookUrlSafe(raw: string, opts: { httpAllowed: boolean }): void {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && !(opts.httpAllowed && u.protocol === 'http:')) throw new WebhookUrlError('https-required');
  if (isBlockedHostLiteral(u.hostname)) throw new WebhookUrlError('blocked-range');
  const addrs = dnsLookupAll(u.hostname);                    // resolve now (subscribe-time)
  if (addrs.some(isBlockedIp)) throw new WebhookUrlError('resolves-private');
}
export const webhookHttpAgent = useAgent(...) // request-filtering-agent: re-validates at connect (DNS-rebind), maxRedirects:0
```

### Pattern 4 — subscription lifecycle (staff router `webhookSubscriptionRouter`, session-authed, mirror `apiKeyRouter`)
`create` (SSRF-check url, gen `whsec_`, reveal once, audit `WEBHOOK_SUBSCRIPTION` create), `list`, `update`
(re-SSRF-check on url change), `rotateSecret`, `delete`, `testFire` (enqueue a synthetic
`webhook.deliver` to a local mock in dev / the real url with a `webhook.test` event), `listDeliveries`
(last-100). Every mutation `writeAuditLog`.

---

## D. Pitfalls (security-critical — each has a threat-model entry)

1. **DNS rebinding (TOCTOU)** — subscribe-time validation alone is bypassable: a host resolves public at
   subscribe, private at delivery. MUST re-resolve + IP-pin at connect (`request-filtering-agent` /
   custom `lookup`), redirects disabled. Test: a host that flips public→private is blocked at dispatch.
2. **Redirect to metadata** — `302 → http://169.254.169.254/latest/meta-data/` must NOT be followed;
   `redirect: 'error'` / `maxRedirects: 0`. Test asserts a redirecting mock is rejected.
3. **Reusing the inbound `WebhookDelivery`/`WebhookDeliveryStatus`** — separate outbound models + enum;
   RLS + reaper are inbound-shaped. Test: outbound rows never appear in the inbound reaper query.
4. **Replay** — signing the body without the timestamp lets a captured POST be replayed forever. Bind `t`
   into the signed string + document the 5-min window in every verifier. Test: a `t` older than 5 min
   fails the sample verifier.
5. **Secret hashed one-way** — API keys are HMAC-hashed (irreversible), but a webhook secret must be
   recoverable to re-sign. Encrypt at rest; NEVER store it in `payloadJson` or an audit row.
6. **PII in the persisted attempt/DLQ row** — redact BEFORE persisting the snapshot, not just before the
   POST, or a DLQ inspection leaks PESEL/SSN. Test: a redacted subscription's `WebhookDeliveryAttempt.
   payloadJson` contains no PII keys.
7. **Poison message stalls the drain** — a handler that throws on a malformed row must not block the batch;
   per-row try/catch + `FOR UPDATE SKIP LOCKED` + terminal DLQ after max attempts (mirror
   `outbox/index.ts:dispatchAndFinalize`).
8. **Dispatch before the flag** — event dispatch must short-circuit when `module.outbound-webhooks` is off
   (kill switch); only fan-out/persist is flag-free. Test: flag off ⇒ no outbound POST.
9. **Forgetting to register the deliver route in `check-webhook-routes.mjs`** — the route→guard registry
   check fails CI if `/webhooks-outbound/_deliver` (+ `guardQStashRequest`) is not listed.
10. **Un-hiding writes before the OWASP gate** — the write flag-flip (100-09) must be gated on
    INTEG-SEC-04 GREEN; never a side-effect of another plan. Test: write-verb count in the spec stays 0
    until 100-09.

---

## E. Validation Architecture (feeds 100-01 RED net + 100-VALIDATION)

| Requirement | Behavior (secure) | Test | Command |
|---|---|---|---|
| INTEG-SEC-01 | subscribe+dispatch reject private/loopback/link-local/`169.254.169.254`; DNS-rebind (public→private re-resolve) blocked at connect; redirects not followed | security | `pnpm --filter @contractor-ops/api test webhook-ssrf` |
| INTEG-SEC-02 | non-HTTPS url rejected unless per-org HTTP override; override still SSRF-checked | security | `pnpm --filter @contractor-ops/api test webhook-ssrf` |
| INTEG-WEBHOOK-04/-05 | `X-CO-Signature: t=…,v1=…` verifies; a >5-min-old `t` is rejected by the sample verifier; wrong secret fails | security | `pnpm --filter @contractor-ops/api test webhook-hmac` |
| INTEG-WEBHOOK-07 | redacted subscription's persisted attempt payload contains no PII keys; `include_pii:true` retains them | contract | `pnpm --filter @contractor-ops/api test webhook-redact` |
| INTEG-WEBHOOK-03 | non-2xx retries on the 1m/5m/30m/2h/12h/24h schedule, max 6, then DLQ; DLQ row replayable; 5 failures/1h alerts | integration | `pnpm --filter @contractor-ops/api test webhook-dispatch` |
| INTEG-SEC-03 | 101st delivery in a minute for one sub is throttled (requeued), not dropped | security | `pnpm --filter @contractor-ops/api test webhook-rate-limit` |
| INTEG-SEC-05 | a key seen from >3 IPs in 24h raises the leak alarm; ≤3 does not | integration | `pnpm --filter @contractor-ops/cron-worker test api-key-leak-alarm` |
| INTEG-WEBHOOK-01/-02/-06 | subscription CRUD + event-filter + test-fire + last-100; SSRF-checked on create/update; every mutation audits | integration | `pnpm --filter @contractor-ops/api test webhook-subscription` |
| INTEG-SEC-04 | OWASP API Top-10 checks (BOLA/BFLA/SSRF/mass-assignment/misconfig/injection) run GREEN as tests | security | `pnpm --filter @contractor-ops/api test owasp-api-gate` |
| write flip (P99) | write-verb count in `buildOpenApiDocument` is 0 UNTIL 100-09; then N and 404→reachable per org | integration | `pnpm --filter @contractor-ops/public-api test write-routes-dark` |

**Kill-switch / flag-deferred:** live dispatch needs `module.outbound-webhooks` (default off) — all delivery
tests run against a **local mock receiver** with the guard in force; the flag gates only real dispatch (A8).
NEVER run the full unscoped web-vite suite (RAM). Scope every command with `--filter` + a path.

---

## F. Open Questions (executor MUST surface, not silently decide)

1. **Public `webhooks:manage` sub-router** — is external self-serve subscription management wanted this
   phase, or is the internal Settings UI (staff-authed) the only surface? Lean: add the `webhooks:manage`
   scope + build the internal staff router; defer the public sub-router unless product asks. Confirm.
2. **`request-filtering-agent` vs hand-rolled** — the library is the recommended control but is a new dep
   under the 7-day age rule; if it cannot be pinned ≥7 days old, use the custom `lookup`-hook fallback.
   Confirm the dep is acceptable (supply-chain review) before adding.
3. **Secret-at-rest mechanism** — reuse the `IntegrationConnection.configJson` encryption or a dedicated
   KMS envelope? Must be recoverable for re-signing. Confirm which encryption util is canonical.
4. **DLQ retention + replay authorization** — how long do `webhook_failures` rows live, and who can replay
   (org admin only)? Lean: 30-day retention + org-admin-only replay, audited. Confirm.
5. **HTTP override scope** — INTEG-SEC-02 allows HTTP via per-org admin override; is that a flag, an org
   setting, or per-subscription `httpAllowed`? Lean: per-subscription `httpAllowed` boolean gated by an
   org-admin action + warning banner. Confirm.
6. **The write flag-flip trigger** — is granting `module.public-api` per org a manual Unleash act (recorded
   in EXTERNAL-ENABLEMENT) or does 100-09 script it? Lean: un-hide routes + SDK in code (100-09); the
   per-org Unleash grant stays a manual ops act (matches the ship-dark posture). Confirm.

---

*Phase: 100-theme-c-outbound-webhooks-integration-security · Research compiled 2026-07-05*
