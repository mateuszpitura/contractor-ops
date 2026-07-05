# Plan 95-07 Summary — outbound push (three outbox event types + producers)

**Wave:** 4 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/api/src/services/outbox/handlers.ts` | THREE new `OutboxEventType` literals + payload-map entries + registry handlers |
| `packages/api/src/services/outbox/hris-push.ts` | the three push handlers (resolve → flag-gate → change-origin guard → adapter push → audit) |
| `packages/api/src/services/outbox/hris-push-target.ts` | `resolveHrisPushTarget` — org's HRIS connection + region + decrypted creds + worker→externalId |
| `packages/api/src/services/outbox/hris-push-producer.ts` | `enqueueHrisEmployeePush` — the EMPLOYEE-guarded producer helper |
| `packages/api/src/routers/finance/payment-run-ops.ts` | `updateItemStatus` enqueues invoice-paid + payment-status inside its `$transaction` |
| `packages/api/src/routers/compliance/classification-submit.ts` | `submit` enqueues classification-outcome inside its `$transaction` |

## Correction C1 honored

`invoice.paid` was **not** already an outbox event type (only `notification.dispatch` + `integration.webhook.publish` existed). All **three** are new: `hris.invoice-paid.push`, `hris.payment-status.push`, `hris.classification-outcome.push` — each a literal + `OutboxEventPayloadMap` entry + `outboxHandlerRegistry` handler (tsc-tied so a typo is a compile error).

## As-built

- **Handler pipeline (each event):** `resolveHrisPushTarget(org, workerId)` → no connection → **no-op** (not an error); `evaluate('integration.<provider>-sync')` dark → **no-op**; `assertNotHrisOwnedField(input)` (the change-origin loop guard); `loadHeavyAdapters()` + `getAdapter(...).pushEmployeeEvent(creds, { ...input, idempotencyKey: outboxEventId })`; `writeAuditLog(INTEGRATION)`. Throwing = transient → the outbox retries with backoff.
- **`resolveHrisPushTarget` lives in its own module** so the outbox test can mock it across the module boundary (ESM internal-call limitation); it queries the raw prisma with an explicit `organizationId` filter (the drain runs outside tenant scope) and joins `workerId → externalId` via ExternalLink.
- **Producers enqueue, never call the adapter inline (D-03):** the three producer mutations call `enqueueHrisEmployeePush` inside their existing `$transaction` with `dedupKey = ${workerId}:${eventType}:${businessEventId}`. The helper is a **no-op unless the worker is an EMPLOYEE** — contractor invoices/payments/assessments never push. In the current model these three seams resolve to CONTRACTOR-typed workers, so they are **guarded forward seams** (inert until an employee carries such an event), exactly the "mutation only enqueues, EMPLOYEE-guarded" contract the plan specifies.

## Verification

- `pnpm -F @contractor-ops/api test hris-outbox hris-push-loop` → 8 passed (three event types dispatch with `outboxEventId` idempotency; no-connection / dark-flag no-op; loop guard).
- `pnpm typecheck --filter=@contractor-ops/api` → 16/16.
- `pnpm lint:audit-log` + `pnpm lint:logs` green.
- Regression: extended the hand-rolled mock `tx` in `classification.test.ts` (added `contractorAssignment.findUnique` + `worker.findUnique`) for the new producer query — `classification.test.ts` 31 passed, `payment.test.ts` 28 passed.

## Loop-break (as-built, full)

Disjoint partition + `assertNotHrisOwnedField` on every push + a pull that never enqueues → the two-way sync is acyclic by construction. `outboxEventId` (dispatch) + `dedupKey` (enqueue) make it idempotent end-to-end.
