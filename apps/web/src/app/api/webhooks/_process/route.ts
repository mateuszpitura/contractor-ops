import { handleSigningCompletion } from '@contractor-ops/api/services/esign-orchestrator';
import { prisma } from '@contractor-ops/db';
import { registerAllAdapters } from '@contractor-ops/integrations/adapters/register-all';
import { getAdapter } from '@contractor-ops/integrations/registry';
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
 * 3. Dispatch to adapter.handleWebhook
 * 4. Update delivery status (PROCESSED or FAILED)
 */
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

  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  try {
    const webhookResult = await adapter.handleWebhook(
      delivery.payloadJson,
      delivery.organizationId,
      delivery.integrationConnectionId ?? '',
    );

    // For Jira provider, dispatch to processJiraWebhook from @contractor-ops/api.
    // Done here in apps/web to avoid circular dependency between packages/integrations and packages/api.
    // JiraAdapter.handleWebhook is a no-op — actual processing dispatched here.
    if (provider === 'jira') {
      const { processJiraWebhook } = await import(
        '@contractor-ops/api/services/jira-webhook-handler'
      );
      await processJiraWebhook(
        prisma,
        delivery.organizationId,
        delivery.integrationConnectionId ?? '',
        delivery.payloadJson,
      );
    }

    // For Linear provider, dispatch to processLinearWebhook from @contractor-ops/api.
    // Done here in apps/web to avoid circular dependency between packages/integrations and packages/api.
    // LinearAdapter.handleWebhook is a no-op — actual processing dispatched here.
    if (provider === 'linear') {
      const { processLinearWebhook } = await import(
        '@contractor-ops/api/services/linear-webhook-handler'
      );
      await processLinearWebhook(
        prisma,
        delivery.organizationId,
        delivery.integrationConnectionId ?? '',
        delivery.payloadJson,
      );
    }

    // For e-sign providers, check if signing was completed and trigger
    // signed PDF download + R2 storage via the orchestrator
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
        errorMessage: error instanceof Error ? error.message : 'Processing failed',
      },
    });

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

// Wrap with QStash signature verification (per Research Pitfall 6)
// Uses QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY env vars
export const POST = verifySignatureAppRouter(handler);
