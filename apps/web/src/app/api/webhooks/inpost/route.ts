import {
  handleInPostWebhook,
  verifyInPostSignature,
} from '@contractor-ops/api/services/courier/inpost-webhook-handler';
import { prisma } from '@contractor-ops/db';
import { createWebhookLogger } from '@contractor-ops/logger';
import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const log = createWebhookLogger('inpost');

// ---------------------------------------------------------------------------
// POST /api/webhooks/inpost
//
// Dedicated InPost webhook endpoint for ShipX status push events.
// NOT routed through the generic [provider] webhook pipeline (per research).
// ---------------------------------------------------------------------------

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

/**
 * Receive InPost ShipX webhook events and route to handler.
 *
 * Flow:
 * 1. Read raw body for signature verification
 * 2. Find all orgs with InPost courier config
 * 3. Verify signature against each org's webhook secret
 * 4. Match shipment by externalId/trackingNumber to determine org
 * 5. Process event via handleInPostWebhook (fire-and-forget)
 * 6. Return 200 immediately
 */
export async function POST(request: NextRequest) {
  let rawBody: string;

  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Extract headers as a plain Record for verifyInPostSignature
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Find all orgs with InPost courier config
  const configs = await prisma.courierConfig.findMany({
    where: { carrier: 'inpost' },
    select: {
      organizationId: true,
      configJson: true,
    },
  });

  if (configs.length === 0) {
    return NextResponse.json({ error: 'Not configured' }, { status: 404 });
  }

  // Try to verify signature against each org's webhook secret
  const signatureOrgId = matchOrgBySignature(configs, rawBody, headers);

  // SECURITY (F-SEC-06): The shipment-id payload fallback resolves the org by
  // trusting unauthenticated body fields (shipment_id / tracking_number). In
  // production this would let an attacker who learns a tracking number forge
  // status events (e.g. "DELIVERED") for that shipment. Restrict the fallback
  // to non-production environments only — production must reject unsigned
  // webhooks outright.
  let matchedOrgId: string | null = signatureOrgId;
  if (!matchedOrgId && process.env.NODE_ENV !== 'production') {
    matchedOrgId = await matchOrgByShipmentPayload(rawBody);
    if (matchedOrgId) {
      log.warn(
        { matchedOrgId, env: process.env.NODE_ENV },
        'inpost webhook signature mismatch — falling back to shipment-id payload match (non-production only)',
      );
    }
  }

  if (!matchedOrgId) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse JSON body for the handler
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fire-and-forget: process webhook event
  void handleInPostWebhook(
    prisma as unknown as Parameters<typeof handleInPostWebhook>[0],
    matchedOrgId,
    payload,
  ).catch(err => {
    // F-OBS-13 — the original comment claimed errors were logged inside
    // handleInPostWebhook, but the handler does not emit any log.error. A
    // throw inside the fire-and-forget chain was being swallowed entirely.
    log.error(
      { err, organizationId: matchedOrgId },
      'inpost webhook fire-and-forget processing failed',
    );
    Sentry.captureException(err, {
      tags: { 'webhook.provider': 'inpost' },
      extra: { organizationId: matchedOrgId },
    });
  });

  return NextResponse.json({ received: true });
}
