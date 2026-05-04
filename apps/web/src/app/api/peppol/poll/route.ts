import {
  recordQueueDepth,
  withQueueObservability,
} from '@contractor-ops/api/services/cron-monitor';
import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import {
  buildContextFromHeaders,
  createCronLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createCronLogger('peppol-poll');

const peppolPollBodySchema = z.object({
  organizationId: z.string().min(1).optional(),
});

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
    log.error({ err: error, organizationId }, 'poll failed for org');

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
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  // S3-5 · F-ASYNC-17: emit per-tick duration to `job.duration` histogram.
  const traceCtx = buildContextFromHeaders(request.headers);
  return runWithRequestContext(traceCtx, () =>
    withQueueObservability('peppol-poll', () => handlerInner(request)),
  );
}

async function handlerInner(request: NextRequest) {
  const rawBody = await request.json().catch(() => ({}));
  const parsed = peppolPollBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { organizationId } = parsed.data;

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

    // S3-5 · F-ASYNC-17: report the participant queue depth so dashboards
    // can chart "how many orgs do we sweep per tick" alongside other queue
    // gauges. Tag is `queue:peppol-poll-participants` so it's distinct
    // from outbox / webhook gauges.
    recordQueueDepth('peppol-poll-participants', participants.length);

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
    log.error({ err: error }, 'global poll failure');
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
