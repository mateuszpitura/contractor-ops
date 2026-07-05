// Outbound HRIS push handlers — dispatch a CO business event to the connected
// HRIS through the transactional outbox.
//
// Each handler: resolve the org's HRIS target (no connection → no-op, not an
// error); short-circuit when the integration.*-sync flag is dark; run the
// change-origin guard (the payload must carry no HRIS-owned key — the loop
// break); dispatch the adapter push threading the outbox event id as the
// idempotency key; audit. Throwing = transient → the outbox retries with
// backoff. The mutation only ever ENQUEUES — it never calls the adapter inline.

import type { FlagKey } from '@contractor-ops/feature-flags';
import { evaluate } from '@contractor-ops/feature-flags';
import type { HrisProvider, HrisPushInput } from '@contractor-ops/integrations';
import { getAdapter, loadHeavyAdapters } from '@contractor-ops/integrations';
import { writeAuditLog } from '../audit-writer';
import { assertNotHrisOwnedField } from '../hris-sync/field-partition';
import type { OutboxHandler, OutboxHandlerContext } from './handlers';
import { resolveHrisPushTarget } from './hris-push-target';

interface HrisPushAdapter {
  pushEmployeeEvent: (creds: unknown, input: HrisPushInput) => Promise<void>;
}

function providerSlug(provider: HrisProvider): 'personio' | 'bamboohr' {
  return provider === 'PERSONIO' ? 'personio' : 'bamboohr';
}

function syncFlagFor(provider: HrisProvider): FlagKey {
  return provider === 'PERSONIO' ? 'integration.personio-sync' : 'integration.bamboohr-sync';
}

/**
 * Shared push pipeline for the three HRIS event kinds. `build` turns the outbox
 * payload into the typed `HrisPushInput` (adding `kind`); the resolved target
 * supplies creds + externalId; `outboxEventId` becomes the idempotency key.
 */
async function dispatchHrisPush(
  payload: { workerId: string },
  ctx: OutboxHandlerContext,
  build: (externalId?: string) => HrisPushInput,
  auditAction: string,
): Promise<void> {
  const target = await resolveHrisPushTarget(ctx.organizationId, payload.workerId);
  if (!target) return;

  const region = target.region === 'ME' ? ('ME' as const) : ('EU' as const);
  if (
    !evaluate(syncFlagFor(target.provider), { organizationId: ctx.organizationId, region }).enabled
  ) {
    return;
  }

  const input = build(target.externalId);
  // Change-origin guard: the loop-break. A push must never carry an HRIS-owned
  // registry key, or it could echo into a subsequent pull.
  assertNotHrisOwnedField(input);

  await loadHeavyAdapters();
  const adapter = getAdapter(providerSlug(target.provider)) as unknown as HrisPushAdapter;
  await adapter.pushEmployeeEvent(target.creds, { ...input, idempotencyKey: ctx.outboxEventId });

  await writeAuditLog({
    organizationId: ctx.organizationId,
    actorType: 'INTEGRATION',
    action: auditAction,
    resourceType: 'WORKER',
    resourceId: payload.workerId,
  });
}

export const handleHrisInvoicePaidPush: OutboxHandler<'hris.invoice-paid.push'> = (payload, ctx) =>
  dispatchHrisPush(
    payload,
    ctx,
    externalId => ({
      kind: 'invoice-paid',
      workerId: payload.workerId,
      invoiceId: payload.invoiceId,
      paidAt: payload.paidAt,
      amount: payload.amount,
      currency: payload.currency,
      externalId,
    }),
    'hris.push.invoice-paid',
  );

export const handleHrisPaymentStatusPush: OutboxHandler<'hris.payment-status.push'> = (
  payload,
  ctx,
) =>
  dispatchHrisPush(
    payload,
    ctx,
    externalId => ({
      kind: 'payment-status',
      workerId: payload.workerId,
      paymentId: payload.paymentId,
      status: payload.status,
      occurredAt: payload.occurredAt,
      externalId,
    }),
    'hris.push.payment-status',
  );

export const handleHrisClassificationOutcomePush: OutboxHandler<
  'hris.classification-outcome.push'
> = (payload, ctx) =>
  dispatchHrisPush(
    payload,
    ctx,
    externalId => ({
      kind: 'classification-outcome',
      workerId: payload.workerId,
      classificationId: payload.classificationId,
      outcome: payload.outcome,
      decidedAt: payload.decidedAt,
      externalId,
    }),
    'hris.push.classification-outcome',
  );

export { resolveHrisPushTarget } from './hris-push-target';
