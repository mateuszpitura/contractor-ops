# 100-06 SUMMARY — outbound dispatcher (fan-out + deliver drain)

**Wave:** 3 · **Status:** complete · `webhook-dispatch` + `webhook-rate-limit` GREEN; SSRF/HMAC/redact/catalog
still GREEN. `check:webhook-routes` OK (29 routes). Typecheck clean: api, db, validators, api-server.

## What shipped

- **Outbox fan-out** — `services/webhooks/fan-out.ts` `handleWebhookPublish` (registered in
  `outbox/handlers.ts` for the new `integration.webhook.publish` type): resolves enabled subs matching
  `eventFilter`, `redactPii` per-sub, persists one `WebhookDeliveryAttempt`, enqueues `webhook.deliver`.
  Per-sub try/catch = poison isolation; NO network I/O in the shared drain. `services/webhooks/enqueue.ts`
  `enqueueWebhookEvent` is the typed producer wrapper.
- **Deliver drain** — `services/webhooks/dispatcher.ts` `deliverAttempt`: CAS-claim (PENDING|FAILED→SENDING)
  → kill switch (`module.outbound-webhooks`, off ⇒ no POST) → per-sub 100/min rate limit (requeue, not drop)
  → `assertWebhookUrlSafe` (dispatch-time DNS-rebind) → sign → POST via the DNS-rebind-guarded agent
  (`https.request`, no redirects, 10s) → finalize 2xx=DELIVERED / else backoff `[1m,5m,30m,2h,12h,24h]`
  (`nextWebhookAttempt`, max 6) → `webhook_failures` DLQ (DEAD) + `lastFailureAt`. Admin alert at ≥5
  FAILED/DEAD in 1h (Sentry `captureMessage`, mirroring job-health).
- **Rate limit** — `services/webhooks/rate-limit.ts` `overDispatchRateLimit` (Upstash fixed-window
  `whrl:{sub}:{minute}`, cap 100, fail-OPEN, in-memory fallback).
- **Secret store** — `services/webhooks/secret-store.ts` (AES-256-GCM `iv:authTag:ciphertext`,
  `WEBHOOK_SECRET_ENCRYPTION_KEY`, recoverable). Authored here because the dispatcher needs decrypt at
  dispatch; 100-08 consumes `encryptWebhookSecret` on create. Env var added to the schema (optional, so local
  boot is unaffected) + `.env.example`.
- **Queue + route** — `webhook.deliver` job (`/webhooks-outbound/_deliver`, retries 2 — the DB row owns the
  authoritative backoff). Route `apps/api/src/routes/webhooks-outbound.ts` (`guardQStashRequest` +
  `withQueueObservability`), registered in the webhook plugin, and added to `check-webhook-routes.mjs`.

## Notes

- No new dependency. All secrets/keys via `getServerEnv()` (zero raw `process.env`).
- Delivery + fan-out tests use mocked prisma/queue + real redact — NO real external URL.
- `webhook-subscription` router-surface test stays RED → 100-08.

## Verify

`pnpm --filter @contractor-ops/api test webhook-dispatch webhook-rate-limit` → 6/6 GREEN.
`node scripts/check-webhook-routes.mjs` → OK. `pnpm typecheck` api/db/validators/api-server → clean.
