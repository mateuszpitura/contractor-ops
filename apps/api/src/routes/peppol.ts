/**
 * Peppol poll worker (`POST /peppol/poll`) port.
 *
 * Mirrors apps/web/src/app/api/peppol/poll/route.ts:
 *
 *   1. QStash signature verification via `guardQStashRequest`.
 *   2. Reseed ALS frame from upstream QStash headers (F-OBS-03).
 *   3. Wrap with `withQueueObservability('peppol-poll', …)` (F-ASYNC-17).
 *   4. Body validation (`organizationId` optional — single-org poll vs
 *      sweep-all-active-participants).
 *   5. For each ACTIVE `PeppolParticipant`: locate its
 *      `IntegrationConnection`, fetch credentials, build a
 *      `StorecoveAdapter`, hand to `PeppolOrchestrator.pollAndProcessInbound`.
 *   6. Per-org failure isolates to a `recordPollError` write so one
 *      misconfigured tenant doesn't poison the sweep.
 *   7. Emit `queue:peppol-poll-participants` depth gauge so dashboards
 *      can chart sweep size alongside other queue gauges.
 *
 * Scheduled every 15 minutes per connected organization — used to catch
 * webhooks Storecove failed to deliver.
 *
 * Exempt from CSRF origin guard — QStash signature is the authn.
 */

import {
  recordQueueDepth,
  withQueueObservability,
} from '@contractor-ops/api/services/cron-monitor';
import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import {
  BackpressureRoutes,
  isBackpressureRejected,
  withBackpressure,
} from '@contractor-ops/api/services/qstash-backpressure';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import { createCronLogger, createWebhookLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { guardQStashRequest } from '../lib/qstash-verify.js';
import { Sentry } from '../lib/sentry.js';

const log = createCronLogger('peppol-poll');
const inboundLog = createWebhookLogger('peppol-inbound');
const outboundLog = createWebhookLogger('peppol-outbound');

const peppolPollBodySchema = z.object({
  organizationId: z.string().min(1).optional(),
});

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

async function handlerInner(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    parsedJson = {};
  }

  const parsed = peppolPollBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    return reply.code(400).send({ error: 'Invalid body' });
  }
  const { organizationId } = parsed.data;

  try {
    const participants = organizationId
      ? await prisma.peppolParticipant.findMany({
          where: { organizationId, status: 'ACTIVE' },
        })
      : await prisma.peppolParticipant.findMany({
          where: { status: 'ACTIVE' },
        });

    // F-ASYNC-17 — gauge tagged `queue:peppol-poll-participants` so it's
    // distinct from outbox / webhook depths on the dashboard.
    recordQueueDepth('peppol-poll-participants', participants.length);

    const results: Array<{ organizationId: string; processed: number }> = [];

    for (const participant of participants) {
      const result = await pollParticipant(participant.organizationId);
      if (result) results.push(result);
    }

    return reply.code(200).send({ polled: results.length, results });
  } catch (error) {
    log.error({ err: error }, 'global poll failure');
    return reply.code(500).send({ error: 'Poll failed' });
  }
}

export function registerPeppolPollRoute(app: FastifyInstance): void {
  app.post('/peppol/poll', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() =>
      withQueueObservability('peppol-poll', () => handlerInner(request, reply, guard.rawBody)),
    );
  });
}

// ---------------------------------------------------------------------------
// /peppol/inbound — QStash callback after Storecove webhook ingest.
// Mirrors apps/web/src/app/api/peppol/inbound/route.ts.
// ---------------------------------------------------------------------------

const peppolInboundBodySchema = z.object({
  deliveryId: z.string().min(1),
  organizationId: z.string().min(1),
});

async function inboundHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const parsed = peppolInboundBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const { deliveryId, organizationId } = parsed.data;

  try {
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });

    const connection = await prisma.integrationConnection.findFirst({
      where: { organizationId, provider: 'PEPPOL', status: 'CONNECTED' },
    });
    if (!connection) {
      inboundLog.error({ organizationId }, 'no active Peppol connection');
      return reply.code(200).send({ error: 'No Peppol connection' });
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

    const payload = await adapter.parseWebhookPayload(JSON.stringify(delivery.payloadJson), {});

    const orchestrator = new PeppolOrchestrator(adapter);
    const result = await orchestrator.processInboundInvoice({
      payload,
      organizationId,
    });

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { deliveryStatus: 'PROCESSED', processedAt: new Date() },
    });

    return reply.code(200).send({
      processed: true,
      invoiceId: result?.invoice.id ?? null,
      skipped: result === null,
    });
  } catch (error) {
    inboundLog.error({ err: error, deliveryId }, 'inbound processing failed');

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

    return reply.code(500).send({ error: 'Inbound processing failed' });
  }
}

export function registerPeppolInboundRoute(app: FastifyInstance): void {
  app.post('/peppol/inbound', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    return guard.run(() =>
      withQueueObservability('peppol-inbound', () => inboundHandler(request, reply, guard.rawBody)),
    );
  });
}

// ---------------------------------------------------------------------------
// /peppol/outbound — QStash callback for outbound invoice transmission.
// Mirrors apps/web/src/app/api/peppol/outbound/route.ts including
// F-ASYNC-08 retry classification + F-SCALE-19 backpressure.
// ---------------------------------------------------------------------------

interface ClassifiedError {
  status: number;
  reason: 'permanent' | 'transient';
}

function classifyOutboundError(err: unknown): ClassifiedError {
  if (!(err instanceof Error)) return { status: 500, reason: 'transient' };

  const msg = err.message.toLowerCase();
  const name = err.name;

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

  return { status: 500, reason: 'transient' };
}

const peppolOutboundBodySchema = z.object({
  organizationId: z.string().min(1),
  invoiceId: z.string().min(1),
  receiverParticipantId: z.string().min(1),
});

async function outboundHandlerInner(
  _request: FastifyRequest,
  reply: FastifyReply,
  rawBody: string,
): Promise<FastifyReply> {
  let parsedJson: unknown;
  try {
    parsedJson = rawBody.length > 0 ? JSON.parse(rawBody) : null;
  } catch {
    parsedJson = null;
  }

  const parsed = peppolOutboundBodySchema.safeParse(parsedJson);
  if (!parsed.success) {
    const missing = parsed.error.issues.map(i => i.path.join('.')).filter(Boolean);
    const detail =
      missing.length > 0 ? `Missing or invalid: ${missing.join(', ')}` : 'Invalid body';
    return reply.code(400).send({ error: detail });
  }
  const { organizationId, invoiceId, receiverParticipantId } = parsed.data;

  try {
    const connection = await prisma.integrationConnection.findFirst({
      where: { organizationId, provider: 'PEPPOL', status: 'CONNECTED' },
    });

    if (!connection) {
      outboundLog.error({ organizationId }, 'no active Peppol connection');
      Sentry.captureMessage('peppol outbound: no active connection', {
        level: 'error',
        tags: { 'peppol.outcome': 'no-connection' },
        extra: { organizationId, invoiceId },
      });
      return reply.code(200).send({ error: 'No Peppol connection' });
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

    return reply.code(200).send({ processed: true, transmissionId: transmission.id });
  } catch (error) {
    const classified = classifyOutboundError(error);
    outboundLog.error(
      { err: error, organizationId, invoiceId, classification: classified.reason },
      'outbound processing failed',
    );

    if (classified.reason === 'permanent') {
      Sentry.captureException(error, {
        tags: { 'peppol.outcome': 'permanent-failure' },
        extra: { organizationId, invoiceId, receiverParticipantId },
      });
    }

    return reply.code(classified.status).send({
      error: error instanceof Error ? error.message : 'Outbound processing failed',
      classification: classified.reason,
    });
  }
}

export function registerPeppolOutboundRoute(app: FastifyInstance): void {
  app.post('/peppol/outbound', async (request, reply) => {
    const guard = await guardQStashRequest(request, reply);
    if (!guard) return reply;

    const { key, max } = BackpressureRoutes.PEPPOL_OUTBOUND;
    return guard.run(async () => {
      try {
        return await withBackpressure(key, max, () =>
          withQueueObservability(key, () => outboundHandlerInner(request, reply, guard.rawBody)),
        );
      } catch (err) {
        if (isBackpressureRejected(err)) {
          return reply.code(429).header('Retry-After', String(err.retryAfterSec)).send();
        }
        throw err;
      }
    });
  });
}
