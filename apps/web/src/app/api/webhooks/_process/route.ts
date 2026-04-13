import { handleSigningCompletion } from '@contractor-ops/api/services/esign-orchestrator';
import { processResendWebhookDelivery } from '@contractor-ops/api/services/resend-email-intake';
import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
import { webhookIngressReason } from '@contractor-ops/validators';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: per-provider dispatch (Jira/Linear/Resend/e-sign)
async function handler(request: NextRequest) {
  const body = await request.json();
  const { deliveryId, provider } = body as {
    deliveryId: string;
    provider: string;
  };

  if (!(deliveryId && provider)) {
    return NextResponse.json({ error: 'Missing deliveryId or provider' }, { status: 400 });
  }

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
        prisma,
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
        prisma,
        effectiveOrgId,
        delivery.integrationConnectionId ?? '',
        delivery.payloadJson,
      );
    }

    if (provider === 'resend') {
      await processResendWebhookDelivery(prisma, {
        organizationId: effectiveOrgId,
        eventType: delivery.eventType,
        payloadJson: delivery.payloadJson,
      });
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
          console.error(
            `[webhook/_process] Failed to handle signing completion for envelope ${esignResult.envelopeId}:`,
            completionError,
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
