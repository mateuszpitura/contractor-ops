import { checkShipmentTaskCompletion } from "../equipment-workflow.js";
import { InPostClient } from "./inpost-client.js";
import { mapInPostStatus, NOTIFICATION_STATUSES } from "./inpost-status-mapper.js";
import { dispatchShipmentNotification } from "./shipment-notification.js";

// ---------------------------------------------------------------------------
// InPost Polling Service
//
// QStash-triggered fallback for catching missed webhook events (D-05).
// Fetches all active InPost shipments and creates missing ShipmentEvents.
// ---------------------------------------------------------------------------

import type { DbClient } from "../types.js";

type PrismaClient = DbClient;

/** Terminal statuses — no need to poll these shipments. */
const TERMINAL_STATUSES = ["DELIVERED", "FAILED", "RETURNED"];

/**
 * Maps (shipment status, direction) to equipment status.
 * Duplicated from equipment.ts to avoid circular imports.
 */
const SHIPMENT_TO_EQUIPMENT_STATUS: Record<string, Record<string, string | undefined> | undefined> =
  {
    DELIVERED: { OUTBOUND: "DELIVERED", RETURN: "RETURNED" },
    RETURNED: { OUTBOUND: undefined, RETURN: "RETURNED" },
  };

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

interface CourierConfigJson {
  apiToken: string;
  shipxOrganizationId: string;
  sandbox: boolean;
}

/**
 * Poll active InPost shipments for status updates.
 *
 * 1. Load courier config for this organization
 * 2. Find all active InPost shipments (not terminal, has externalId)
 * 3. For each, check ShipX API for current status
 * 4. If status differs from current, create ShipmentEvent and update
 *
 * @returns Count of checked and updated shipments
 */
export async function pollInPostShipmentStatuses(
  db: PrismaClient,
  organizationId: string,
): Promise<{ checked: number; updated: number }> {
  // 1. Load courier config
  const config = await db.courierConfig.findUnique({
    where: {
      organizationId_carrier: {
        organizationId,
        carrier: "inpost",
      },
    },
  });

  if (!config) {
    console.warn(`[inpost-polling] No courier config found for org=${organizationId}`);
    return { checked: 0, updated: 0 };
  }

  const configJson = config.configJson as CourierConfigJson;

  // 2. Create InPost client
  const client = new InPostClient({
    apiToken: configJson.apiToken,
    shipxOrganizationId: configJson.shipxOrganizationId,
    sandbox: configJson.sandbox,
  });

  // 3. Find active InPost shipments
  const activeShipments = await db.shipment.findMany({
    where: {
      organizationId,
      carrier: "InPost",
      currentStatus: {
        notIn: TERMINAL_STATUSES,
      },
      externalId: { not: null },
    },
    take: 50, // Batch size limit
  });

  let checked = 0;
  let updated = 0;

  // 4. Check each shipment
  for (const shipment of activeShipments) {
    checked++;

    try {
      const statusResult = await client.getStatus(shipment.externalId!);
      const mappedStatus = mapInPostStatus(statusResult.status);

      if (!mappedStatus || mappedStatus === shipment.currentStatus) {
        continue;
      }

      // Deduplicate
      const existingEvent = await db.shipmentEvent.findFirst({
        where: {
          shipmentId: shipment.id,
          status: mappedStatus,
        },
      });

      if (existingEvent) {
        continue;
      }

      // Create event
      await db.shipmentEvent.create({
        data: {
          organizationId,
          shipmentId: shipment.id,
          status: mappedStatus,
          notes: `Polling: ${statusResult.status}`,
        },
      });

      // Update shipment
      await db.shipment.update({
        where: { id: shipment.id },
        data: { currentStatus: mappedStatus },
      });

      // Dispatch notification for terminal shipment statuses
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
          "InPost",
        );
      }

      // Fire-and-forget: check workflow task auto-completion (per D-01/D-02)
      void checkShipmentTaskCompletion(db, organizationId, {
        id: shipment.id,
        workflowTaskRunId: shipment.workflowTaskRunId,
        direction: shipment.direction as "OUTBOUND" | "RETURN",
        currentStatus: mappedStatus,
      }).catch(console.error);

      // Auto-advance equipment status
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

      updated++;
    } catch (error) {
      console.error(
        `[inpost-polling] Error polling shipment ${shipment.id} (ext=${shipment.externalId}):`,
        error,
      );
    }
  }

  console.info(`[inpost-polling] Org ${organizationId}: checked ${checked}, updated ${updated}`);

  return { checked, updated };
}
