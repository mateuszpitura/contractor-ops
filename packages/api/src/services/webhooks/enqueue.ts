/**
 * Typed producer for outbound webhook events. A business write calls this inside
 * its existing `$transaction` so the event is durably scheduled iff the write
 * commits — the outbox drain then fans it out to matching subscriptions. Wraps
 * `enqueueOutboxEvent` so producers never hand-assemble the envelope.
 */

import type { OutboxTransactionalClient } from '../outbox';
import { enqueueOutboxEvent } from '../outbox';
import type { WebhookPublishPayload } from './fan-out.js';

export function enqueueWebhookEvent(
  tx: OutboxTransactionalClient,
  organizationId: string,
  event: WebhookPublishPayload,
): Promise<string | null> {
  return enqueueOutboxEvent({
    tx,
    organizationId,
    eventType: 'integration.webhook.publish',
    payload: event as unknown as Record<string, unknown>,
    aggregateType: 'webhook',
    aggregateId: event.aggregateId,
  });
}
