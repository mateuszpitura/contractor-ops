/**
 * Stripe webhook handler.
 *
 *   1. Read raw body (signature verification needs the original bytes).
 *   2. Verify `stripe-signature` via Stripe SDK.
 *   3. Reject deliveries > 24 h old unless they are "settlement" event
 *      types — Stripe's 3-day redelivery window can otherwise re-fire
 *      stale events after our handler graph has moved on (F-INT-21).
 *   4. Inside a single Serializable transaction:
 *        - Upsert `StripeEvent { stripeEventId, eventType, payloadJson }`.
 *        - Skip processing if `processedAt` is already set (idempotency).
 *        - `routeStripeEvent` returns a queue of NotificationEvents.
 *        - Mark processed before commit.
 *      F-ASYNC-13: notifications dispatch AFTER commit so a tx rollback
 *      cannot send a phantom user-facing message.
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

import {
  dispatchStripeWebhookNotifications,
  routeStripeEvent,
} from '@contractor-ops/api/services/billing-webhook';
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

const MAX_AGE_SECONDS = 24 * 60 * 60;

export function registerStripeWebhookRoute(app: FastifyInstance): void {
  app.post('/webhooks/stripe', async (request, reply) => {
    const signature = request.headers['stripe-signature'];
    if (typeof signature !== 'string' || signature.length === 0) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    // The raw-body parser registered inside the webhooks plugin scope
    // delivers `request.body` as a Buffer. Stripe's constructEvent needs
    // the exact bytes the signature was computed over.
    const rawBody =
      request.body instanceof Buffer
        ? request.body.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : '';

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
    if (eventAgeSeconds > MAX_AGE_SECONDS && !SETTLEMENT_EVENT_TYPES.has(event.type)) {
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
      const pendingNotifications = await prisma.$transaction(
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

      if (pendingNotifications.length > 0) {
        await dispatchStripeWebhookNotifications(pendingNotifications);
      }

      log.info({ eventId: event.id, eventType: event.type }, 'event processed');
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
