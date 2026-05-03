import { handleSigningCompletion } from '@contractor-ops/api/services/esign-orchestrator';
import { processResendWebhookDelivery } from '@contractor-ops/api/services/resend-email-intake';
import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import {
  buildContextFromHeaders,
  createWebhookLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import { webhookIngressReason } from '@contractor-ops/validators';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createWebhookLogger('process');

const webhookProcessBodySchema = z.object({
  deliveryId: z.string().min(1),
  provider: z.string().min(1),
});

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
 * 3. Dispatch to adapter.handleWebhook (+ provider-specific handlers in this file)
 * 4. Update delivery status (PROCESSED or FAILED)
 */
async function handler(request: NextRequest) {
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers BEFORE
  // any body / dispatch logic. Pure header-read additive change so P2-A's
  // return-code refactor below does not need to reason about correlation IDs.
  const traceCtx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(traceCtx, () => handlerInner(request));
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-provider dispatch (Jira/Linear/Resend/e-sign)
async function handlerInner(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = webhookProcessBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { deliveryId, provider } = parsed.data;

  const adapter = getAdapter(provider);
  if (!adapter?.handleWebhook) {
    return NextResponse.json({ error: 'No handler for provider' }, { status: 404 });
  }

  let delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  // Dedup guard: QStash is at-least-once. A delivery already in a terminal
  // PROCESSED state must not re-invoke the adapter or downstream provider
  // handlers, which are non-idempotent (Jira/Linear mutations, e-sign
  // completion, Resend intake). Return 200 so QStash stops retrying.
  if (delivery.deliveryStatus === 'PROCESSED') {
    log.info({ deliveryId, provider }, 'webhook delivery already PROCESSED; skipping re-delivery');
    return NextResponse.json({ skipped: true, reason: 'already-processed' });
  }

  // Atomic claim: flip RECEIVED or FAILED to PROCESSING. If no row matches
  // (another worker already claimed, or the row is already PROCESSED which
  // we checked above but may have transitioned in between), skip without
  // invoking the adapter. updateMany is compare-and-swap; PROCESSING is the
  // sentinel that says "a worker owns this row".
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
    return NextResponse.json({ skipped: true, reason: 'already-claimed' });
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
    return NextResponse.json({
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
        try {
          await handleSigningCompletion(
            esignResult.envelopeId,
            delivery.integrationConnectionId,
            provider.toUpperCase() as 'DOCUSIGN' | 'AUTENTI',
          );
        } catch (completionError) {
          log.error(
            { err: completionError, envelopeId: esignResult.envelopeId, provider },
            'failed to handle signing completion',
          );
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

    return NextResponse.json({ processed: true });
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: 'FAILED',
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Processing failed',
      },
    });

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
