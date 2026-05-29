/**
 * Equipment return request procedures: approve, reject, list return requests.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@contractor-ops/db';
import {
  returnRequestApproveSchema,
  returnRequestRejectSchema,
  returnRequestStatusEnum,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { RETURN_REQUEST_NOT_FOUND, RETURN_REQUEST_NOT_PENDING } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { loadCourierClient } from '../../services/courier/carrier-factory';
import { dispatch } from '../../services/notification-service';
import { NOTIFICATION_KEYS } from './equipment-shared';

// ---------------------------------------------------------------------------
// Equipment Returns sub-router
// ---------------------------------------------------------------------------

export const equipmentReturnsRouter = router({
  /**
   * Approve a return request and create an InPost shipment.
   * All equipment assigned to the contractor is included (D-11 all-or-nothing).
   */
  approveReturnRequest: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(returnRequestApproveSchema)
    .mutation(async ({ ctx, input }) => {
      const returnRequest = await findOrThrow(
        () =>
          ctx.db.returnRequest.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
            },
            include: {
              contractor: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phone: true,
                },
              },
            },
          }),
        RETURN_REQUEST_NOT_FOUND,
      );

      if (returnRequest.status !== 'PENDING_APPROVAL') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: RETURN_REQUEST_NOT_PENDING,
        });
      }

      // Load all equipment assigned to the contractor (D-11 all-or-nothing)
      const assignments = await ctx.db.equipmentAssignment.findMany({
        where: {
          organizationId: ctx.organizationId,
          contractorId: returnRequest.contractorId,
          unassignedAt: null,
        },
        include: {
          equipment: { select: { id: true, name: true } },
        },
      });

      const client = await loadCourierClient(ctx.db, ctx.organizationId, 'inpost');

      // Load org for sender info
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      // Create InPost shipment
      const shipmentResult = await client.createShipment({
        organizationId: ctx.organizationId,
        direction: 'RETURN',
        receiver: {
          name: returnRequest.contractor.displayName,
          email: returnRequest.contractor.email ?? '',
          phone: returnRequest.contractor.phone ?? '',
        },
        sender: {
          name: org?.name ?? 'Organization',
          email: '',
          phone: '',
        },
        targetPoint: returnRequest.targetPointId ?? '',
        parcelSize: input.parcelSize,
        reference: `return-${returnRequest.id}`,
      });

      // F-DB-08 — pre-generate shipment IDs so the per-equipment 4-write
      // sequence collapses into createMany x2 + updateMany x1 + a single
      // returnRequest.update — total 4 round-trips regardless of N.
      const shipmentRows = assignments.map(a => ({
        id: randomUUID(),
        organizationId: ctx.organizationId,
        equipmentId: a.equipment.id,
        direction: 'RETURN' as const,
        carrier: 'InPost',
        trackingNumber: shipmentResult.trackingNumber,
        externalId: shipmentResult.externalId,
        labelUrl: shipmentResult.labelUrl ?? null,
        currentStatus: 'CREATED' as const,
        createdByUserId: ctx.user.id,
      }));

      const result = await ctx.db.$transaction(async tx => {
        const firstShipmentId = shipmentRows[0]?.id ?? null;

        if (shipmentRows.length > 0) {
          await tx.shipment.createMany({
            data: shipmentRows as Parameters<typeof tx.shipment.createMany>[0]['data'],
          });

          const eventRows = shipmentRows.flatMap(row => [
            {
              organizationId: ctx.organizationId,
              shipmentId: row.id,
              status: 'CREATED' as const,
              notes: `Return request approved by ${ctx.user?.name ?? 'admin'}`,
              createdByUserId: ctx.user.id,
            },
            {
              organizationId: ctx.organizationId,
              shipmentId: row.id,
              status: 'LABEL_GENERATED' as const,
              notes: 'Label auto-generated by ShipX',
              createdByUserId: ctx.user.id,
            },
          ]);

          await Promise.all([
            tx.shipmentEvent.createMany({
              data: eventRows as Parameters<typeof tx.shipmentEvent.createMany>[0]['data'],
            }),
            tx.equipment.updateMany({
              where: { id: { in: assignments.map(a => a.equipment.id) } },
              data: { status: 'RETURN_IN_TRANSIT' },
            }),
          ]);
        }

        // Update ReturnRequest
        const updated = await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            status: 'SHIPMENT_CREATED',
            approvedByUserId: ctx.user.id,
            approvedAt: new Date(),
            shipmentId: firstShipmentId,
          },
          include: {
            contractor: {
              select: { id: true, displayName: true },
            },
            shipment: true,
          },
        });

        return updated;
      });

      // Fire-and-forget: notify contractor about approved return with label info (D-13)
      void dispatch({
        organizationId: ctx.organizationId,
        type: 'EQUIPMENT_RETURN_APPROVED',
        recipientUserIds: [],
        title: NOTIFICATION_KEYS.equipment.returnApproved.title,
        body: NOTIFICATION_KEYS.equipment.returnApproved.body,
        entityType: 'RETURN_REQUEST',
        entityId: returnRequest.id,
        metadata: {
          contractorId: returnRequest.contractorId,
          trackingNumber: shipmentResult.trackingNumber,
          targetPoint: returnRequest.targetPointName,
        },
      }).catch(_err => {
        /* fire-and-forget */
      });

      // Audit log
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        actorName: ctx.user?.name,
        action: 'returnRequest.approve',
        resourceType: 'RETURN_REQUEST',
        resourceId: returnRequest.id,
        newValues: {
          status: 'SHIPMENT_CREATED',
          externalId: shipmentResult.externalId,
          trackingNumber: shipmentResult.trackingNumber,
          equipmentCount: assignments.length,
        },
      });

      return result;
    }),

  /**
   * Reject a return request.
   * Reverts equipment statuses from RETURN_REQUESTED back to previous state.
   */
  rejectReturnRequest: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(returnRequestRejectSchema)
    .mutation(async ({ ctx, input }) => {
      const returnRequest = await findOrThrow(
        () =>
          ctx.db.returnRequest.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
            },
          }),
        RETURN_REQUEST_NOT_FOUND,
      );

      if (returnRequest.status !== 'PENDING_APPROVAL') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: RETURN_REQUEST_NOT_PENDING,
        });
      }

      const result = await ctx.db.$transaction(async tx => {
        // Update ReturnRequest
        const updated = await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            status: 'REJECTED',
            rejectedReason: input.reason ?? null,
            rejectedByUserId: ctx.user.id,
            rejectedAt: new Date(),
          },
          include: {
            contractor: {
              select: { id: true, displayName: true },
            },
          },
        });

        // Revert equipment statuses from RETURN_REQUESTED back to ASSIGNED/DELIVERED
        await tx.equipment.updateMany({
          where: {
            organizationId: ctx.organizationId,
            status: 'RETURN_REQUESTED',
            assignments: {
              some: {
                contractorId: returnRequest.contractorId,
                unassignedAt: null,
              },
            },
          },
          data: { status: 'ASSIGNED' },
        });

        return updated;
      });

      // Fire-and-forget: notify contractor about rejection
      void dispatch({
        organizationId: ctx.organizationId,
        type: 'EQUIPMENT_RETURN_REJECTED',
        recipientUserIds: [],
        title: NOTIFICATION_KEYS.equipment.returnRejected.title,
        body: NOTIFICATION_KEYS.equipment.returnRejected.body,
        entityType: 'RETURN_REQUEST',
        entityId: returnRequest.id,
        metadata: {
          contractorId: returnRequest.contractorId,
          reason: input.reason,
        },
      }).catch(_err => {
        /* fire-and-forget */
      });

      // Audit log
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        actorName: ctx.user?.name,
        action: 'returnRequest.reject',
        resourceType: 'RETURN_REQUEST',
        resourceId: returnRequest.id,
        newValues: {
          status: 'REJECTED',
          reason: input.reason,
        },
      });

      return result;
    }),

  /**
   * List return requests for the organization.
   * Optionally filter by status.
   */
  listReturnRequests: tenantProcedure
    .use(requirePermission({ equipment: ['read'] }))
    .input(
      z.object({
        status: returnRequestStatusEnum.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ReturnRequestWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (input.status) {
        where.status = input.status;
      }

      const returnRequests = await ctx.db.returnRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          contractor: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          shipment: {
            select: {
              id: true,
              trackingNumber: true,
              externalId: true,
              currentStatus: true,
              carrier: true,
              labelUrl: true,
            },
          },
        },
      });

      return returnRequests;
    }),
});
