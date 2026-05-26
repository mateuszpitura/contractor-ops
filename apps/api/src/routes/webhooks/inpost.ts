/**
 * InPost ShipX webhook port.
 *
 * Ported 1:1 from apps/web/src/app/api/webhooks/inpost/route.ts:
 *
 *   1. Read raw body (signature verification needs the original bytes).
 *   2. Look up every org with an InPost courier config row.
 *   3. Try each org's webhookSecret against the body via
 *      `verifyInPostSignature` from
 *      `@contractor-ops/api/services/courier/inpost-webhook-handler`.
 *   4. Non-prod fallback: match by `shipment_id` / `tracking_number` in
 *      the payload (F-SEC-06 — production rejects unsigned webhooks
 *      outright; this fallback exists only for dev/staging where
 *      Storecove sandbox webhooks lack signature material).
 *   5. Fire-and-forget `handleInPostWebhook`; respond 200 immediately so
 *      InPost's retry quota isn't burned on slow downstream calls.
 *
 * Lives under the webhook plugin scope so the raw-body content-type
 * parser is in effect.
 */

import {
  handleInPostWebhook,
  verifyInPostSignature,
} from '@contractor-ops/api/services/courier/inpost-webhook-handler';
import { prisma } from '@contractor-ops/db';
import { createWebhookLogger } from '@contractor-ops/logger';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../../env.js';
import { Sentry } from '../../lib/sentry.js';

const log = createWebhookLogger('inpost');

interface CourierConfigJson {
  webhookSecret?: string;
}

function matchOrgBySignature(
  configs: Array<{ organizationId: string; configJson: unknown }>,
  rawBody: string,
  headers: Record<string, string>,
): string | null {
  for (const config of configs) {
    const configJson = config.configJson as CourierConfigJson;
    const secret = configJson.webhookSecret ?? '';
    if (verifyInPostSignature(rawBody, headers, secret)) {
      return config.organizationId;
    }
  }
  return null;
}

async function matchOrgByShipmentPayload(rawBody: string): Promise<string | null> {
  let payload: { shipment_id?: string; tracking_number?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }

  if (payload.shipment_id) {
    const shipment = await prisma.shipment.findFirst({
      where: { externalId: String(payload.shipment_id), carrier: 'InPost' },
      select: { organizationId: true },
    });
    if (shipment) return shipment.organizationId;
  }

  if (payload.tracking_number) {
    const shipment = await prisma.shipment.findFirst({
      where: { trackingNumber: payload.tracking_number, carrier: 'InPost' },
      select: { organizationId: true },
    });
    if (shipment) return shipment.organizationId;
  }

  return null;
}

export function registerInPostWebhookRoute(app: FastifyInstance): void {
  app.post('/webhooks/inpost', async (request, reply) => {
    const rawBody =
      request.body instanceof Buffer
        ? request.body.toString('utf8')
        : typeof request.body === 'string'
          ? request.body
          : '';

    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers[key] = value;
      else if (Array.isArray(value)) headers[key] = value.join(',');
    }

    const configs = await prisma.courierConfig.findMany({
      where: { carrier: 'inpost' },
      select: { organizationId: true, configJson: true },
    });

    if (configs.length === 0) {
      return reply.code(404).send({ error: 'Not configured' });
    }

    const signatureOrgId = matchOrgBySignature(configs, rawBody, headers);

    // F-SEC-06: production rejects unsigned webhooks outright. Non-prod
    // can fall back to a tracking-id payload match for sandbox testing.
    const { NODE_ENV } = loadEnv();
    let matchedOrgId: string | null = signatureOrgId;
    if (!matchedOrgId && NODE_ENV !== 'production') {
      matchedOrgId = await matchOrgByShipmentPayload(rawBody);
      if (matchedOrgId) {
        log.warn(
          { matchedOrgId, env: NODE_ENV },
          'inpost webhook signature mismatch — falling back to shipment-id payload match (non-production only)',
        );
      }
    }

    if (!matchedOrgId) {
      return reply.code(401).send({ error: 'Invalid signature' });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return reply.code(400).send({ error: 'Invalid JSON body' });
    }

    void handleInPostWebhook(
      prisma as unknown as Parameters<typeof handleInPostWebhook>[0],
      matchedOrgId,
      payload,
    ).catch(err => {
      log.error(
        { err, organizationId: matchedOrgId },
        'inpost webhook fire-and-forget processing failed',
      );
      Sentry.captureException(err, {
        tags: { 'webhook.provider': 'inpost' },
        extra: { organizationId: matchedOrgId },
      });
    });

    return reply.code(200).send({ received: true });
  });
}
