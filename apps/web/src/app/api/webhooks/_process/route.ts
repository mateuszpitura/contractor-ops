import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@contractor-ops/db";
import { getAdapter } from "@contractor-ops/integrations/registry";
import { registerAllAdapters } from "@contractor-ops/integrations/adapters/register-all";

// ---------------------------------------------------------------------------
// Ensure adapters are registered
// ---------------------------------------------------------------------------

registerAllAdapters();

// ---------------------------------------------------------------------------
// POST /api/webhooks/_process
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for async webhook processing.
 *
 * Per Research Pitfall 6: this endpoint is public but verified via
 * QStash signature (QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY).
 *
 * Flow:
 * 1. QStash verifies its own signature (via verifySignatureAppRouter wrapper)
 * 2. Look up WebhookDelivery record
 * 3. Dispatch to adapter.handleWebhook
 * 4. Update delivery status (PROCESSED or FAILED)
 */
async function handler(request: NextRequest) {
  const body = await request.json();
  const { deliveryId, provider } = body as {
    deliveryId: string;
    provider: string;
  };

  if (!deliveryId || !provider) {
    return NextResponse.json(
      { error: "Missing deliveryId or provider" },
      { status: 400 },
    );
  }

  const adapter = getAdapter(provider);
  if (!adapter?.handleWebhook) {
    return NextResponse.json(
      { error: "No handler for provider" },
      { status: 404 },
    );
  }

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return NextResponse.json(
      { error: "Delivery not found" },
      { status: 404 },
    );
  }

  try {
    await adapter.handleWebhook(
      delivery.payloadJson,
      delivery.organizationId,
      delivery.integrationConnectionId ?? "",
    );

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ processed: true });
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: "FAILED",
        processedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Processing failed",
      },
    });

    return NextResponse.json(
      { error: "Processing failed" },
      { status: 500 },
    );
  }
}

// Wrap with QStash signature verification (per Research Pitfall 6)
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
