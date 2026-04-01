import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { stripe } from "@contractor-ops/api/services/stripe-client";
import { routeStripeEvent } from "@contractor-ops/api/services/billing-webhook";
import { prisma } from "@contractor-ops/db";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
// ---------------------------------------------------------------------------

/**
 * Dedicated Stripe webhook endpoint (D-20 — NOT through [provider] route).
 *
 * Flow:
 * 1. Verify Stripe signature
 * 2. Check idempotency via StripeEvent table
 * 3. Process event in a transaction (upsert event + route handler)
 * 4. Mark event as processed
 */
export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  // Step 1: Verify webhook signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error("[stripe-webhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    // Step 2: Idempotency check
    const existing = await prisma.stripeEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (existing?.processedAt) {
      return NextResponse.json({ received: true });
    }

    // Step 3: Process in transaction
    await prisma.$transaction(async (tx) => {
      // Upsert the event record (handles race conditions)
      await tx.stripeEvent.upsert({
        where: { stripeEventId: event.id },
        create: {
          stripeEventId: event.id,
          eventType: event.type,
          payloadJson: event.data.object as Record<string, unknown>,
        },
        update: {},
      });

      // Route to appropriate handler
      await routeStripeEvent(event, tx);

      // Mark as processed
      await tx.stripeEvent.update({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
