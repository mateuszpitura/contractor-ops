import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// POST /api/peppol/poll
// ---------------------------------------------------------------------------

async function pollParticipant(
  organizationId: string,
): Promise<{ organizationId: string; processed: number } | null> {
  try {
    const connection = await prisma.integrationConnection.findFirst({
      where: { organizationId, provider: 'PEPPOL', status: 'CONNECTED' },
    });

    if (!connection) return null;

    const credentials = await getCredentials(connection.credentialsRef, 'peppol');
    const config = (connection.configJson as Record<string, unknown>) ?? {};
    const environment = config.environment as string;

    const adapter = new StorecoveAdapter({
      apiKey: credentials.accessToken,
      baseUrl:
        environment === 'production'
          ? 'https://api.storecove.com/api/v2'
          : 'https://api-sandbox.storecove.com/api/v2',
    });

    const orchestrator = new PeppolOrchestrator(adapter);
    const processed = await orchestrator.pollAndProcessInbound(organizationId);

    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date(), lastSuccessAt: new Date() },
    });

    return { organizationId, processed };
  } catch (error) {
    console.error(`[peppol/poll] Failed for org ${organizationId}:`, error);

    await recordPollError(organizationId, error);
    return null;
  }
}

async function recordPollError(organizationId: string, error: unknown): Promise<void> {
  const connection = await prisma.integrationConnection.findFirst({
    where: { organizationId, provider: 'PEPPOL' },
  });

  if (connection) {
    await prisma.integrationConnection
      .update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastErrorAt: new Date(),
          lastErrorMessage: error instanceof Error ? error.message : 'Poll failed',
        },
      })
      .catch(() => {
        /* ignored */
      });
  }
}

/**
 * QStash CRON endpoint for polling inbound Peppol invoices.
 *
 * Scheduled every 15 minutes per connected organization.
 * Catches missed webhooks by polling the Storecove API directly.
 */
async function handler(request: NextRequest) {
  const body = await request.json();
  const { organizationId } = body as { organizationId?: string };

  try {
    // If a specific org is provided, poll just that one.
    // Otherwise, poll all active participants.
    const participants = organizationId
      ? await prisma.peppolParticipant.findMany({
          where: { organizationId, status: 'ACTIVE' },
        })
      : await prisma.peppolParticipant.findMany({
          where: { status: 'ACTIVE' },
        });

    const results: Array<{
      organizationId: string;
      processed: number;
    }> = [];

    for (const participant of participants) {
      const result = await pollParticipant(participant.organizationId);
      if (result) {
        results.push(result);
      }
    }

    return NextResponse.json({
      polled: results.length,
      results,
    });
  } catch (error) {
    console.error('[peppol/poll] Global poll failure:', error);
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
