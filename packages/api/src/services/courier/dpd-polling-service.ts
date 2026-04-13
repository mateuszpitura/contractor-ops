import { DPDClient } from './dpd-client.js';
import { mapDpdStatus } from './dpd-status-mapper.js';
import { isEventDuplicate, processShipmentStatusChange, TERMINAL_STATUSES } from './shipment-processing.js';

// ---------------------------------------------------------------------------
// DPD Polling Service
//
// QStash-triggered fallback for catching missed DPD status updates.
// ---------------------------------------------------------------------------

import type { DbClient } from '../types.js';

type PrismaClient = DbClient;

interface DpdCourierConfigJson {
  username: string;
  password: string;
  fid: string;
  sandbox: boolean;
}

/**
 * Poll active DPD shipments for status updates.
 *
 * 1. Load courier config for this organization
 * 2. Find all active DPD shipments (not terminal, has externalId)
 * 3. For each, check DPD API for current status
 * 4. If status differs from current, create ShipmentEvent and update
 *
 * @returns Count of checked and updated shipments
 */
export async function pollDpdShipmentStatuses(
  db: PrismaClient,
  organizationId: string,
): Promise<{ checked: number; updated: number }> {
  const config = await db.courierConfig.findUnique({
    where: {
      organizationId_carrier: {
        organizationId,
        carrier: 'dpd',
      },
    },
  });

  if (!config) {
    console.warn(`[dpd-polling] No courier config found for org=${organizationId}`);
    return { checked: 0, updated: 0 };
  }

  const configJson = config.configJson as DpdCourierConfigJson;

  const client = new DPDClient({
    username: configJson.username,
    password: configJson.password,
    fid: configJson.fid,
    sandbox: configJson.sandbox,
  });

  const activeShipments = await db.shipment.findMany({
    where: {
      organizationId,
      carrier: 'DPD',
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
      const mappedStatus = mapDpdStatus(statusResult.status);

      if (!mappedStatus || mappedStatus === shipment.currentStatus) continue;
      if (await isEventDuplicate(db, shipment.id, mappedStatus)) continue;

      await processShipmentStatusChange(
        db,
        organizationId,
        shipment,
        mappedStatus,
        'DPD',
        `Polling: ${statusResult.status}`,
      );

      updated++;
    } catch (error) {
      console.error(
        `[dpd-polling] Error polling shipment ${shipment.id} (ext=${shipment.externalId}):`,
        error,
      );
    }
  }

  console.info(`[dpd-polling] Org ${organizationId}: checked ${checked}, updated ${updated}`);

  return { checked, updated };
}
