import type { ShipmentStatus } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';

// ---------------------------------------------------------------------------
// DPD Status Mapper
//
// Maps DPD parcel statuses to the app's ShipmentStatus enum values.
// Unknown statuses return null and log a warning (never throw).
// ---------------------------------------------------------------------------

const log = createLogger({ service: 'dpd-status-mapper' });

/**
 * Complete mapping of DPD status strings to ShipmentStatus enum values.
 *
 * DPD uses DEP_ prefixed status codes. Multiple DPD statuses can map
 * to the same ShipmentStatus.
 */
export const DPD_STATUS_MAP: Record<string, ShipmentStatus> = {
  DEP_ACCEPTED: 'CREATED',
  DEP_COLLECTED: 'PICKED_UP',
  DEP_IN_TRANSIT: 'IN_TRANSIT',
  DEP_IN_DELIVERY: 'OUT_FOR_DELIVERY',
  DEP_DELIVERED: 'DELIVERED',
  DEP_RETURNED: 'RETURNED',
  DEP_REFUSED: 'FAILED',
  DEP_LOST: 'FAILED',
  DEP_PICKUP_ARRANGED: 'LABEL_GENERATED',
};

/**
 * Map a raw DPD status string to the app's ShipmentStatus enum value.
 *
 * @param rawStatus - The status string from DPD API or tracking response
 * @returns The mapped ShipmentStatus string, or null if the status is unknown
 */
export function mapDpdStatus(rawStatus: string): ShipmentStatus | null {
  const mapped = DPD_STATUS_MAP[rawStatus];
  if (!mapped) {
    log.warn({ rawStatus }, 'unknown DPD status — skipping');
    return null;
  }
  return mapped;
}

/**
 * Statuses that should trigger user notifications.
 * Intermediate statuses update silently; only terminal/critical events notify.
 */
export const DPD_NOTIFICATION_STATUSES = ['DELIVERED', 'FAILED', 'RETURNED'] as const;
