import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { checkShipmentTaskCompletion } from '../equipment-workflow';
import type { DbClient } from '../types';
import { NOTIFICATION_STATUSES } from './inpost-status-mapper';
import { dispatchShipmentNotification } from './shipment-notification';

const log = createLogger({ service: 'shipment-processing' });

// ---------------------------------------------------------------------------
// Shared Shipment Processing
//
// Extracted from dpd-polling-service, inpost-polling-service,
// ups-polling-service, and inpost-webhook-handler to eliminate duplicated
// equipment status maps and shipment update logic.
// ---------------------------------------------------------------------------

type PrismaClient = DbClient;

/**
 * Terminal statuses -- no need to poll these shipments.
 * Cast to the Prisma enum array type so the polling services can use this
 * directly inside `currentStatus: { notIn: TERMINAL_STATUSES }` filters.
 */
export const TERMINAL_STATUSES = ['DELIVERED', 'FAILED', 'RETURNED'] as unknown as NonNullable<
  Extract<Prisma.ShipmentWhereInput['currentStatus'], { notIn?: unknown }>['notIn']
>;

/**
 * Maps (shipment status, direction) to equipment status.
 * Single source of truth for all courier services.
 */
export const SHIPMENT_TO_EQUIPMENT_STATUS: Record<
  string,
  Record<string, string | undefined> | undefined
> = {
  DELIVERED: { OUTBOUND: 'DELIVERED', RETURN: 'RETURNED' },
  RETURNED: { OUTBOUND: undefined, RETURN: 'RETURNED' },
};

/**
 * Valid equipment status transitions (subset relevant to shipment auto-advancement).
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

// ---------------------------------------------------------------------------
// Shared shipment update pipeline
// ---------------------------------------------------------------------------

interface ShipmentRecord {
  id: string;
  trackingNumber: string | null;
  currentStatus: string;
  direction: string;
  equipmentId: string;
  externalId: string | null;
  workflowTaskRunId: string | null;
}

/**
 * Processes a shipment status change: creates event, updates shipment,
 * dispatches notification, checks workflow completion, and auto-advances
 * equipment status.
 *
 * Used by all polling services and the webhook handler to avoid duplicating
 * the post-status-change side-effect chain.
 */
export async function processShipmentStatusChange(
  db: PrismaClient,
  organizationId: string,
  shipment: ShipmentRecord,
  mappedStatus: string,
  carrierName: string,
  eventNotes: string,
): Promise<void> {
  // 1. Create shipment event
  await db.shipmentEvent.create({
    data: {
      organizationId,
      shipmentId: shipment.id,
      status: mappedStatus as Prisma.ShipmentEventCreateInput['status'],
      notes: eventNotes,
    },
  });

  // 2. Update shipment current status
  await db.shipment.update({
    where: { id: shipment.id },
    data: { currentStatus: mappedStatus as Prisma.ShipmentUpdateInput['currentStatus'] },
  });

  // 3. Dispatch notification for notable statuses
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
      carrierName,
    );
  }

  // 4. Fire-and-forget: check workflow task auto-completion (per D-01/D-02)
  void checkShipmentTaskCompletion(db, organizationId, {
    id: shipment.id,
    workflowTaskRunId: shipment.workflowTaskRunId,
    direction: shipment.direction as 'OUTBOUND' | 'RETURN',
    currentStatus: mappedStatus,
  }).catch(err => {
    log.error({ err, shipmentId: shipment.id }, 'checkShipmentTaskCompletion failed');
  });

  // 5. Auto-advance equipment status
  await tryAdvanceEquipmentStatus(db, shipment.equipmentId, mappedStatus, shipment.direction);
}

/**
 * Attempts to advance equipment status based on shipment status change.
 * Only transitions if the target status is in the allowed transition list.
 */
async function tryAdvanceEquipmentStatus(
  db: PrismaClient,
  equipmentId: string,
  shipmentStatus: string,
  direction: string,
): Promise<void> {
  const directionMap = SHIPMENT_TO_EQUIPMENT_STATUS[shipmentStatus];
  const newEquipmentStatus = directionMap?.[direction];

  if (!newEquipmentStatus) return;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, status: true },
  });

  if (!equipment) return;

  const allowed = EQUIPMENT_STATUS_TRANSITIONS[equipment.status] ?? [];
  if (allowed.includes(newEquipmentStatus)) {
    await db.equipment.update({
      where: { id: equipmentId },
      data: { status: newEquipmentStatus as Prisma.EquipmentUpdateInput['status'] },
    });
  }
}

// ---------------------------------------------------------------------------
// Shared polling helpers
// ---------------------------------------------------------------------------

/**
 * Checks if a shipment event already exists (deduplication).
 */
export async function isEventDuplicate(
  db: PrismaClient,
  shipmentId: string,
  status: string,
): Promise<boolean> {
  const existing = await db.shipmentEvent.findFirst({
    where: { shipmentId, status: status as Prisma.ShipmentEventWhereInput['status'] },
  });
  return !!existing;
}
