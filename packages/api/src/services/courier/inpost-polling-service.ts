import { createLogger } from '@contractor-ops/logger';
import { InPostClient } from './inpost-client.js';
import { mapInPostStatus } from './inpost-status-mapper.js';
import {
  isEventDuplicate,
  processShipmentStatusChange,
  TERMINAL_STATUSES,
} from './shipment-processing.js';

// ---------------------------------------------------------------------------
// InPost Polling Service
//
// QStash-triggered fallback for catching missed webhook events (D-05).
// Fetches all active InPost shipments and creates missing ShipmentEvents.
// ---------------------------------------------------------------------------

import type { DbClient } from '../types.js';

const log = createLogger({ service: 'inpost-polling-service' });

type PrismaClient = DbClient;

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
  const config = await db.courierConfig.findUnique({
    where: {
      organizationId_carrier: {
        organizationId,
        carrier: 'inpost',
      },
    },
  });

  if (!config) {
    log.warn({ organizationId }, 'no courier config found for org');
    return { checked: 0, updated: 0 };
  }

  const configJson = config.configJson as unknown as CourierConfigJson;

  const client = new InPostClient({
    apiToken: configJson.apiToken,
    shipxOrganizationId: configJson.shipxOrganizationId,
    sandbox: configJson.sandbox,
  });

  const activeShipments = await db.shipment.findMany({
    where: {
      organizationId,
      carrier: 'InPost',
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
      const mappedStatus = mapInPostStatus(statusResult.status);

      if (!mappedStatus || mappedStatus === shipment.currentStatus) continue;
      if (await isEventDuplicate(db, shipment.id, mappedStatus)) continue;

      await processShipmentStatusChange(
        db,
        organizationId,
        shipment,
        mappedStatus,
        'InPost',
        `Polling: ${statusResult.status}`,
      );

      updated++;
    } catch (error) {
      log.error(
        { err: error, shipmentId: shipment.id, externalId: shipment.externalId },
        'error polling shipment',
      );
    }
  }

  log.info({ organizationId, checked, updated }, 'polling complete');

  return { checked, updated };
}
