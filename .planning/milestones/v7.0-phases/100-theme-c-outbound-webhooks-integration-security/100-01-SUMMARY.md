# 100-01 SUMMARY — RED validation net

**Wave:** 0 · **Status:** complete · **Result:** 8 RED suites authored, all failing pre-implementation.

## What shipped

Eight NEW test files, each RED against the not-yet-built surface and naming the plan that greens it:

| File | Requirement | Greened by |
|------|-------------|-----------|
| `packages/api/src/__tests__/security/webhook-ssrf.security.test.ts` | INTEG-SEC-01/-02 | 100-02 |
| `packages/api/src/__tests__/security/webhook-hmac.security.test.ts` | INTEG-WEBHOOK-04/-05 | 100-03 |
| `packages/api/src/__tests__/security/webhook-redact.security.test.ts` | INTEG-WEBHOOK-07 | 100-04 |
| `packages/api/src/__tests__/webhook-subscription.test.ts` | INTEG-WEBHOOK-01/-02 | 100-05 (catalog) / 100-08 (router) |
| `packages/api/src/__tests__/webhook-dispatch.test.ts` | INTEG-WEBHOOK-03 | 100-06 |
| `packages/api/src/__tests__/security/webhook-rate-limit.security.test.ts` | INTEG-SEC-03 | 100-06 |
| `packages/api/src/__tests__/security/owasp-api-gate.security.test.ts` | INTEG-SEC-04 | 100-09 |
| `apps/cron-worker/src/__tests__/api-key-leak-alarm.test.ts` | INTEG-SEC-05 | 100-07 |

## RED technique

Each suite uses a **dynamic `import()` inside the test body** (or asserts against a not-yet-exported
symbol) so the file LOADS but every test fails at runtime with `Cannot find module …` / `expected undefined
to be defined` / `expected […] to include 'webhooks:manage'`. No `describe.skip` masking. This auto-greens
when the implementing plan lands the module with the contracted API. Confirmed RED: 34 api-package tests +
2 cron tests all failing for the correct (missing-surface) reason.

## Design contracts fixed here (implementers must match)

- **SSRF guard** (`services/webhooks/ssrf-guard.ts`): `assertWebhookUrlSafe(url, { httpAllowed }): Promise<void>`
  (async — literal IPs short-circuit without DNS; hostnames resolve via mocked `node:dns/promises`),
  `webhookAgentLookup(hostname, options, cb)` (connect-time DNS-rebind guard), typed error with a `reason`.
- **Signer** (`services/webhooks/signer.ts`): `signWebhookPayload(secret, rawBody, tMs) → { header, t, v1 }`,
  `verifyWebhookSignature(secret, rawBody, header, { nowMs, toleranceMs=300_000 }) → boolean`,
  `generateWebhookSecret() → whsec_+64hex`.
- **Redactor** (`services/webhooks/redact.ts`): `redactPii(payload, { includePii }) → clone`, `WEBHOOK_PII_KEYS: Set<string>`.
- **Dispatcher** (`services/webhooks/dispatcher.ts`): `WEBHOOK_BACKOFF_SCHEDULE_MS = [60_000,300_000,1_800_000,7_200_000,43_200_000,86_400_000]`,
  `WEBHOOK_MAX_ATTEMPTS = 6`, `nextWebhookAttempt(completedAttempts, maxRetries?) → { action:'retry', delayMs } | { action:'dead-letter' }`.
- **Rate limit** (`services/webhooks/rate-limit.ts`): `WEBHOOK_DISPATCH_RATE_LIMIT_PER_MIN = 100`,
  `overDispatchRateLimit(id, { incr? }) → Promise<boolean>` (fail-OPEN on backend error; injectable `incr` for tests).
- **Outbox fan-out**: `outboxHandlerRegistry['integration.webhook.publish']` — per-sub try/catch (poison isolation),
  `enqueueJob('webhook.deliver', { attemptId }, { dedupId: attemptId })`.
- **Catalog** (`@contractor-ops/validators`): `WEBHOOK_EVENT_TYPES` (16 events), `webhookEventEnvelopeSchema` (strict).
- **Leak alarm** (`apps/cron-worker/.../api-key-leak-alarm.ts`): `apiKeyLeakAlarmHandler(ctx)` — reads
  `prisma.apiKeyIpEvent.findMany` over 24h, distinct-IP count > 3 → `Sentry.captureMessage` carrying the key PREFIX.

## Local-mock-receiver harness

Delivery/SSRF suites contact NO real external URL — DNS is mocked via `vi.mock('node:dns/promises')` and the
fan-out/dispatch suites mock `@contractor-ops/db` + `../services/queue`. Downstream delivery plans (100-06)
reuse the MSW QStash handler (`@contractor-ops/test-utils/msw/handlers/qstash`) for the deliver-route callback.

## Verify

`pnpm --filter @contractor-ops/api test webhook-ssrf webhook-hmac webhook-redact webhook-subscription
webhook-dispatch webhook-rate-limit owasp-api-gate` → all RED (expected). `pnpm --filter
@contractor-ops/cron-worker test api-key-leak-alarm` → RED. `100-VALIDATION.md` `nyquist_compliant: true`.
