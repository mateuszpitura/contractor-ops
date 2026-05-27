import { prisma } from '@contractor-ops/db';
import { getAdapter } from '../registry.js';
import type { WebhookVerificationResult } from '../types/webhook.js';
import { publishJSONWithContext } from './qstash-client.js';

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
 * @param configuredSecret - Optional server-resolved webhook secret (per-connection
 *   adapters such as Jira / Linear). Adapters that resolve their secret from a
 *   static env var ignore this parameter.
 * @returns The verification result from the adapter
 * @throws If no adapter is registered for the given provider
 */
export function dispatchWebhook(
  provider: string,
  rawBody: string,
  headers: Record<string, string>,
  configuredSecret?: string | null,
): WebhookVerificationResult {
  const adapter = getAdapter(provider);

  if (!adapter) {
    throw new Error(`No adapter registered for provider: ${provider}`);
  }

  if (!adapter.verifyWebhookSignature) {
    throw new Error(`Adapter "${provider}" does not support webhook signature verification`);
  }

  return adapter.verifyWebhookSignature(rawBody, headers, configuredSecret);
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
      provider: params.provider.toUpperCase() as 'SLACK',
      eventType: params.eventType,
      signatureValid: params.signatureValid,
      payloadJson: params.payloadJson as never,
      deliveryStatus: 'RECEIVED',
      integrationConnectionId: params.connectionId ?? null,
    },
  });
}

/**
 * Queues a webhook delivery for async processing via QStash.
 *
 * F-INT-11: passes `deliveryId` as the QStash deduplication id so a
 * re-publish of the same `WebhookDelivery` row (e.g. ingress route retries
 * the queue step after a transient failure) collapses to a single delivery
 * within Upstash's 24h dedup window. `deliveryId` is a cuid generated inside
 * the ingress route's transaction and is naturally unique per logical
 * webhook event.
 *
 * F-OBS-03: forward x-request-id + traceparent so the consumer route can
 * correlate inbound-webhook → processing logs end-to-end.
 *
 * @param deliveryId - The WebhookDelivery record ID (used as the dedup key)
 * @param provider - The provider slug
 */
export async function queueWebhookProcessing(deliveryId: string, provider: string): Promise<void> {
  // Drain endpoint lives on the Fastify API host (apps/api) at
  // `/webhooks/_process` — Fastify routes mount at the root.
  const apiUrl = process.env.API_URL ?? '';
  await publishJSONWithContext({
    url: `${apiUrl}/webhooks/_process`,
    body: { deliveryId, provider },
    retries: 3,
    deduplicationId: deliveryId,
  });
}
