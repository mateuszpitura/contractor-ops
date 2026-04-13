import crypto from 'node:crypto';
import { inpostWebhookPayloadSchema } from '@contractor-ops/validators';
import { isEventDuplicate, processShipmentStatusChange } from './shipment-processing.js';
import { mapInPostStatus } from './inpost-status-mapper.js';

// ---------------------------------------------------------------------------
// InPost Webhook Handler
//
// Processes incoming ShipX webhook events:
// - Validates payload with Zod
// - Finds shipment by externalId (fallback: trackingNumber)
// - Deduplicates events (pitfall 3)
// - Creates ShipmentEvent and updates Shipment.currentStatus
// - Auto-advances equipment status
// - Fires workflow task completion check
// ---------------------------------------------------------------------------

import type { DbClient } from '../types.js';

type PrismaClient = DbClient;

/**
 * Verify an InPost webhook signature using HMAC-SHA256.
 *
 * If no secret is configured (empty string), logs a warning and returns true
 * for graceful degradation (per research open question 1).
 */
export function verifyInPostSignature(
  rawBody: string,
  headers: Record<string, string>,
  secret: string,
): boolean {
  if (!secret) {
    console.warn('[inpost-webhook] No webhook secret configured — skipping signature verification');
    return true;
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
    console.warn('[inpost-webhook] Invalid payload:', parsed.error.flatten());
    return;
  }

  const data = parsed.data;

  // 2. Find shipment by externalId, fallback to trackingNumber
  const shipment = await findShipment(db, organizationId, data);
  if (!shipment) {
    console.warn(
      `[inpost-webhook] Shipment not found for org=${organizationId}, externalId=${data.shipment_id}, tracking=${data.tracking_number ?? 'N/A'}`,
    );
    return;
  }

  // 3. Map ShipX status
  const mappedStatus = mapInPostStatus(data.status);
  if (!mappedStatus) return;

  // 4. Deduplicate
  if (await isEventDuplicate(db, shipment.id, mappedStatus)) {
    console.info(
      `[inpost-webhook] Duplicate event skipped: shipment=${shipment.id}, status=${mappedStatus}`,
    );
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

  console.info(
    `[inpost-webhook] Processed: shipment=${shipment.id}, status=${data.status} -> ${mappedStatus}`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findShipment(
  db: PrismaClient,
  organizationId: string,
  data: { shipment_id: number; tracking_number?: string },
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
