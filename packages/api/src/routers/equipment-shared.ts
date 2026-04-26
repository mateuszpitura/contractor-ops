/**
 * Shared constants, helpers, and types for the equipment domain routers.
 * Used by equipment.ts, equipment-shipments.ts, equipment-couriers.ts,
 * and equipment-returns.ts.
 */

// ---------------------------------------------------------------------------
// i18n notification key constants
// ---------------------------------------------------------------------------

export const NOTIFICATION_KEYS = {
  equipment: {
    returnApproved: {
      title: 'notifications.equipment.returnApproved.title',
      body: 'notifications.equipment.returnApproved.body',
    },
    returnRejected: {
      title: 'notifications.equipment.returnRejected.title',
      body: 'notifications.equipment.returnRejected.body',
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// `plain` is now defined once at packages/api/src/lib/plain.ts. We re-export
// here for backward compatibility so existing equipment-* routers can keep
// importing from this module.
export { plain } from '../lib/plain.js';

// ---------------------------------------------------------------------------
// Equipment status transition map (D-05, D-06)
// ---------------------------------------------------------------------------

/**
 * Valid equipment status transitions. Each key maps to the set of
 * statuses it can transition to.
 */
export const EQUIPMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['ASSIGNED', 'IN_TRANSIT', 'RETIRED'],
  ASSIGNED: ['AVAILABLE', 'IN_TRANSIT', 'RETURN_REQUESTED', 'RETIRED'],
  IN_TRANSIT: ['DELIVERED', 'AVAILABLE'],
  DELIVERED: ['ASSIGNED', 'RETURN_REQUESTED', 'AVAILABLE', 'RETIRED'],
  RETURN_REQUESTED: ['RETURN_IN_TRANSIT', 'AVAILABLE'],
  RETURN_IN_TRANSIT: ['RETURNED', 'AVAILABLE'],
  RETURNED: ['AVAILABLE', 'RETIRED'],
  RETIRED: [],
};

/**
 * Maps a (shipment status, direction) pair to the resulting equipment status.
 * Only certain terminal shipment statuses trigger an equipment status change.
 */
export const SHIPMENT_TO_EQUIPMENT_STATUS: Record<
  string,
  Record<string, string | undefined> | undefined
> = {
  DELIVERED: {
    OUTBOUND: 'DELIVERED',
    RETURN: 'RETURNED',
  },
  RETURNED: {
    OUTBOUND: undefined,
    RETURN: 'RETURNED',
  },
};

// ---------------------------------------------------------------------------
// Error constants
// ---------------------------------------------------------------------------

export const EQUIPMENT_NOT_FOUND = 'EQUIPMENT_NOT_FOUND';
export const EQUIPMENT_NOT_AVAILABLE = 'EQUIPMENT_NOT_AVAILABLE';
export const EQUIPMENT_NOT_ASSIGNED = 'EQUIPMENT_NOT_ASSIGNED';
export const EQUIPMENT_CURRENTLY_ASSIGNED = 'EQUIPMENT_CURRENTLY_ASSIGNED';
export const CONTRACTOR_NOT_FOUND = 'CONTRACTOR_NOT_FOUND';
export const SHIPMENT_NOT_FOUND = 'SHIPMENT_NOT_FOUND';
export const SHIPMENT_CANNOT_DELETE = 'SHIPMENT_CANNOT_DELETE';
