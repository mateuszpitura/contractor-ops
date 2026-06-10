import { createLogger } from '@contractor-ops/logger';
import { dispatch } from '../notification-service';
import type { DbClient } from '../types';

const log = createLogger({ service: 'shipment-notification' });

type PrismaClient = DbClient;

/**
 * Dispatch a SHIPMENT_STATUS_CHANGE notification to org admins.
 *
 * Encapsulates: admin member query, title/body formatting, dispatch() call.
 * Terminal status check (DELIVERED/FAILED/RETURNED) stays at the call site
 * since each service has its own flow control.
 *
 * Fire-and-forget with try/catch — errors are logged, never thrown.
 */
export async function dispatchShipmentNotification(
  db: PrismaClient,
  organizationId: string,
  shipment: {
    id: string;
    trackingNumber: string | null;
    currentStatus: string;
  },
  mappedStatus: string,
  carrier: string,
): Promise<void> {
  try {
    const adminMembers = await db.member.findMany({
      where: {
        organizationId,
        role: { in: ['owner', 'admin'] },
      },
      select: { userId: true },
    });

    const adminUserIds = adminMembers.map((m: { userId: string }) => m.userId);

    if (adminUserIds.length === 0) {
      return;
    }

    const statusLabel = mappedStatus.toLowerCase().replace('_', ' ');
    void dispatch({
      organizationId,
      type: 'SHIPMENT_STATUS_CHANGE' as const,
      recipientUserIds: adminUserIds,
      title: `Shipment ${statusLabel}`,
      body: `Shipment ${shipment.trackingNumber ?? shipment.id} status changed to ${statusLabel}.`,
      entityType: 'SHIPMENT',
      entityId: shipment.id,
      metadata: {
        shipmentId: shipment.id,
        trackingNumber: shipment.trackingNumber,
        carrier,
        previousStatus: shipment.currentStatus,
        newStatus: mappedStatus,
      },
    });
  } catch (err) {
    log.error({ err, carrier: carrier.toLowerCase() }, 'failed to dispatch notification');
  }
}
