import crypto from 'node:crypto';
import { createLogger } from '@contractor-ops/logger';
import { inpostWebhookPayloadSchema } from '@contractor-ops/validators';
import { mapInPostStatus } from './inpost-status-mapper';
import { isEventDuplicate, processShipmentStatusChange } from './shipment-processing';

const log = createLogger({ service: 'inpost-webhook-handler' });

// ---------------------------------------------------------------------------
// InPost Webhook Handler
//
// Processes incoming ShipX webhook events:
// - Validates payload with Zod
// - Finds shipment by externalId (fallback: trackingNumber)
// - Deduplicates events
// - Creates ShipmentEvent and updates Shipment.currentStatus
// - Auto-advances equipment status
// - Fires workflow task completion check
// ---------------------------------------------------------------------------

import type { DbClient } from '../types';

type PrismaClient = DbClient;

/**
 * Verify an InPost webhook signature using HMAC-SHA256.
 *
 * Fails closed: with no secret configured (empty string) the signature cannot
 * be verified, so this returns false. An empty secret must never validate a
 * request — otherwise any caller could inject events against a misconfigured
 * org. Non-production environments can still match an org via the shipment-id
 * payload fallback in the webhook route; production rejects unsigned /
 * empty-secret webhooks outright.
 */
export function verifyInPostSignature(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): boolean {
  if (!secret) {
    log.warn({}, 'no webhook secret configured — signature verification fails closed');
    return false;
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = headers['x-inpost-signature'] ?? '';

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Process an InPost webhook payload.
 *
 * 1. Validates payload with Zod
 * 2. Finds shipment by externalId or trackingNumber (fallback)
 * 3. Maps ShipX status to ShipmentStatus
 * 4. Deduplicates -- skips if event with same status already exists
 * 5. Processes status change (event, notification, equipment, workflow)
 */
export async function handleInPostWebhook(
  db: PrismaClient,
  organizationId: string,
  payload: unknown,
): Promise<void> {
  // 1. Validate payload
  const parsed = inpostWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    log.warn({ error: parsed.error.flatten() }, 'invalid payload');
    return;
  }

  const data = parsed.data;

  // 2. Find shipment by externalId, fallback to trackingNumber
  const shipment = await findShipment(db, organizationId, data);
  if (!shipment) {
    log.warn(
      {
        organizationId,
        externalId: data.shipment_id,
        trackingNumber: data.tracking_number ?? 'N/A',
      },
      'shipment not found',
    );
    return;
  }

  // 3. Map ShipX status
  const mappedStatus = mapInPostStatus(data.status);
  if (!mappedStatus) return;

  // 4. Deduplicate
  if (await isEventDuplicate(db, shipment.id, mappedStatus)) {
    log.info({ shipmentId: shipment.id, status: mappedStatus }, 'duplicate event skipped');
    return;
  }

  // 5. Update externalId if not set
  if (!shipment.externalId) {
    await db.shipment.update({
      where: { id: shipment.id },
      data: { externalId: String(data.shipment_id) },
    });
  }

  // 6. Process the status change (event, notification, equipment, workflow)
  await processShipmentStatusChange(
    db,
    organizationId,
    { ...shipment, externalId: shipment.externalId ?? String(data.shipment_id) },
    mappedStatus,
    'INPOST',
    `ShipX webhook: ${data.status}`,
  );

  log.info({ shipmentId: shipment.id, rawStatus: data.status, mappedStatus }, 'processed');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findShipment(
  db: PrismaClient,
  organizationId: string,
  data: { shipment_id: string | number; tracking_number?: string },
) {
  let shipment = await db.shipment.findFirst({
    where: {
      organizationId,
      externalId: String(data.shipment_id),
    },
  });

  if (!shipment && data.tracking_number) {
    shipment = await db.shipment.findFirst({
      where: {
        organizationId,
        trackingNumber: data.tracking_number,
      },
    });
  }

  return shipment;
}
