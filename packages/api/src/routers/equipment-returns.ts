/**
 * Equipment return request procedures: approve, reject, list return requests.
 */
import { prisma } from "@contractor-ops/db";
import {
  returnRequestApproveSchema,
  returnRequestRejectSchema,
  returnRequestStatusEnum,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import type { InPostClientConfig } from "../services/courier/inpost-client.js";
import { InPostClient } from "../services/courier/inpost-client.js";
import { dispatch } from "../services/notification-service.js";
import { NOTIFICATION_KEYS, plain } from "./equipment-shared.js";

// ---------------------------------------------------------------------------
// Equipment Returns sub-router
// ---------------------------------------------------------------------------

export const equipmentReturnsRouter = router({
  /**
   * Approve a return request and create an InPost shipment.
   * All equipment assigned to the contractor is included (D-11 all-or-nothing).
   */
  approveReturnRequest: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(returnRequestApproveSchema)
    .mutation(async ({ ctx, input }) => {
      const returnRequest = await prisma.returnRequest.findFirst({
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
      });

      if (!returnRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RETURN_REQUEST_NOT_FOUND",
        });
      }

      if (returnRequest.status !== "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RETURN_REQUEST_NOT_PENDING",
        });
      }

      // Load all equipment assigned to the contractor (D-11 all-or-nothing)
      const assignments = await prisma.equipmentAssignment.findMany({
        where: {
          organizationId: ctx.organizationId,
          contractorId: returnRequest.contractorId,
          unassignedAt: null,
        },
        include: {
          equipment: { select: { id: true, name: true } },
        },
      });

      // Load courier config
      const courierConfig = await prisma.courierConfig.findUnique({
        where: {
          organizationId_carrier: {
            organizationId: ctx.organizationId,
            carrier: "inpost",
          },
        },
      });

      if (!courierConfig) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "COURIER_CONFIG_NOT_FOUND",
        });
      }

      const configJson = courierConfig.configJson as unknown as InPostClientConfig;
      const client = new InPostClient(configJson);

      // Load org for sender info
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { name: true },
      });

      // Create InPost shipment
      const shipmentResult = await client.createShipment({
        organizationId: ctx.organizationId,
        direction: "RETURN",
        receiver: {
          name: returnRequest.contractor.displayName,
          email: returnRequest.contractor.email ?? "",
          phone: returnRequest.contractor.phone ?? "",
        },
        sender: {
          name: org?.name ?? "Organization",
          email: "",
          phone: "",
        },
        targetPoint: returnRequest.targetPointId ?? "",
        parcelSize: input.parcelSize,
        reference: `return-${returnRequest.id}`,
      });

      // Create records in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create shipment records for each equipment item
        let firstShipmentId: string | null = null;

        for (const assignment of assignments) {
          const shipment = await tx.shipment.create({
            data: {
              organizationId: ctx.organizationId,
              equipmentId: assignment.equipment.id,
              direction: "RETURN",
              carrier: "InPost",
              trackingNumber: shipmentResult.trackingNumber,
              externalId: shipmentResult.externalId,
              labelUrl: shipmentResult.labelUrl ?? null,
              currentStatus: "CREATED",
              createdByUserId: ctx.user!.id,
            },
          });

          if (!firstShipmentId) {
            firstShipmentId = shipment.id;
          }

          // Create events
          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: "CREATED",
              notes: `Return request approved by ${ctx.user!.name ?? "admin"}`,
              createdByUserId: ctx.user!.id,
            },
          });

          await tx.shipmentEvent.create({
            data: {
              organizationId: ctx.organizationId,
              shipmentId: shipment.id,
              status: "LABEL_GENERATED",
              notes: "Label auto-generated by ShipX",
              createdByUserId: ctx.user!.id,
            },
          });

          // Update equipment status
          await tx.equipment.update({
            where: { id: assignment.equipment.id },
            data: { status: "RETURN_IN_TRANSIT" },
          });
        }

        // Update ReturnRequest
        const updated = await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            status: "SHIPMENT_CREATED",
            approvedByUserId: ctx.user!.id,
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
        type: "EQUIPMENT_RETURN_APPROVED",
        recipientUserIds: [],
        title: NOTIFICATION_KEYS.equipment.returnApproved.title,
        body: NOTIFICATION_KEYS.equipment.returnApproved.body,
        entityType: "RETURN_REQUEST",
        entityId: returnRequest.id,
        metadata: {
          contractorId: returnRequest.contractorId,
          trackingNumber: shipmentResult.trackingNumber,
          targetPoint: returnRequest.targetPointName,
        },
      }).catch((err) =>
        console.error("[equipment] Failed to dispatch return approval notification:", err),
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "returnRequest.approve",
          resourceType: "RETURN_REQUEST",
          resourceId: returnRequest.id,
          newValuesJson: {
            status: "SHIPMENT_CREATED",
            externalId: shipmentResult.externalId,
            trackingNumber: shipmentResult.trackingNumber,
            equipmentCount: assignments.length,
          },
        },
      });

      return plain(result);
    }),

  /**
   * Reject a return request.
   * Reverts equipment statuses from RETURN_REQUESTED back to previous state.
   */
  rejectReturnRequest: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(returnRequestRejectSchema)
    .mutation(async ({ ctx, input }) => {
      const returnRequest = await prisma.returnRequest.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!returnRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RETURN_REQUEST_NOT_FOUND",
        });
      }

      if (returnRequest.status !== "PENDING_APPROVAL") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RETURN_REQUEST_NOT_PENDING",
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        // Update ReturnRequest
        const updated = await tx.returnRequest.update({
          where: { id: input.id },
          data: {
            status: "REJECTED",
            rejectedReason: input.reason ?? null,
            rejectedByUserId: ctx.user!.id,
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
            status: "RETURN_REQUESTED",
            assignments: {
              some: {
                contractorId: returnRequest.contractorId,
                unassignedAt: null,
              },
            },
          },
          data: { status: "ASSIGNED" },
        });

        return updated;
      });

      // Fire-and-forget: notify contractor about rejection
      void dispatch({
        organizationId: ctx.organizationId,
        type: "EQUIPMENT_RETURN_REJECTED",
        recipientUserIds: [],
        title: NOTIFICATION_KEYS.equipment.returnRejected.title,
        body: NOTIFICATION_KEYS.equipment.returnRejected.body,
        entityType: "RETURN_REQUEST",
        entityId: returnRequest.id,
        metadata: {
          contractorId: returnRequest.contractorId,
          reason: input.reason,
        },
      }).catch((err) =>
        console.error("[equipment] Failed to dispatch return rejection notification:", err),
      );

      // Audit log
      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "returnRequest.reject",
          resourceType: "RETURN_REQUEST",
          resourceId: returnRequest.id,
          newValuesJson: {
            status: "REJECTED",
            reason: input.reason,
          },
        },
      });

      return plain(result);
    }),

  /**
   * List return requests for the organization.
   * Optionally filter by status.
   */
  listReturnRequests: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(
      z.object({
        status: returnRequestStatusEnum.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (input.status) {
        where.status = input.status;
      }

      const returnRequests = await prisma.returnRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
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

      return plain(returnRequests);
    }),
});
