/**
 * Outbox fan-out handler for `integration.webhook.publish`.
 *
 * Runs inside the shared outbox drain — FAN-OUT ONLY, no network I/O, so a slow
 * subscriber endpoint never stalls `notification.dispatch`. For each enabled
 * subscription whose `eventFilter` matches, it redacts the payload per the
 * subscription's `includePii` (BEFORE the snapshot persists, so no PII sits in a
 * deliverable row), persists one `WebhookDeliveryAttempt`, and enqueues a
 * `webhook.deliver` job. A per-subscription try/catch isolates a poison row so
 * one bad subscription never fails the whole fan-out.
 */

import { prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { WebhookEventType } from '@contractor-ops/validators';

import { enqueueJob } from '../queue.js';
import { redactPii } from './redact.js';

const log = createLogger({ service: 'webhook-fan-out' });

export interface WebhookPublishPayload {
  eventType: WebhookEventType;
  aggregateId?: string;
  data: unknown;
}

interface FanOutContext {
  outboxEventId: string;
  organizationId: string;
}

export async function handleWebhookPublish(
  payload: WebhookPublishPayload,
  ctx: FanOutContext,
): Promise<void> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      organizationId: ctx.organizationId,
      enabled: true,
      eventFilter: { has: payload.eventType },
    },
  });

  for (const sub of subscriptions) {
    try {
      const redacted = redactPii(payload.data, { includePii: sub.includePii });
      const attempt = await prisma.webhookDeliveryAttempt.create({
        data: {
          subscriptionId: sub.id,
          organizationId: ctx.organizationId,
          outboxEventId: ctx.outboxEventId,
          eventType: payload.eventType,
          payloadJson: redacted as never,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      });
      await enqueueJob('webhook.deliver', { attemptId: attempt.id }, { dedupId: attempt.id });
    } catch (err) {
      // Poison isolation — a single bad subscription must not fail the batch.
      log.error(
        { err, subscriptionId: sub.id, organizationId: ctx.organizationId, eventType: payload.eventType },
        'webhook fan-out failed for subscription',
      );
    }
  }
}
