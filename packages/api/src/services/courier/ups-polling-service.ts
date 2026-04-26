import {
  isEventDuplicate,
  processShipmentStatusChange,
  TERMINAL_STATUSES,
} from './shipment-processing.js';
import { UPSClient } from './ups-client.js';
import { mapUpsStatus } from './ups-status-mapper.js';

// ---------------------------------------------------------------------------
// UPS Polling Service
//
// QStash-triggered fallback for catching missed UPS status updates.
// ---------------------------------------------------------------------------

import type { DbClient } from '../types.js';

type PrismaClient = DbClient;

interface UpsCourierConfigJson {
  clientId: string;
  clientSecret: string;
  accountNumber: string;
  sandbox: boolean;
}

/**
 * Poll active UPS shipments for status updates.
 *
 * 1. Load courier config for this organization
 * 2. Find all active UPS shipments (not terminal, has externalId)
 * 3. For each, check UPS Tracking API for current status
 * 4. If status differs from current, create ShipmentEvent and update
 *
 * @returns Count of checked and updated shipments
 */
export async function pollUpsShipmentStatuses(
  db: PrismaClient,
  organizationId: string,
): Promise<{ checked: number; updated: number }> {
  const config = await db.courierConfig.findUnique({
    where: {
      organizationId_carrier: {
        organizationId,
        carrier: 'ups',
      },
    },
  });

  if (!config) {
    console.warn(`[ups-polling] No courier config found for org=${organizationId}`);
    return { checked: 0, updated: 0 };
  }

  const configJson = config.configJson as unknown as UpsCourierConfigJson;

  const client = new UPSClient({
    clientId: configJson.clientId,
    clientSecret: configJson.clientSecret,
    accountNumber: configJson.accountNumber,
    sandbox: configJson.sandbox,
  });

  const activeShipments = await db.shipment.findMany({
    where: {
      organizationId,
      carrier: 'UPS',
      currentStatus: { notIn: TERMINAL_STATUSES },
      externalId: { not: null },
    },
    take: 50,
  });

  let checked = 0;
  let updated = 0;

  for (const shipment of activeShipments) {
    checked++;

    try {
      if (!shipment.externalId) continue;
      const statusResult = await client.getStatus(shipment.externalId);
      const mappedStatus = mapUpsStatus(statusResult.status);

      if (!mappedStatus || mappedStatus === shipment.currentStatus) continue;
      if (await isEventDuplicate(db, shipment.id, mappedStatus)) continue;

      await processShipmentStatusChange(
        db,
        organizationId,
        shipment,
        mappedStatus,
        'UPS',
        `Polling: ${statusResult.status}`,
      );

      updated++;
    } catch (error) {
      console.error(
        `[ups-polling] Error polling shipment ${shipment.id} (ext=${shipment.externalId}):`,
        error,
      );
    }
  }

  console.info(`[ups-polling] Org ${organizationId}: checked ${checked}, updated ${updated}`);

  return { checked, updated };
}
