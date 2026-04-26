import { routeStripeEvent } from '@contractor-ops/api/services/billing-webhook';
import { stripe } from '@contractor-ops/api/services/stripe-client';
import { prisma } from '@contractor-ops/db';
import { createWebhookLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

const log = createWebhookLogger('stripe');

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// ---------------------------------------------------------------------------

/**
 * Dedicated Stripe webhook endpoint.
 *
 * Flow:
 * 1. Verify Stripe signature
 * 2. Check idempotency via StripeEvent table (inside Serializable tx)
 * 3. Process event in a Serializable transaction to prevent race conditions
 * 4. Mark event as processed within the same transaction
 */
export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Step 1: Verify webhook signature
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? '',
    );
  } catch (error) {
    log.warn({ err: error }, 'signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    // Step 2+3: Idempotency check + processing in a single Serializable transaction.
    // This prevents the race condition where two concurrent webhook deliveries
    // both see processedAt=null and both proceed to process the event.
    await prisma.$transaction(
      async tx => {
        // Upsert the event record and check if already processed
        const existing = await tx.stripeEvent.findUnique({
          where: { stripeEventId: event.id },
          select: { processedAt: true },
        });

        if (existing?.processedAt) {
          // Already processed — skip (idempotent)
          return;
        }

        // Insert event record if it doesn't exist yet
        await tx.stripeEvent.upsert({
          where: { stripeEventId: event.id },
          create: {
            stripeEventId: event.id,
            eventType: event.type,
            payloadJson: JSON.parse(JSON.stringify(event.data.object)),
          },
          update: {},
        });

        // Route to appropriate handler
        await routeStripeEvent(event, tx as unknown as Parameters<typeof routeStripeEvent>[1]);

        // Mark as processed (still inside the same transaction)
        await tx.stripeEvent.update({
          where: { stripeEventId: event.id },
          data: { processedAt: new Date() },
        });
      },
      {
        isolationLevel: 'Serializable',
        timeout: 30_000,
      },
    );

    log.info({ eventId: event.id, eventType: event.type }, 'event processed');
    metrics.increment('webhook.processed', 1, {
      provider: 'stripe',
      eventType: event.type,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    log.error({ err: error, eventId: event.id, eventType: event.type }, 'processing failed');
    Sentry.captureException(error, {
      tags: { 'webhook.provider': 'stripe', 'webhook.event_type': event.type },
      extra: { eventId: event.id },
    });
    metrics.increment('webhook.failed', 1, {
      provider: 'stripe',
      eventType: event.type,
    });
    // Return 500 so Stripe retries the webhook
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
