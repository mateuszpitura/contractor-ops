/**
 * Peppol poll worker (`POST /peppol/poll`).
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

import { isDemoOrg } from '@contractor-ops/api/lib/demo';
import { recordQueueDepth } from '@contractor-ops/api/services/cron-monitor';
import { PeppolOrchestrator } from '@contractor-ops/api/services/peppol-orchestrator';
import { BackpressureRoutes } from '@contractor-ops/api/services/qstash-backpressure';
import { prisma } from '@contractor-ops/db';
import { StorecoveAdapter } from '@contractor-ops/einvoice';
import { getCredentials } from '@contractor-ops/integrations';
import { createCronLogger, createWebhookLogger } from '@contractor-ops/logger';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { defineQStashRoute } from '../lib/qstash-route.js';
import { Sentry } from '../lib/sentry.js';

const log = createCronLogger('peppol-poll');
const inboundLog = createWebhookLogger('peppol-inbound');
const outboundLog = createWebhookLogger('peppol-outbound');

const peppolPollBodySchema = z.preprocess(
  value => (value === null || value === undefined ? {} : value),
  z.object({
    organizationId: z.string().min(1).optional(),
  }),
);

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

async function handlePeppolPoll(
  body: z.infer<typeof peppolPollBodySchema>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { organizationId } = body;

  try {
    const orgFilter = organizationId ? { organizationId } : {};

    const activeParticipants = await prisma.peppolParticipant.findMany({
      where: { ...orgFilter, status: 'ACTIVE' },
      select: { organizationId: true },
    });

    // Sweep every org reachable for Peppol inbound: ACTIVE participants PLUS
    // any CONNECTED Peppol connection that has no ACTIVE participant row.
    // Iterating ACTIVE participants alone would silently skip a tenant whose
    // connection is CONNECTED but whose participant row is missing/inactive,
    // dropping its inbound deliveries. Union the two and warn on the gap so
    // the data drift stays visible.
    const connectedConnections = await prisma.integrationConnection.findMany({
      where: { ...orgFilter, provider: 'PEPPOL', status: 'CONNECTED' },
      select: { organizationId: true },
    });

    const orgIds = new Set<string>();
    for (const participant of activeParticipants) orgIds.add(participant.organizationId);

    const connectedWithoutActiveParticipant: string[] = [];
    for (const connection of connectedConnections) {
      if (!orgIds.has(connection.organizationId)) {
        orgIds.add(connection.organizationId);
        connectedWithoutActiveParticipant.push(connection.organizationId);
      }
    }
    if (connectedWithoutActiveParticipant.length > 0) {
      log.warn(
        {
          organizationIds: connectedWithoutActiveParticipant,
          count: connectedWithoutActiveParticipant.length,
        },
        'peppol poll: CONNECTED Peppol connections with no ACTIVE participant row — included via fallback sweep',
      );
    }

    // F-ASYNC-17 — gauge tagged `queue:peppol-poll-participants` so it's
    // distinct from outbox / webhook depths on the dashboard.
    recordQueueDepth('peppol-poll-participants', orgIds.size);

    const results: Array<{ organizationId: string; processed: number }> = [];

    for (const orgId of orgIds) {
      const result = await pollParticipant(orgId);
      if (result) results.push(result);
    }

    return reply.code(200).send({
      polled: results.length,
      results,
      fallbackSwept: connectedWithoutActiveParticipant.length,
    });
  } catch (error) {
    log.error({ err: error }, 'global poll failure');
    return reply.code(500).send({ error: 'Poll failed' });
  }
}

export function registerPeppolPollRoute(app: FastifyInstance): void {
  defineQStashRoute(app, {
    path: '/peppol/poll',
    observabilityName: 'peppol-poll',
    bodySchema: peppolPollBodySchema,
    handler: async (body, { reply }) => handlePeppolPoll(body, reply),
  });
}

// ---------------------------------------------------------------------------
// /peppol/inbound — QStash callback after Storecove webhook ingest.
// ---------------------------------------------------------------------------

const peppolInboundBodySchema = z.object({
  deliveryId: z.string().min(1),
  organizationId: z.string().min(1),
});

async function handlePeppolInbound(
  body: z.infer<typeof peppolInboundBodySchema>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { deliveryId, organizationId } = body;

  try {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    // Tenant isolation: the deliveryId comes from the (QStash-signed) body,
    // but a forged/replayed signature could carry another org's id. Bind the
    // row to the org from the same payload before doing any work on it.
    if (!delivery || delivery.organizationId !== organizationId) {
      inboundLog.error(
        { deliveryId, organizationId },
        'peppol inbound rejected: delivery missing or belongs to another org',
      );
      return reply.code(404).send({ error: 'Delivery not found' });
    }

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
  defineQStashRoute(app, {
    path: '/peppol/inbound',
    observabilityName: 'peppol-inbound',
    bodySchema: peppolInboundBodySchema,
    handler: async (body, { reply }) => handlePeppolInbound(body, reply),
  });
}

// ---------------------------------------------------------------------------
// /peppol/outbound — QStash callback for outbound invoice transmission.
// Includes F-ASYNC-08 retry classification + F-SCALE-19 backpressure.
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

async function handlePeppolOutbound(
  body: z.infer<typeof peppolOutboundBodySchema>,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { organizationId, invoiceId, receiverParticipantId } = body;

  // Demo read-only — never transmit a demo org's invoice to the real Peppol
  // network. This QStash route is a non-tRPC ingress, so the skip lives here.
  if (isDemoOrg(organizationId)) {
    outboundLog.info({ organizationId, invoiceId }, 'demo org — skipping Peppol outbound');
    return reply.code(200).send({ processed: false, skipped: 'demo' });
  }

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
  const { key, max } = BackpressureRoutes.PEPPOL_OUTBOUND;
  defineQStashRoute(app, {
    path: '/peppol/outbound',
    observabilityName: key,
    bodySchema: peppolOutboundBodySchema,
    backpressure: { key, max },
    handler: async (body, { reply }) => handlePeppolOutbound(body, reply),
  });
}
