/**
 * QStash drain (`POST /webhooks/_process`).
 *
 *   1. Verify QStash signature via the framework-agnostic `Receiver` from
 *      `@upstash/qstash`.
 *   2. Reseed the ALS request-context frame from upstream QStash headers
 *      (F-OBS-03) so logger correlation IDs follow the job through every
 *      side-effect.
 *   3. Wrap with `withQueueObservability('webhooks-process', …)` for the
 *      per-tick duration histogram (F-ASYNC-17).
 *   4. Validate body shape (`deliveryId`, `provider`).
 *   5. Look up `WebhookDelivery` row, dedup PROCESSED, atomic claim
 *      RECEIVED|FAILED → PROCESSING (compare-and-swap).
 *   6. Resolve org id (fall back to integrationConnection lookup; Jira /
 *      Linear deliveries without an org id fail-fast).
 *   7. Dispatch to the adapter's `handleWebhook` + per-provider handlers
 *      (Jira, Linear, Resend, DocuSign / Autenti completion).
 *   8. Flip status to PROCESSED, or FAILED + Sentry capture on throw.
 *
 * Exempt from the CSRF origin guard — QStash sends with no Origin and
 * signature verification is the actual authn here.
 *
 * Lives under the webhook plugin scope so the raw-body content-type
 * parser delivers the bytes QStash's HMAC was computed over.
 */

import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { handleSigningCompletion } from '@contractor-ops/api/services/esign-orchestrator';
import { processResendWebhookDelivery } from '@contractor-ops/api/services/resend-email-intake';
import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import { createWebhookLogger, getRequestId } from '@contractor-ops/logger';
import { webhookIngressReason } from '@contractor-ops/validators';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../../lib/qstash-verify.js';
import { Sentry } from '../../lib/sentry.js';

const log = createWebhookLogger('process');

const webhookProcessBodySchema = z.object({
  deliveryId: z.string().min(1),
  provider: z.string().min(1),
});

// Adapter registry is process-singleton — register once at module load.
registerAllAdapters();

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-provider dispatch (Jira/Linear/Resend/e-sign) ported 1:1
async function handlerInner(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    // safe-swallow: unparseable JSON drops to the zod safeParse below
    // (returns 400 either way). Logging here would duplicate access-log
    // noise that's already observable.
    parsedJson = null;
  }

  const parsed = webhookProcessBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const { deliveryId, provider } = parsed.data;

  const adapter = getAdapter(provider);
  if (!adapter?.handleWebhook) {
    return reply.code(404).send({ error: 'No handler for provider' });
  }

  let delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return reply.code(404).send({ error: 'Delivery not found' });
  }

  if (delivery.deliveryStatus === 'PROCESSED') {
    log.info({ deliveryId, provider }, 'webhook delivery already PROCESSED; skipping re-delivery');
    return reply.code(200).send({ skipped: true, reason: 'already-processed' });
  }

  // Compare-and-swap claim. PROCESSING is the sentinel that says "a
  // worker owns this row". If another worker raced ahead, claim.count is
  // 0 and we return without re-invoking the (non-idempotent) handler.
  const claim = await prisma.webhookDelivery.updateMany({
    where: {
      id: deliveryId,
      deliveryStatus: { in: ['RECEIVED', 'FAILED'] },
    },
    data: { deliveryStatus: 'PROCESSING' },
  });

  if (claim.count === 0) {
    log.warn(
      { deliveryId, provider, observedStatus: delivery.deliveryStatus },
      'webhook delivery already claimed or no longer claimable; skipping',
    );
    return reply.code(200).send({ skipped: true, reason: 'already-claimed' });
  }

  let effectiveOrgId = delivery.organizationId;
  if (!effectiveOrgId && delivery.integrationConnectionId) {
    const conn = await prisma.integrationConnection.findUnique({
      where: { id: delivery.integrationConnectionId },
      select: { organizationId: true },
    });
    if (conn?.organizationId) {
      effectiveOrgId = conn.organizationId;
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { organizationId: effectiveOrgId },
      });
      delivery = { ...delivery, organizationId: effectiveOrgId };
    }
  }

  if (!effectiveOrgId && (provider === 'jira' || provider === 'linear')) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: 'FAILED',
        processedAt: new Date(),
        errorMessage:
          'Missing organizationId on delivery; Jira/Linear webhooks require org resolution at ingress',
      },
    });
    return reply.code(200).send({
      processed: false,
      reason: webhookIngressReason.missingOrganizationId,
    });
  }

  try {
    const webhookResult = await adapter.handleWebhook(
      delivery.payloadJson,
      effectiveOrgId,
      delivery.integrationConnectionId ?? '',
    );

    if (provider === 'jira') {
      const { processJiraWebhook } = await import(
        '@contractor-ops/api/services/jira-webhook-handler'
      );
      await processJiraWebhook(
        prisma as unknown as Parameters<typeof processJiraWebhook>[0],
        effectiveOrgId,
        delivery.integrationConnectionId ?? '',
        delivery.payloadJson,
      );
    }

    if (provider === 'linear') {
      const { processLinearWebhook } = await import(
        '@contractor-ops/api/services/linear-webhook-handler'
      );
      await processLinearWebhook(
        prisma as unknown as Parameters<typeof processLinearWebhook>[0],
        effectiveOrgId,
        delivery.integrationConnectionId ?? '',
        delivery.payloadJson,
      );
    }

    if (provider === 'resend') {
      await processResendWebhookDelivery(
        prisma as unknown as Parameters<typeof processResendWebhookDelivery>[0],
        {
          organizationId: effectiveOrgId,
          eventType: delivery.eventType,
          payloadJson: delivery.payloadJson,
        },
      );
    }

    const isESignProvider = provider === 'docusign' || provider === 'autenti';
    if (isESignProvider) {
      const esignResult = webhookResult as { envelopeId: string; completed: boolean } | undefined;

      if (esignResult?.completed && delivery.integrationConnectionId) {
        // safe-swallow: a completion side-effect failure must NOT mark the
        // delivery FAILED — that would re-deliver and re-invoke the
        // idempotent adapter. Log + Sentry-capture so operators can replay
        // completion manually via the dead-letter dashboard.
        try {
          await handleSigningCompletion(
            esignResult.envelopeId,
            delivery.integrationConnectionId,
            provider.toUpperCase() as 'DOCUSIGN' | 'AUTENTI',
          );
        } catch (completionError) {
          log.error(
            {
              err: completionError,
              envelopeId: esignResult.envelopeId,
              provider,
              deliveryId,
              requestId: getRequestId(),
            },
            'failed to handle signing completion',
          );
          Sentry.captureException(completionError, {
            tags: { 'webhook.provider': provider, 'webhook.stage': 'esign-completion' },
            extra: { deliveryId, envelopeId: esignResult.envelopeId },
          });
        }
      }
    }

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return reply.code(200).send({ processed: true });
  } catch (error) {
    log.error(
      {
        err: error,
        deliveryId,
        provider,
        organizationId: effectiveOrgId,
        requestId: getRequestId(),
      },
      'webhook processing failed',
    );
    Sentry.captureException(error, {
      tags: { 'webhook.provider': provider },
      extra: { deliveryId, organizationId: effectiveOrgId, requestId: getRequestId() },
    });

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: 'FAILED',
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Processing failed',
      },
    });

    return reply.code(500).send({ error: 'Processing failed' });
  }
}

export function registerProcessWebhookRoute(app: FastifyInstance): void {
  app.post('/webhooks/_process', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() =>
      // F-ASYNC-17 — emit per-tick duration histogram via cron-monitor.
      withQueueObservability('webhooks-process', () => handlerInner(request, reply, guard.rawBody)),
    );
  });
}
