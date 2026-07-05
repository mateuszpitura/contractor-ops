/**
 * Stripe webhook handler.
 *
 *   1. Read raw body (signature verification needs the original bytes).
 *   2. Verify `stripe-signature` via Stripe SDK.
 *   3. Reject deliveries > 24 h old unless they are "settlement" or
 *      subscription-lifecycle event types — Stripe's 3-day redelivery
 *      window can otherwise re-fire stale cosmetic events after our
 *      handler graph has moved on. Subscription state-changing events are
 *      exempt (a genuinely late cancellation must still be applied); the
 *      billing-webhook out-of-order guard stops a late one clobbering
 *      newer state.
 *   4. Inside a single Serializable transaction:
 *        - Upsert `StripeEvent { stripeEventId, eventType, payloadJson }`.
 *        - Skip processing if `processedAt` is already set (idempotency).
 *        - `routeStripeEvent` returns a queue of NotificationEvents.
 *        - Enqueue each into the transactional outbox (same tx) so it
 *          commits atomically with the state change and is delivered
 *          exactly-once by the drain — a rollback drops the notification
 *          with the write, a crash after commit still delivers via drain.
 *        - Mark processed before commit.
 *   5. 500 on processing error so Stripe retries; 200 on success.
 *
 * Exempt from the CSRF origin guard (handled by HMAC signature verify
 * instead). Stripe sends with no Origin header.
 *
 * Encapsulated under the webhooks plugin (registered via
 * `registerWebhookRoutes` in `routes/webhooks/index.ts`) so the
 * raw-body content-type parser scoped there does not break JSON
 * parsing on sibling routes.
 */

import { routeStripeEvent } from '@contractor-ops/api/services/billing-webhook';
import type { OutboxTransactionalClient } from '@contractor-ops/api/services/outbox';
import { enqueueNotificationOutboxEvent } from '@contractor-ops/api/services/outbox';
import { stripe } from '@contractor-ops/api/services/stripe-client';
import { prisma } from '@contractor-ops/db';
import { createWebhookLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { FastifyInstance } from 'fastify';
import type Stripe from 'stripe';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';

const log = createWebhookLogger('stripe');

const SETTLEMENT_EVENT_TYPES = new Set<string>([
  'charge.refunded',
  'charge.refund.updated',
  'charge.dispute.created',
  'charge.dispute.closed',
  'charge.dispute.funds_reinstated',
  'charge.dispute.funds_withdrawn',
  'charge.dispute.updated',
]);

// Subscription lifecycle events that MUTATE persisted entitlement state
// (status / tier / cancellation). Stripe retries deliveries for up to 3 days,
// so a genuinely late cancellation or status change can arrive outside the 24 h
// window — dropping it as `late_delivery` would leave entitlement permanently
// drifted from Stripe. These bypass the age gate; the billing-webhook
// out-of-order guard (`lastEventCreated`) ensures a late delivery still cannot
// overwrite newer state. Cosmetic / notification-only events (e.g.
// `customer.subscription.trial_will_end`) stay subject to the gate.
const SUBSCRIPTION_LIFECYCLE_EVENT_TYPES = new Set<string>([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

function isAgeGateExempt(eventType: string): boolean {
  return (
    SETTLEMENT_EVENT_TYPES.has(eventType) || SUBSCRIPTION_LIFECYCLE_EVENT_TYPES.has(eventType)
  );
}

const MAX_AGE_SECONDS = 24 * 60 * 60;

// The raw-body parser registered inside the webhooks plugin scope delivers
// `request.body` as a Buffer. Signature verification needs the exact bytes
// the signature was computed over.
function rawBodyFrom(body: unknown): string {
  if (body instanceof Buffer) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return '';
}

export function registerStripeWebhookRoute(app: FastifyInstance): void {
  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    const rawBody = rawBodyFrom(request.body);

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        loadEnv().STRIPE_WEBHOOK_SECRET ?? '',
      );
    } catch (err) {
      log.warn({ err }, 'signature verification failed');
      return reply.code(400).send({ error: 'Invalid signature' });
    }

    const eventAgeSeconds = Math.floor(Date.now() / 1000) - event.created;
    if (eventAgeSeconds > MAX_AGE_SECONDS && !isAgeGateExempt(event.type)) {
      log.warn(
        { eventId: event.id, eventType: event.type, eventAgeSeconds },
        'rejecting late Stripe webhook delivery — outside 24h window',
      );
      metrics.increment('webhook.late_delivery_rejected', 1, {
        provider: 'stripe',
        eventType: event.type,
      });
      return reply.code(200).send({ received: true, skipped: 'late_delivery' });
    }

    try {
      const enqueuedNotifications = await prisma.$transaction(
        async tx => {
          const existing = await tx.stripeEvent.findUnique({
            where: { stripeEventId: event.id },
            select: { processedAt: true },
          });
          if (existing?.processedAt) return [];

          await tx.stripeEvent.upsert({
            where: { stripeEventId: event.id },
            create: {
              stripeEventId: event.id,
              eventType: event.type,
              payloadJson: JSON.parse(JSON.stringify(event.data.object)),
            },
            update: {},
          });

          const events = await routeStripeEvent(
            event,
            tx as unknown as Parameters<typeof routeStripeEvent>[1],
          );

          // Enqueue each notification into the transactional outbox INSIDE
          // this transaction so it commits atomically with the StripeEvent
          // state change and is delivered exactly-once by the drain — instead
          // of a post-commit fire-and-forget that is silently lost if the
          // process dies between commit and send. Stripe idempotency
          // (StripeEvent unique + the processedAt guard above) already blocks
          // re-enqueue on redelivery; the dedupKey is a second-line guard.
          for (const [index, notification] of events.entries()) {
            await enqueueNotificationOutboxEvent({
              tx: tx as unknown as OutboxTransactionalClient,
              event: notification,
              dedupKey: `stripe:${event.id}:${index}`,
            });
          }

          await tx.stripeEvent.update({
            where: { stripeEventId: event.id },
            data: { processedAt: new Date() },
          });

          return events;
        },
        {
          isolationLevel: 'Serializable',
          timeout: 30_000,
        },
      );

      log.info(
        { eventId: event.id, eventType: event.type, enqueued: enqueuedNotifications.length },
        'event processed',
      );
      metrics.increment('webhook.processed', 1, {
        provider: 'stripe',
        eventType: event.type,
      });

      return reply.code(200).send({ received: true });
    } catch (err) {
      log.error({ err, eventId: event.id, eventType: event.type }, 'processing failed');
      Sentry.captureException(err, {
        tags: { 'webhook.provider': 'stripe', 'webhook.event_type': event.type },
        extra: { eventId: event.id },
      });
      metrics.increment('webhook.failed', 1, {
        provider: 'stripe',
        eventType: event.type,
      });
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }
  });
}
