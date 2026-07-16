---
title: Outbound webhooks
type: domain
tags: [webhooks, outbound, ssrf, hmac, dlq, redaction, integration-security]
source_commit: 222d0daab
verify_with:
  - apps/api/src/plugins/csrf-origin.ts
  - packages/api/src/services/webhooks/ssrf-guard.ts
  - packages/api/src/services/webhooks/signer.ts
  - packages/api/src/services/webhooks/redact.ts
  - packages/api/src/services/webhooks/dispatcher.ts
  - packages/api/src/services/webhooks/fan-out.ts
  - packages/api/src/services/webhooks/enqueue.ts
  - packages/api/src/services/webhooks/rate-limit.ts
  - packages/api/src/services/webhooks/secret-store.ts
  - packages/api/src/routers/core/webhook-subscription.ts
  - packages/db/prisma/schema/webhook.prisma
  - packages/validators/src/webhooks/index.ts
  - apps/api/src/routes/webhooks-outbound.ts
  - packages/api/src/routers/core/contractor-core.ts
  - packages/api/src/services/approval-engine.ts
  - packages/api/src/routers/core/approval-shared.ts
  - packages/api/src/routers/core/approval-queue.ts
  - packages/api/src/routers/finance/invoice-crud.ts
  - packages/api/src/routers/finance/invoice-matching.ts
  - packages/api/src/routers/finance/payment-shared.ts
  - packages/api/src/routers/finance/payment-core.ts
  - packages/api/src/routers/portal/portal-invoices-router.ts
  - packages/api/src/routers/workflow/workflow-shared.ts
  - packages/api/src/routers/workflow/workflow-execution-tasks.ts
  - packages/api/src/routers/workflow/workflow-execution-runs.ts
  - packages/api/src/routers/public-api/workflow-task.ts
  - packages/api/src/routers/compliance/classification-submit.ts
  - packages/api/src/services/compliance-reminder-scan.ts
updated: 2026-07-17
---

# Outbound webhooks

## Purpose

Push **signed, PII-safe events** to customer-supplied URLs when things happen in an org's account, without
handing an attacker an SSRF primitive. Distinct from the INBOUND `WebhookDelivery` surface (provider → us);
these are OUTBOUND (us → subscriber). Live dispatch is gated behind the default-off `module.outbound-webhooks`
flag (kill switch); the SSRF guard is a hard control, not a deferral.

## Flow

1. **Producer** — a business write calls `enqueueWebhookEvent(tx, orgId, { eventType, aggregateId?, data })`
   (`webhooks/enqueue.ts`) inside its `$transaction`, enqueuing an `integration.webhook.publish` OutboxEvent —
   durable iff the write commits.
2. **Fan-out** — the shared `/outbox/_drain` runs `handleWebhookPublish` (`webhooks/fan-out.ts`): resolve
   enabled `WebhookSubscription`s whose `eventFilter` matches, `redactPii` per-sub, persist ONE
   `WebhookDeliveryAttempt` snapshot each, `enqueueJob('webhook.deliver', { attemptId })`. **No network I/O**
   in the shared drain; a per-sub try/catch isolates a poison row.
3. **Deliver** — `/webhooks-outbound/_deliver` (QStash, `guardQStashRequest`) runs `deliverAttempt`
   (`webhooks/dispatcher.ts`): CAS-claim → `module.outbound-webhooks` kill switch (disabled → reset
   `PENDING` + re-enqueue with 60s delay so attempts are not orphaned) → per-sub 100/min rate limit
   (requeue, not drop; Redis outage falls back to conservative in-process counter) → `assertWebhookUrlSafe`
   (dispatch-time DNS-rebind) → sign → POST via the DNS-rebind-guarded agent (`https.request`, no redirects, 10s) → finalize: 2xx = DELIVERED + `lastSuccessAt`;
   else backoff `[1m,5m,30m,2h,12h,24h]` (max 6) then `webhook_failures` DLQ (DEAD) + `lastFailureAt`. Admin
   alert at ≥5 failures/1h (Sentry `captureMessage`).

## Entry points

- Producer: `enqueueWebhookEvent` (`packages/api/src/services/webhooks/enqueue.ts`).
- Fan-out: `handleWebhookPublish` registered in `outbox/handlers.ts` for `integration.webhook.publish`.
- Delivery route: `registerOutboundWebhookDeliverRoute` → `POST /webhooks-outbound/_deliver` (registered in
  `apps/api/src/routes/webhooks/index.ts` + `scripts/check-webhook-routes.mjs`).
- Management: `webhookSubscriptionRouter` (`root.ts` → `webhookSubscription`) — create/list/update/
  rotateSecret/delete/testFire/listDeliveries. **Create and update** re-assert `module.outbound-webhooks`;
  all mutations audit inside `$transaction` with `writeAuditLog({ tx })`. UI: Settings → Developer → Webhooks (`webhooks-tab.tsx`).

## Event catalog (`packages/validators/src/webhooks`)

16 locked types, a Zod discriminated union on `type`, each variant `.strict()`:
`contractor.{created,updated,offboarded,compliance_blocked}`, `invoice.{received,matched,approved,rejected,
paid}`, `payment_run.{created,completed}`, `workflow.{task.completed,completed}`, `classification.outcome`,
`compliance_doc.{expiring_soon,expired}`. Envelope: `{ id, type, created_at, organization_id, data, include_pii }`.

## Producer emit sites (every catalog type is wired)

Each type is emitted from the domain mutation that owns the transition, inside that mutation's `$transaction`
(so the event is durable iff the write commits). Shared helpers are emitted from once and cover every caller.
The full domain object is passed as `data` — the fan-out redacts per-subscription, so producers never pre-redact.

- `contractor.created|updated|offboarded` — `contractor-core.ts` `create` / `update` (wrapped in a tx) /
  `updateLifecycleStage`(→ENDED) + `archive`.
- `contractor.compliance_blocked` — `approval-engine.ts` `advanceFlow` when the final-step gate arms a
  `PENDING_COMPLIANCE` hold (keyed on the held invoice's contractor).
- `invoice.received` — `invoice-crud.ts` (staff intake) + `portal-invoices-router.ts` (portal submit).
- `invoice.matched` — `invoice-matching.ts` auto-match + manual-match.
- `invoice.approved` — shared `finalizeApprovedInvoice` (`approval-shared.ts`) → covers single + bulk approve.
- `invoice.rejected` — `approval-queue.ts` `reject` + `bulkReject`.
- `invoice.paid` — shared `applyInvoicePaymentOutcome` (`payment-shared.ts`) on full settlement → covers
  payment-run / bank-statement / manual sources.
- `payment_run.created` — `payment-core.ts` per created run; `payment_run.completed` — shared
  `autoCompleteRunIfTerminal` (`payment-shared.ts`) on clean completion (FAILED runs do not emit).
- `workflow.task.completed` — `workflow-execution-tasks.ts` `completeTask` + public-api DONE transition.
- `workflow.completed` — `unblockDependentsAndRecomputeRun` (`workflow-shared.ts`) now returns `runCompleted`;
  callers (completeTask, skipTask, IP-override, public-api, complete-with-pending-credentials) emit on the
  auto/explicit completion transition.
- `classification.outcome` — `classification-submit.ts` on assessment submit (contractors AND employees).
- `compliance_doc.expiring_soon|expired` — `compliance-reminder-scan.ts` cron, per band fire (EXPIRED band →
  `expired`, earlier bands → `expiring_soon`). The cron has **no `$transaction` seam**; the emit sits
  immediately after the durable optimistic-concurrency band-state write and inherits the same once-per-band
  Redis dedup (at-most-once, matching the co-located digest dispatch).

## Security controls

- **SSRF + DNS-rebind** (`ssrf-guard.ts`) — `assertWebhookUrlSafe` blocks private/loopback/link-local/ULA/
  unspecified/CGNAT/metadata (IPv4, IPv6, IPv4-mapped) at BOTH subscribe and dispatch; `webhookAgentLookup`
  re-resolves + re-classifies at socket connect (TOCTOU). HTTPS-only unless a per-sub `httpAllowed` override.
  Hand-rolled `lookup` hook — no `request-filtering-agent` dependency. Redirects never followed
  (`https.request`).
- **HMAC signature** (`signer.ts`) — `X-CO-Signature: t={ms},v1={hex}` where `v1 = HMAC_SHA256(secret,
  "{t}.{body}")`; verifiers reject `|now-t| > 300_000` ms BEFORE a `timingSafeEqual` compare (replay defence).
  Sample verifiers ship in TS/Python/Go/PHP under `apps/public-api/docs/webhooks/verifiers/`.
- **PII redaction** (`redact.ts`) — `redactPii` deep-strips national IDs / bank IDs / contact PII BEFORE the
  snapshot persists, unless the subscription opts into `include_pii`.
- **Secret at rest** (`secret-store.ts`) — the `whsec_` secret is AES-256-GCM encrypted (recoverable, re-signed
  every delivery), key `WEBHOOK_SECRET_ENCRYPTION_KEY`. Revealed once at create/rotate.
- **CSRF-origin exemption for QStash callbacks** — the CSRF origin plugin (`apps/api/src/plugins/csrf-origin.ts`)
  exempts `/webhooks-outbound/`, `/contract-health/`, and `/idp-deprovisioning/`: QStash callbacks send no
  Origin header and would 403 before signature verification. The pre-existing `/webhooks/` exemption does NOT
  prefix-match these routes — any new QStash callback route family must be added to `EXEMPT_PREFIXES`.

## Models (`packages/db/prisma/schema/webhook.prisma`)

`WebhookSubscription` (endpoint), `WebhookDeliveryAttempt` (one send), `WebhookDeadLetter` (@@map
`webhook_failures`) + `OutboundWebhookStatus` enum. Name-distinct from the inbound `WebhookDelivery`. RLS:
member-read / ops-write. Migration `20260705120000_phase100_outbound_webhooks` (generated, applied at deploy).

## Agent mistakes to avoid

- Outbound ≠ the inbound `WebhookDelivery`/`WebhookDeliveryStatus` — never reuse them.
- SSRF-check at BOTH gates (subscribe AND dispatch) — subscribe-time alone is DNS-rebind-bypassable.
- Redact BEFORE persisting the snapshot — not just before the POST — or a DLQ inspection leaks PII.
- Nothing dispatches without `module.outbound-webhooks`; subscribe mutations also reject when the module is off.
- Kill-switch-disabled attempts stay `PENDING` and are re-enqueued — not silently dropped.
- The webhook secret is encrypted (recoverable), NOT one-way hashed like an API key.
- Adding a QStash callback route family without listing it in `EXEMPT_PREFIXES` (`csrf-origin.ts`) — no-Origin callbacks 403 before signature verification, and `/webhooks/` does not cover it.
