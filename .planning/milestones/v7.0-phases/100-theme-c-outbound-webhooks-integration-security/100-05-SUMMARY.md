# 100-05 SUMMARY — outbound persistence + event catalog + audit type

**Wave:** 2 · **Status:** complete · catalog+audit portions GREEN; router portion RED for 100-08. Typecheck
clean across db / validators / api.

## What shipped

- `packages/db/prisma/schema/webhook.prisma` — three NAME-DISTINCT outbound models + enum:
  - `WebhookSubscription` (org, url, `eventFilter String[]`, `secretEncrypted`, `includePii @default(false)`,
    `httpAllowed @default(false)`, `enabled @default(true)`, `maxRetries @default(6)`, last success/failure).
  - `WebhookDeliveryAttempt` (subscriptionId, outboxEventId?, eventType, `payloadJson` snapshot, status,
    attempts, nextAttemptAt, responseStatus?, lastError?, deliveredAt?) — `@@index([status, nextAttemptAt])`.
  - `WebhookDeadLetter` `@@map("webhook_failures")` (attemptId?, lastError, attempts, failedAt, replayedAt?).
  - `enum OutboundWebhookStatus { PENDING SENDING DELIVERED FAILED DEAD }` — the inbound
    `WebhookDeliveryStatus` is NOT reused. Organization gains the three back-relations.
- **Migration** `packages/db/prisma/schema/migrations/20260705120000_phase100_outbound_webhooks/migration.sql`
  — CREATE TYPE + 3 tables + indexes + FKs + RLS policies (member-read / ops-write, mirroring `OutboxEvent`
  and the inbound `WebhookDelivery`). **NOT applied** — deploy-time step (recorded in EXTERNAL-ENABLEMENT in
  100-10). Prisma client regenerated (`packages/db/src/generated/**`) so code compiles.
- `packages/validators/src/webhooks/index.ts` — `WEBHOOK_EVENT_TYPES` (16), `webhookEventTypeSchema`,
  `webhookEventEnvelopeSchema` (discriminated union on `type`, each variant `.strict()`); barrel-exported.
- `packages/api/src/services/audit-writer.ts` — `AuditEntityType` gains `WEBHOOK_SUBSCRIPTION`.

## Verify

`pnpm --filter @contractor-ops/api test webhook-subscription` → catalog 2/2 GREEN (router 1 RED → 100-08).
`pnpm --filter @contractor-ops/db --filter @contractor-ops/validators --filter @contractor-ops/api typecheck`
→ clean. Migration present, not applied.
