import { prisma } from "@contractor-ops/db";
import { getAdapter } from "../registry.js";
import type { WebhookVerificationResult } from "../types/webhook.js";
import { getQStashClient } from "./qstash-client.js";

// ---------------------------------------------------------------------------
// Webhook Dispatcher Service
// ---------------------------------------------------------------------------

/**
 * Dispatches an incoming webhook to the appropriate provider adapter
 * for signature verification.
 *
 * @param provider - The provider slug (e.g., "slack", "resend")
 * @param rawBody - The raw request body as a string
 * @param headers - The request headers as a key-value map
 * @returns The verification result from the adapter
 * @throws If no adapter is registered for the given provider
 */
export function dispatchWebhook(
  provider: string,
  rawBody: string,
  headers: Record<string, string>,
): WebhookVerificationResult {
  const adapter = getAdapter(provider);

  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${provider}`);
  }

  if (!adapter.verifyWebhookSignature) {
    throw new Error(`Adapter "${provider}" does not support webhook signature verification`);
  }

  return adapter.verifyWebhookSignature(rawBody, headers);
}

/**
 * Logs a webhook delivery to the database.
 *
 * @returns The created WebhookDelivery record
 */
export async function logWebhookDelivery(params: {
  organizationId: string;
  provider: string;
  eventType: string;
  signatureValid: boolean;
  payloadJson: unknown;
  connectionId?: string;
}) {
  return prisma.webhookDelivery.create({
    data: {
      organizationId: params.organizationId,
      provider: params.provider.toUpperCase() as "SLACK",
      eventType: params.eventType,
      signatureValid: params.signatureValid,
      payloadJson: params.payloadJson as never,
      deliveryStatus: "RECEIVED",
      integrationConnectionId: params.connectionId ?? null,
    },
  });
}

/**
 * Queues a webhook delivery for async processing via QStash.
 *
 * @param deliveryId - The WebhookDelivery record ID
 * @param provider - The provider slug
 */
export async function queueWebhookProcessing(deliveryId: string, provider: string): Promise<void> {
  const qstash = getQStashClient();

  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/_process`,
    body: { deliveryId, provider },
    retries: 3,
  });
}
