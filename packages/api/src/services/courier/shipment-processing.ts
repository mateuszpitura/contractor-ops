import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import { writeAuditLog } from '../audit-writer';
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

/** Monotonic progression rank — prevents webhook/poll status regression. */
const SHIPMENT_STATUS_RANK: Record<string, number> = {
  CREATED: 0,
  LABEL_GENERATED: 1,
  PICKED_UP: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  FAILED: 5,
  RETURNED: 5,
};

/**
 * Returns false when `next` would regress a non-terminal shipment (e.g.
 * DELIVERED → IN_TRANSIT). DELIVERED/RETURNED rows are immutable; FAILED may
 * still progress to a delivery outcome — couriers retry failed deliveries
 * (InPost `not_delivered` → `returned_to_sender`, or a redelivery attempt).
 */
export function shouldApplyShipmentStatusUpdate(current: string, next: string): boolean {
  if (current === 'DELIVERED' || current === 'RETURNED') return false;
  if (current === 'FAILED') {
    return next === 'DELIVERED' || next === 'RETURNED' || next === 'OUT_FOR_DELIVERY';
  }
  if ((TERMINAL_STATUSES as readonly string[]).includes(next)) return true;
  const currentRank = SHIPMENT_STATUS_RANK[current] ?? 0;
  const nextRank = SHIPMENT_STATUS_RANK[next] ?? 0;
  return nextRank >= currentRank;
}

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
  if (!shouldApplyShipmentStatusUpdate(shipment.currentStatus, mappedStatus)) {
    log.info(
      {
        shipmentId: shipment.id,
        currentStatus: shipment.currentStatus,
        mappedStatus,
      },
      'shipment status regression blocked',
    );
    return;
  }

  await db.$transaction(async tx => {
    await tx.shipmentEvent.create({
      data: {
        organizationId,
        shipmentId: shipment.id,
        status: mappedStatus as Prisma.ShipmentEventCreateInput['status'],
        notes: eventNotes,
      },
    });

    await tx.shipment.update({
      where: { id: shipment.id },
      data: { currentStatus: mappedStatus as Prisma.ShipmentUpdateInput['currentStatus'] },
    });

    const equipmentUpdate = await computeEquipmentStatusUpdate(
      tx,
      shipment.equipmentId,
      mappedStatus,
      shipment.direction,
    );

    if (equipmentUpdate) {
      await tx.equipment.update({
        where: { id: shipment.equipmentId },
        data: { status: equipmentUpdate as Prisma.EquipmentUpdateInput['status'] },
      });
    }

    await writeAuditLog({
      tx,
      organizationId,
      actorType: 'SYSTEM',
      actorId: null,
      action: 'shipment.updateStatus',
      resourceType: 'SHIPMENT',
      resourceId: shipment.id,
      oldValues: { status: shipment.currentStatus },
      newValues: {
        status: mappedStatus,
        equipmentId: shipment.equipmentId,
        ...(equipmentUpdate ? { equipmentStatus: equipmentUpdate } : {}),
      },
      metadata: { carrier: carrierName, source: 'courier_poll_or_webhook' },
    });
  });

  // Dispatch notification for notable statuses (outside tx — external side effects)
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

  void checkShipmentTaskCompletion(db, organizationId, {
    id: shipment.id,
    workflowTaskRunId: shipment.workflowTaskRunId,
    direction: shipment.direction as 'OUTBOUND' | 'RETURN',
    currentStatus: mappedStatus,
  }).catch(err => {
    log.error({ err, shipmentId: shipment.id }, 'checkShipmentTaskCompletion failed');
  });
}

type EquipmentTx = Pick<PrismaClient, 'equipment'>;

/**
 * Returns the target equipment status when the transition is allowed, else null.
 */
async function computeEquipmentStatusUpdate(
  db: EquipmentTx,
  equipmentId: string,
  shipmentStatus: string,
  direction: string,
): Promise<string | null> {
  const directionMap = SHIPMENT_TO_EQUIPMENT_STATUS[shipmentStatus];
  const newEquipmentStatus = directionMap?.[direction];

  if (!newEquipmentStatus) return null;

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, status: true },
  });

  if (!equipment) return null;

  const allowed = EQUIPMENT_STATUS_TRANSITIONS[equipment.status] ?? [];
  if (allowed.includes(newEquipmentStatus)) {
    return newEquipmentStatus;
  }

  return null;
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
