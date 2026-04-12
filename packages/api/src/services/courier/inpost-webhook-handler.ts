import { inpostWebhookPayloadSchema } from "@contractor-ops/validators";
import crypto from "crypto";
import { checkShipmentTaskCompletion } from "../equipment-workflow.js";
import { mapInPostStatus, NOTIFICATION_STATUSES } from "./inpost-status-mapper.js";
import { dispatchShipmentNotification } from "./shipment-notification.js";

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

import type { DbClient } from "../types.js";

type PrismaClient = DbClient;

/**
 * Maps (shipment status, direction) to equipment status.
 * Duplicated from equipment.ts to avoid circular imports.
 */
const SHIPMENT_TO_EQUIPMENT_STATUS: Record<string, Record<string, string | undefined> | undefined> =
  {
    DELIVERED: { OUTBOUND: "DELIVERED", RETURN: "RETURNED" },
    RETURNED: { OUTBOUND: undefined, RETURN: "RETURNED" },
  };

/**
 * Valid equipment status transitions (subset relevant to shipment auto-advancement).
 */
const EQUIPMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ["ASSIGNED", "IN_TRANSIT", "RETIRED"],
  ASSIGNED: ["AVAILABLE", "IN_TRANSIT", "RETURN_REQUESTED", "RETIRED"],
  IN_TRANSIT: ["DELIVERED", "AVAILABLE"],
  DELIVERED: ["ASSIGNED", "RETURN_REQUESTED", "AVAILABLE", "RETIRED"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "AVAILABLE"],
  RETURN_IN_TRANSIT: ["RETURNED", "AVAILABLE"],
  RETURNED: ["AVAILABLE", "RETIRED"],
  RETIRED: [],
};

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
    console.warn("[inpost-webhook] No webhook secret configured — skipping signature verification");
    return true;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const received = headers["x-inpost-signature"] ?? "";

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
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
 * 4. Deduplicates — skips if event with same status already exists
 * 5. Creates ShipmentEvent, updates Shipment.currentStatus
 * 6. Auto-advances equipment status
 */
export async function handleInPostWebhook(
  db: PrismaClient,
  organizationId: string,
  payload: unknown,
): Promise<void> {
  // 1. Validate payload
  const parsed = inpostWebhookPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.warn("[inpost-webhook] Invalid payload:", parsed.error.flatten());
    return;
  }

  const data = parsed.data;

  // 2. Find shipment by externalId
  let shipment = await db.shipment.findFirst({
    where: {
      organizationId,
      externalId: String(data.shipment_id),
    },
  });

  // Fallback: try trackingNumber
  if (!shipment && data.tracking_number) {
    shipment = await db.shipment.findFirst({
      where: {
        organizationId,
        trackingNumber: data.tracking_number,
      },
    });
  }

  if (!shipment) {
    console.warn(
      `[inpost-webhook] Shipment not found for org=${organizationId}, externalId=${data.shipment_id}, tracking=${data.tracking_number ?? "N/A"}`,
    );
    return;
  }

  // 3. Map ShipX status
  const mappedStatus = mapInPostStatus(data.status);
  if (!mappedStatus) {
    return; // mapInPostStatus already logs warning
  }

  // 4. Deduplicate — check if event with same status already exists
  const existingEvent = await db.shipmentEvent.findFirst({
    where: {
      shipmentId: shipment.id,
      status: mappedStatus,
    },
  });

  if (existingEvent) {
    console.info(
      `[inpost-webhook] Duplicate event skipped: shipment=${shipment.id}, status=${mappedStatus}`,
    );
    return;
  }

  // 5. Create ShipmentEvent
  await db.shipmentEvent.create({
    data: {
      organizationId,
      shipmentId: shipment.id,
      status: mappedStatus,
      notes: `ShipX webhook: ${data.status}`,
    },
  });

  // 6. Update Shipment.currentStatus and externalId if not set
  await db.shipment.update({
    where: { id: shipment.id },
    data: {
      currentStatus: mappedStatus,
      ...(shipment.externalId ? {} : { externalId: String(data.shipment_id) }),
    },
  });

  // 6a. Dispatch notification for terminal shipment statuses
  if ((NOTIFICATION_STATUSES as readonly string[]).includes(mappedStatus)) {
    void dispatchShipmentNotification(
      db,
      organizationId,
      {
        id: shipment.id,
        trackingNumber: shipment.trackingNumber,
        currentStatus: shipment.currentStatus,
      },
      mappedStatus,
      "INPOST",
    );
  }

  // 6b. Fire-and-forget: check workflow task auto-completion (per D-01/D-02)
  void checkShipmentTaskCompletion(db, organizationId, {
    id: shipment.id,
    workflowTaskRunId: shipment.workflowTaskRunId,
    direction: shipment.direction as "OUTBOUND" | "RETURN",
    currentStatus: mappedStatus,
  }).catch(console.error);

  // 7. Auto-advance equipment status
  const directionMap = SHIPMENT_TO_EQUIPMENT_STATUS[mappedStatus];
  const newEquipmentStatus = directionMap?.[shipment.direction];

  if (newEquipmentStatus) {
    const equipment = await db.equipment.findUnique({
      where: { id: shipment.equipmentId },
      select: { id: true, status: true },
    });

    if (equipment) {
      const allowed = EQUIPMENT_STATUS_TRANSITIONS[equipment.status] ?? [];
      if (allowed.includes(newEquipmentStatus)) {
        await db.equipment.update({
          where: { id: shipment.equipmentId },
          data: { status: newEquipmentStatus },
        });
      }
    }
  }

  console.info(
    `[inpost-webhook] Processed: shipment=${shipment.id}, status=${data.status} -> ${mappedStatus}`,
  );
}
