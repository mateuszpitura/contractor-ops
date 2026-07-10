// Outbox registry type contracts, split from `handlers.ts` so individual
// handler modules (e.g. `hris-push.ts`) can type themselves against the
// registry without importing the registry itself (handlers.ts imports every
// handler module — a type import back into it forms an import cycle).

import type { NotificationEvent } from '../notification-service';
import type { WebhookPublishPayload } from '../webhooks/fan-out';

/**
 * The typed event-type catalogue. Add a literal here when introducing a new
 * outboxed side effect.
 */
export type OutboxEventType =
  | 'notification.dispatch'
  | 'integration.webhook.publish'
  | 'hris.invoice-paid.push'
  | 'hris.payment-status.push'
  | 'hris.classification-outcome.push';
// Future: 'search.reindex' | etc.

/**
 * Per-event payload contract. The handler signature is statically tied to
 * the same map so a typo on one side is a tsc error.
 *
 * The three `hris.*.push` payloads carry ONLY CO-owned business fields
 * (worker + business id) — no HRIS-owned registry key, so a push can never
 * echo back through a pull (the disjoint-partition loop break).
 */
export interface OutboxEventPayloadMap {
  'notification.dispatch': NotificationEvent;
  'integration.webhook.publish': WebhookPublishPayload;
  'hris.invoice-paid.push': {
    workerId: string;
    invoiceId: string;
    paidAt: string;
    amount: string;
    currency: string;
  };
  'hris.payment-status.push': {
    workerId: string;
    paymentId: string;
    status: string;
    occurredAt: string;
  };
  'hris.classification-outcome.push': {
    workerId: string;
    classificationId: string;
    outcome: string;
    decidedAt: string;
  };
}

export interface OutboxHandlerContext {
  /** OutboxEvent.id — pass to downstream services as their idempotency key. */
  outboxEventId: string;
  organizationId: string;
}

export type OutboxHandler<TType extends OutboxEventType> = (
  payload: OutboxEventPayloadMap[TType],
  ctx: OutboxHandlerContext,
) => Promise<void>;
