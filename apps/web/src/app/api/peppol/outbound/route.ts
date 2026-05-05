import { withQueueObservability } from '@contractor-ops/api/services/cron-monitor';
import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import {
  buildContextFromHeaders,
  createWebhookLogger,
  runWithRequestContext,
} from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const log = createWebhookLogger('peppol-outbound');

// ---------------------------------------------------------------------------
// Error classification — F-ASYNC-08
// ---------------------------------------------------------------------------
//
// QStash retries non-2xx responses. Pre-fix this route returned 200 on every
// caught error, so transient Storecove outages permanently dropped
// transmissions ("the transmission record is already marked FAILED in the
// orchestrator" was the comment, but the user had no operator-visible retry
// path). Now we classify:
//
//   - Permanent (validation, auth, missing connection): 200 + Sentry capture.
//     QStash stops retrying; the row is FAILED in the orchestrator and ops
//     see the Sentry event.
//   - Transient (Storecove 5xx, network, undefined): 5xx so QStash retries
//     per its configured policy.

interface ClassifiedError {
  status: number;
  reason: 'permanent' | 'transient';
}

function classifyOutboundError(err: unknown): ClassifiedError {
  if (!(err instanceof Error)) return { status: 500, reason: 'transient' };

  const msg = err.message.toLowerCase();
  const name = err.name;

  // Auth / credential / participant-not-found / validation are permanent.
  // Re-running the same submission won't recover; ops must reconnect or fix
  // the participant record.
  if (
    name === 'NotFoundError' ||
    msg.includes('not found') ||
    msg.includes('invalid api key') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('validation') ||
    msg.includes('invalid xml') ||
    msg.includes('invalid participant') ||
    /\b40[0134]\b/.test(msg)
  ) {
    return { status: 200, reason: 'permanent' };
  }

  // Default: assume transient (5xx, ETIMEDOUT, ECONNRESET, undefined).
  return { status: 500, reason: 'transient' };
}

const peppolOutboundBodySchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  receiverParticipantId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// POST /api/peppol/outbound
// ---------------------------------------------------------------------------

/**
 * QStash callback endpoint for outbound Peppol invoice transmission.
 *
 * Called when an invoice is queued for Peppol delivery. Decrypts ASP
 * credentials, generates PINT-AE XML, and transmits via Storecove.
 *
 * Returns 200 even on business errors (don't trigger QStash retry for
 * validation failures — only infra errors should retry).
 */
async function handler(request: NextRequest) {
  // F-OBS-03: reseed ALS frame from upstream QStash forward headers.
  // S3-5 · F-ASYNC-17: emit per-tick duration to `job.duration` histogram.
  // S3-4 · F-SCALE-19: stay inside Storecove's per-account rate limit by
  // capping fleet-wide concurrent transmissions.
  const traceCtx = buildContextFromHeaders(request.headers);
  const { key, max } = BackpressureRoutes.PEPPOL_OUTBOUND;
  return runWithRequestContext(traceCtx, async () => {
    try {
      return await withBackpressure(key, max, () =>
        withQueueObservability(key, () => handlerInner(request)),
      );
    } catch (err) {
      if (isBackpressureRejected(err)) {
        return new NextResponse(null, {
          status: 429,
          headers: { 'Retry-After': String(err.retryAfterSec) },
        });
      }
      throw err;
    }
  });
}

async function handlerInner(request: NextRequest) {
  const rawBody = await request.json().catch(() => null);
  const parsed = peppolOutboundBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return NextResponse.json({ error: detail }, { status: 400 });
  }
  const { organizationId, invoiceId, receiverParticipantId } = parsed.data;

  try {
    // Load connection and decrypt credentials
    const connection = await prisma.integrationConnection.findFirst({
      where: {
        organizationId,
        provider: 'PEPPOL',
        status: 'CONNECTED',
      },
    });

    if (!connection) {
      // Permanent: re-running won't help. 200 stops QStash retry.
      log.error({ organizationId }, 'no active Peppol connection');
      Sentry.captureMessage('peppol outbound: no active connection', {
        level: 'error',
        tags: { 'peppol.outcome': 'no-connection' },
        extra: { organizationId, invoiceId },
      });
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
    });

    const orchestrator = new PeppolOrchestrator(adapter);
    const transmission = await orchestrator.submitOutboundInvoice({
      organizationId,
      invoiceId,
      receiverParticipantId,
    });

    return NextResponse.json({ processed: true, transmissionId: transmission.id });
  } catch (error) {
    const classified = classifyOutboundError(error);
    log.error(
      { err: error, organizationId, invoiceId, classification: classified.reason },
      'outbound processing failed',
    );

    if (classified.reason === 'permanent') {
      // Permanent failure: QStash stops, but ops need visibility. The
      // transmission row is already FAILED in the orchestrator.
      Sentry.captureException(error, {
        tags: { 'peppol.outcome': 'permanent-failure' },
        extra: { organizationId, invoiceId, receiverParticipantId },
      });
    }
    // Transient failures are visible via Render logs + the QStash retry
    // metrics; we don't double-capture them in Sentry to avoid quota burn.

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Outbound processing failed',
        classification: classified.reason,
      },
      { status: classified.status },
    );
  }
}

export const POST = verifySignatureAppRouter(handler);
