import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import {
  buildContextFromHeaders,
  createWebhookLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
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
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  // S3-5 · F-ASYNC-17: emit per-tick duration to `job.duration` histogram.
  const traceCtx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(traceCtx, () =>
    withQueueObservability('peppol-inbound', () => handlerInner(request)),
  );
}

async function handlerInner(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = peppolInboundBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return NextResponse.json({ error: detail }, { status: 400 });
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
