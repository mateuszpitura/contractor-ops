import { prisma } from "@contractor-ops/db";
import { registerAllAdapters } from "@contractor-ops/integrations/adapters/register-all";
import { getAdapter } from "@contractor-ops/integrations/registry";
import { getQStashClient } from "@contractor-ops/integrations/services/qstash-client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// POST /api/webhooks/[provider]
// ---------------------------------------------------------------------------

/**
 * Unified webhook ingestion route.
 *
 * Flow (per D-05, D-06):
 * 1. Resolve adapter by provider slug
 * 2. Verify webhook signature via adapter
 * 3. Log to WebhookDelivery table
 * 4. Queue for async processing via QStash
 * 5. Return 200 (or response_action for Slack view_submission)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const adapter = getAdapter(provider);

  // Unknown provider or adapter doesn't support webhooks
  if (!adapter?.supportsWebhooks) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  // Step 1: Verify signature via adapter
  const verification = adapter.verifyWebhookSignature?.(rawBody, headers);
  if (!verification?.valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Step 2: Parse payload (Slack sends form-encoded, others send JSON)
  const isSlackViewSubmission = provider === "slack" && rawBody.includes("view_submission");

  let payloadJson: unknown;
  try {
    if (provider === "slack") {
      const formParams = new URLSearchParams(rawBody);
      const payloadStr = formParams.get("payload");
      payloadJson = payloadStr ? JSON.parse(payloadStr) : {};
    } else {
      payloadJson = JSON.parse(rawBody);
    }
  } catch {
    payloadJson = { raw: rawBody.slice(0, 10000) };
  }

  // Step 3: Log to WebhookDelivery
  const delivery = await prisma.webhookDelivery.create({
    data: {
      organizationId: verification.organizationId ?? "PENDING",
      provider: adapter.slug.toUpperCase() as never,
      eventType: verification.eventType ?? "UNKNOWN",
      signatureValid: true,
      payloadJson: payloadJson as never,
      deliveryStatus: "RECEIVED",
      integrationConnectionId: verification.connectionId ?? null,
    },
  });

  // Step 4: Queue for async processing via QStash (per D-05)
  try {
    const qstash = getQStashClient();
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/_process`,
      body: { deliveryId: delivery.id, provider },
      retries: 3,
    });
  } catch (queueError) {
    console.error(`[webhook/${provider}] Failed to queue for processing:`, queueError);
    // Still return 200 — delivery is logged, can be retried manually
  }

  // For Slack view_submission, return response_action to close the modal
  if (isSlackViewSubmission) {
    return NextResponse.json({ response_action: "clear" });
  }

  return NextResponse.json({ received: true });
}
