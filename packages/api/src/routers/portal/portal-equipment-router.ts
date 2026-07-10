import { entityIdSchema, returnRequestCreateSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { portalProcedure } from '../../middleware/portal-auth';
import { writeAuditLog } from '../../services/audit-writer';
import { loadCourierClient } from '../../services/courier/carrier-factory';
import type { OutboxTransactionalClient } from '../../services/outbox';
import { enqueueNotificationOutboxEvent } from '../../services/outbox';

export const portalEquipmentRouter = router({
  // =========================================================================
  // EQUIPMENT ENDPOINTS (authenticated)
  // =========================================================================

  /**
   * List equipment assigned to the authenticated contractor.
   * Returns active assignments with equipment details and latest shipment.
   */
  listEquipment: portalProcedure.query(async ({ ctx }) => {
    const assignments = await ctx.db.equipmentAssignment.findMany({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        unassignedAt: null,
      },
      include: {
        equipment: {
          include: {
            shipments: {
              orderBy: { createdAt: 'desc' as const },
              take: 1,
              select: {
                id: true,
                direction: true,
                carrier: true,
                trackingNumber: true,
                currentStatus: true,
                expectedDeliveryAt: true,
              },
            },
          },
        },
      },
    });

    const items = assignments.map(a => ({
      assignmentId: a.id,
      assignedAt: a.assignedAt,
      equipment: {
        id: a.equipment.id,
        name: a.equipment.name,
        serialNumber: a.equipment.serialNumber,
        type: a.equipment.type,
        status: a.equipment.status,
      },
      latestShipment: a.equipment.shipments[0] ?? null,
    }));

    return items;
  }),

  /**
   * Get the most recent active return request for the authenticated contractor.
   * Returns null if no active return exists.
   */
  getReturnStatus: portalProcedure.query(async ({ ctx }) => {
    const returnRequest = await ctx.db.returnRequest.findFirst({
      where: {
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
        status: {
          notIn: ['CANCELLED', 'REJECTED', 'RECEIVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        shipment: {
          select: {
            id: true,
            trackingNumber: true,
            currentStatus: true,
            carrier: true,
            labelUrl: true,
          },
        },
      },
    });

    return returnRequest ? returnRequest : null;
  }),

  /**
   * Request a return of all assigned equipment.
   * Creates a ReturnRequest with PENDING_APPROVAL status (admin must approve).
   */
  requestReturn: portalProcedure
    .input(returnRequestCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify contractor has assigned equipment
      const assignments = await ctx.db.equipmentAssignment.findMany({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          unassignedAt: null,
        },
        include: {
          equipment: { select: { id: true, name: true, status: true } },
        },
      });

      if (assignments.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.NO_EQUIPMENT_ASSIGNED,
        });
      }

      // Verify no existing active return request
      const existingReturn = await ctx.db.returnRequest.findFirst({
        where: {
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
          status: {
            in: ['PENDING_APPROVAL', 'APPROVED', 'SHIPMENT_CREATED'],
          },
        },
      });

      if (existingReturn) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.RETURN_ALREADY_PENDING,
        });
      }

      const result = await ctx.db.$transaction(async tx => {
        // Create return request
        const returnRequest = await tx.returnRequest.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: ctx.contractorId,
            status: 'PENDING_APPROVAL',
            targetPointId: input.targetPointId,
            targetPointName: input.targetPointName,
            targetPointAddress: input.targetPointAddress,
          },
        });

        // Update all assigned equipment to RETURN_REQUESTED
        const equipmentIds = assignments.map(a => a.equipment.id);
        await tx.equipment.updateMany({
          where: {
            id: { in: equipmentIds },
            organizationId: ctx.organizationId,
          },
          data: { status: 'RETURN_REQUESTED' },
        });

        // Route through shared writer so portal audit rows share the same
        // shape (oldValues / newValues / metadata discipline) as core mutations.
        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'CONTRACTOR',
          actorId: ctx.contractorId,
          actorName: ctx.contractor?.email ?? 'contractor',
          action: 'returnRequest.create',
          resourceType: 'RETURN_REQUEST',
          resourceId: returnRequest.id,
          oldValues: null,
          newValues: {
            targetPointId: input.targetPointId,
            targetPointName: input.targetPointName,
            equipmentCount: equipmentIds.length,
          },
        });

        // Enqueue the admin notification INSIDE the tx so it commits
        // atomically with the return-request create (exactly-once).
        await enqueueNotificationOutboxEvent({
          tx: tx as unknown as OutboxTransactionalClient,
          event: {
            organizationId: ctx.organizationId,
            type: 'EQUIPMENT_RETURN_REQUESTED',
            recipientUserIds: [],
            title: 'notifications.equipment.returnRequested.title',
            body: 'notifications.equipment.returnRequested.body',
            entityType: 'RETURN_REQUEST',
            entityId: returnRequest.id,
            metadata: {
              contractorId: ctx.contractorId,
              targetPoint: input.targetPointName,
            },
          },
          dedupKey: `equipment-return-requested:${returnRequest.id}`,
        });

        return returnRequest;
      });

      return result;
    }),

  /**
   * Cancel a pending return request.
   * Only allowed when status is PENDING_APPROVAL.
   */
  cancelReturn: portalProcedure.input(entityIdSchema).mutation(async ({ ctx, input }) => {
    const returnRequest = await ctx.db.returnRequest.findFirst({
      where: {
        id: input.id,
        contractorId: ctx.contractorId,
        organizationId: ctx.organizationId,
      },
    });

    if (!returnRequest) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: E.RETURN_REQUEST_NOT_FOUND,
      });
    }

    if (returnRequest.status !== 'PENDING_APPROVAL') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: E.RETURN_CANNOT_CANCEL,
      });
    }

    const result = await ctx.db.$transaction(async tx => {
      const updated = await tx.returnRequest.update({
        where: { id: input.id },
        data: { status: 'CANCELLED' },
      });

      // Revert equipment statuses from RETURN_REQUESTED back to ASSIGNED
      await tx.equipment.updateMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'RETURN_REQUESTED',
          assignments: {
            some: {
              contractorId: ctx.contractorId,
              unassignedAt: null,
            },
          },
        },
        data: { status: 'ASSIGNED' },
      });

      // Route through shared writer.
      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'CONTRACTOR',
        actorId: ctx.contractorId,
        actorName: ctx.contractor?.email ?? 'contractor',
        action: 'returnRequest.cancel',
        resourceType: 'RETURN_REQUEST',
        resourceId: input.id,
        oldValues: { status: returnRequest.status },
        newValues: { status: 'CANCELLED' },
      });

      return updated;
    });

    return result;
  }),

  /**
   * Get the return shipping label for an approved return request.
   * Only available when status is SHIPMENT_CREATED and shipment exists.
   */
  getReturnLabel: portalProcedure
    .input(z.object({ returnRequestId: z.string() }))
    .query(async ({ ctx, input }) => {
      const returnRequest = await ctx.db.returnRequest.findFirst({
        where: {
          id: input.returnRequestId,
          contractorId: ctx.contractorId,
          organizationId: ctx.organizationId,
        },
      });

      if (!returnRequest) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.RETURN_REQUEST_NOT_FOUND,
        });
      }

      if (returnRequest.status !== 'SHIPMENT_CREATED' || !returnRequest.shipmentId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.RETURN_LABEL_NOT_AVAILABLE,
        });
      }

      const shipment = await ctx.db.shipment.findFirst({
        where: {
          id: returnRequest.shipmentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!shipment || shipment.carrier !== 'InPost' || !shipment.externalId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.SHIPMENT_NO_INPOST_LABEL,
        });
      }

      const client = await loadCourierClient(ctx.db, ctx.organizationId, 'inpost');

      const labelBuffer = await client.getLabel(shipment.externalId, 'pdf');

      return {
        data: labelBuffer.toString('base64'),
        contentType: 'application/pdf',
        filename: `return-label-${shipment.trackingNumber ?? shipment.externalId}.pdf`,
      };
    }),
});
