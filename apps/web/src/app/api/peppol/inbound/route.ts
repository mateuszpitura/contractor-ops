import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import { createWebhookLogger } from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createWebhookLogger('peppol-inbound');

const peppolInboundBodySchema = z.object({
  deliveryId: z.string().min(1),
  organizationId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/peppol/inbound
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for inbound Peppol invoice processing.
 *
 * Called after a Storecove webhook is received and queued. Loads the
 * webhook delivery, parses the XML, and creates an Invoice record.
 */
async function handler(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = peppolInboundBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { deliveryId, organizationId } = parsed.data;

  try {
    // Load webhook delivery
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });

    // Load connection and decrypt credentials
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId,
        provider: 'PEPPOL',
        status: 'CONNECTED',
      },
    });

    if (!connection) {
      log.error({ organizationId }, 'no active Peppol connection');
      return NextResponse.json({ error: 'No Peppol connection' });
    }

    const credentials = await getCredentials(connection.credentialsRef, 'peppol');
    const config = (connection.configJson as Record<string, unknown>) ?? {};
    const environment = config.environment as string;

    const adapter = new StorecoveAdapter({
      apiKey: credentials.accessToken,
      baseUrl:
        environment === 'production'
          ? 'https://api.storecove.com/api/v2'
          : 'https://api-sandbox.storecove.com/api/v2',
      webhookSecret: (config.webhookSecret as string) ?? undefined,
    });

    // Parse webhook payload via adapter
    const payload = await adapter.parseWebhookPayload(JSON.stringify(delivery.payloadJson), {});

    const orchestrator = new PeppolOrchestrator(adapter);
    const result = await orchestrator.processInboundInvoice({
      payload,
      organizationId,
    });

    // Update delivery status
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        deliveryStatus: 'PROCESSED',
        processedAt: new Date(),
      },
    });

    return NextResponse.json({
      processed: true,
      invoiceId: result?.invoice.id ?? null,
      skipped: result === null,
    });
  } catch (error) {
    log.error({ err: error, deliveryId }, 'inbound processing failed');

    // Mark delivery as failed
    await prisma.webhookDelivery
      .update({
        where: { id: deliveryId },
        data: {
          deliveryStatus: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Inbound processing failed',
        },
      })
      .catch(() => {
        /* ignored */
      });

    return NextResponse.json({ error: 'Inbound processing failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
