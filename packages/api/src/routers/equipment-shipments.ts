/**
 * Equipment shipment procedures: generic shipment CRUD, event tracking,
 * status transitions, and contractor equipment view.
 */
import { shipmentCreateSchema, shipmentEventCreateSchema } from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { checkShipmentTaskCompletion } from "../services/equipment-workflow.js";
import {
  EQUIPMENT_NOT_FOUND,
  EQUIPMENT_STATUS_TRANSITIONS,
  plain,
  SHIPMENT_CANNOT_DELETE,
  SHIPMENT_NOT_FOUND,
  SHIPMENT_TO_EQUIPMENT_STATUS,
} from "./equipment-shared.js";

// ---------------------------------------------------------------------------
// Equipment Shipments sub-router
// ---------------------------------------------------------------------------

export const equipmentShipmentsRouter = router({
  /**
   * Create a shipment for equipment with an initial CREATED event.
   * Auto-advances equipment status based on direction (D-06).
   */
  createShipment: tenantProcedure
    .use(requirePermission({ equipment: ["create"] }))
    .input(shipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.findFirst({
        where: {
          id: input.equipmentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      // Determine equipment status based on direction
      const newEquipmentStatus =
        input.direction === "OUTBOUND" ? "IN_TRANSIT" : "RETURN_IN_TRANSIT";

      const shipment = await ctx.db.$transaction(async (tx) => {
        const created = await tx.shipment.create({
          data: {
            organizationId: ctx.organizationId,
            equipmentId: input.equipmentId,
            assignmentId: input.workflowTaskRunId ? undefined : undefined,
            workflowTaskRunId: input.workflowTaskRunId ?? null,
            direction: input.direction,
            carrier: input.carrier,
            carrierCustom: input.carrierCustom ?? null,
            trackingNumber: input.trackingNumber ?? null,
            expectedDeliveryAt: input.expectedDeliveryAt ?? null,
            currentStatus: "CREATED",
            createdByUserId: ctx.user?.id,
          },
        });

        // Create initial event
        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: created.id,
            status: "CREATED",
            notes: input.notes ?? null,
            createdByUserId: ctx.user?.id,
          },
        });

        // Auto-advance equipment status
        await tx.equipment.update({
          where: { id: input.equipmentId },
          data: { status: newEquipmentStatus },
        });

        return created;
      });

      // Fetch with events for return
      const result = await ctx.db.shipment.findUnique({
        where: { id: shipment.id },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: "shipment.create",
          resourceType: "SHIPMENT",
          resourceId: shipment.id,
          newValuesJson: {
            equipmentId: input.equipmentId,
            equipmentName: equipment.name,
            direction: input.direction,
            carrier: input.carrier,
            trackingNumber: input.trackingNumber,
          },
        },
      });

      return plain(result);
    }),

  /**
   * Add a shipment event (status update).
   * Auto-advances equipment status per D-06 mapping when applicable.
   */
  addShipmentEvent: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(shipmentEventCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const shipment = await ctx.db.shipment.findFirst({
        where: {
          id: input.shipmentId,
          organizationId: ctx.organizationId,
        },
        include: {
          equipment: { select: { id: true, name: true, status: true } },
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: SHIPMENT_NOT_FOUND,
        });
      }

      await ctx.db.$transaction(async (tx) => {
        // Create event
        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: input.shipmentId,
            status: input.status,
            notes: input.notes ?? null,
            createdByUserId: ctx.user?.id,
          },
        });

        // Update shipment current status
        await tx.shipment.update({
          where: { id: input.shipmentId },
          data: { currentStatus: input.status },
        });

        // Auto-advance equipment status if applicable
        const directionMap = SHIPMENT_TO_EQUIPMENT_STATUS[input.status];
        const newEquipmentStatus = directionMap?.[shipment.direction];

        if (newEquipmentStatus) {
          const allowedTransitions = EQUIPMENT_STATUS_TRANSITIONS[shipment.equipment.status] ?? [];
          if (allowedTransitions.includes(newEquipmentStatus)) {
            await tx.equipment.update({
              where: { id: shipment.equipmentId },
              data: { status: newEquipmentStatus as never },
            });
          }
        }
      });

      const result = await ctx.db.shipment.findUnique({
        where: { id: input.shipmentId },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
        },
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: "shipment.updateStatus",
          resourceType: "SHIPMENT",
          resourceId: shipment.id,
          newValuesJson: {
            status: input.status,
            equipmentId: shipment.equipmentId,
            equipmentName: shipment.equipment.name,
          },
        },
      });

      // Fire-and-forget: auto-complete linked workflow task if shipment reached target status (Phase 30)
      void (async () => {
        await checkShipmentTaskCompletion(prisma, ctx.organizationId, {
          id: shipment.id,
          workflowTaskRunId: shipment.workflowTaskRunId,
          direction: shipment.direction as "OUTBOUND" | "RETURN",
          currentStatus: input.status,
        });
      })();

      return plain(result);
    }),

  /**
   * Get shipment by ID with all events and equipment info.
   */
  getShipment: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const shipment = await ctx.db.shipment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
          equipment: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
              type: true,
              status: true,
            },
          },
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: SHIPMENT_NOT_FOUND,
        });
      }

      return plain(shipment);
    }),

  /**
   * List all shipments for a specific equipment item.
   */
  listShipments: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(z.object({ equipmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const shipments = await ctx.db.shipment.findMany({
        where: {
          equipmentId: input.equipmentId,
          organizationId: ctx.organizationId,
        },
        orderBy: { createdAt: "desc" },
        include: {
          events: {
            orderBy: { occurredAt: "desc" },
            take: 1,
          },
        },
      });

      return plain(shipments);
    }),

  /**
   * Delete a shipment. Only allowed when status is CREATED.
   */
  deleteShipment: tenantProcedure
    .use(requirePermission({ equipment: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const shipment = await ctx.db.shipment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
      });

      if (!shipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: SHIPMENT_NOT_FOUND,
        });
      }

      if (shipment.currentStatus !== "CREATED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: SHIPMENT_CANNOT_DELETE,
        });
      }

      await ctx.db.$transaction([
        ctx.db.shipmentEvent.deleteMany({
          where: { shipmentId: input.id },
        }),
        ctx.db.shipment.delete({
          where: { id: input.id },
        }),
      ]);

      return { success: true };
    }),

  /**
   * List equipment assigned to a specific contractor.
   * Returns active assignments with equipment details and latest shipment.
   */
  listByContractor: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignments = await ctx.db.equipmentAssignment.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
          unassignedAt: null,
        },
        include: {
          equipment: {
            include: {
              shipments: {
                orderBy: { createdAt: "desc" },
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

      const items = assignments.map((a) => ({
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

      return plain(items);
    }),
});
