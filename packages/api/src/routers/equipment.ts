import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  equipmentCreateSchema,
  equipmentUpdateSchema,
  equipmentListSchema,
  equipmentAssignSchema,
  equipmentUnassignSchema,
  shipmentCreateSchema,
  shipmentEventCreateSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { checkShipmentTaskCompletion } from "../services/equipment-workflow.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Equipment status transition map (D-05, D-06)
// ---------------------------------------------------------------------------

/**
 * Valid equipment status transitions. Each key maps to the set of
 * statuses it can transition to.
 */
const EQUIPMENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ["ASSIGNED", "IN_TRANSIT", "RETIRED"],
  ASSIGNED: ["AVAILABLE", "IN_TRANSIT", "RETURN_REQUESTED", "RETIRED"],
  IN_TRANSIT: ["DELIVERED", "AVAILABLE"],
  DELIVERED: ["ASSIGNED", "RETURN_REQUESTED", "AVAILABLE", "RETIRED"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "AVAILABLE"],
  RETURN_IN_TRANSIT: ["RETURNED", "AVAILABLE"],
  RETURNED: ["AVAILABLE", "RETIRED"],
  RETIRED: [],
};

/**
 * Maps a (shipment status, direction) pair to the resulting equipment status.
 * Only certain terminal shipment statuses trigger an equipment status change.
 */
const SHIPMENT_TO_EQUIPMENT_STATUS: Record<
  string,
  Record<string, string | undefined> | undefined
> = {
  DELIVERED: {
    OUTBOUND: "DELIVERED",
    RETURN: "RETURNED",
  },
  RETURNED: {
    OUTBOUND: undefined,
    RETURN: "RETURNED",
  },
};

// ---------------------------------------------------------------------------
// Error constants
// ---------------------------------------------------------------------------

const EQUIPMENT_NOT_FOUND = "EQUIPMENT_NOT_FOUND";
const EQUIPMENT_NOT_AVAILABLE = "EQUIPMENT_NOT_AVAILABLE";
const EQUIPMENT_NOT_ASSIGNED = "EQUIPMENT_NOT_ASSIGNED";
const EQUIPMENT_CURRENTLY_ASSIGNED = "EQUIPMENT_CURRENTLY_ASSIGNED";
const CONTRACTOR_NOT_FOUND = "CONTRACTOR_NOT_FOUND";
const SHIPMENT_NOT_FOUND = "SHIPMENT_NOT_FOUND";
const SHIPMENT_CANNOT_DELETE = "SHIPMENT_CANNOT_DELETE";

// ---------------------------------------------------------------------------
// Equipment router
// ---------------------------------------------------------------------------

export const equipmentRouter = router({
  // ─── CRUD ───────────────────────────────────────────────────────────

  /**
   * List equipment with pagination, search, filtering, and sorting.
   * Includes current assignment with contractor name.
   */
  list: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(equipmentListSchema)
    .query(async ({ ctx, input }) => {
      const { page, perPage, search, status, type, assignedContractorId, sortBy, sortOrder } =
        input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { serialNumber: { contains: search, mode: "insensitive" } },
        ];
      }

      if (status?.length) {
        where.status = { in: status };
      }

      if (type?.length) {
        where.type = { in: type };
      }

      if (assignedContractorId) {
        where.assignments = {
          some: {
            contractorId: assignedContractorId,
            unassignedAt: null,
          },
        };
      }

      const [items, total] = await Promise.all([
        prisma.equipment.findMany({
          where,
          skip: (page - 1) * perPage,
          take: perPage,
          orderBy: { [sortBy]: sortOrder },
          include: {
            assignments: {
              where: { unassignedAt: null },
              take: 1,
              include: {
                contractor: {
                  select: { id: true, legalName: true, displayName: true },
                },
              },
            },
          },
        }),
        prisma.equipment.count({ where }),
      ]);

      const mapped = items.map((eq) => {
        const currentAssignment = eq.assignments[0] ?? null;
        return {
          ...plain(eq),
          currentAssignment: currentAssignment
            ? {
                id: currentAssignment.id,
                contractorId: currentAssignment.contractorId,
                contractorName: currentAssignment.contractor.displayName,
                assignedAt: currentAssignment.assignedAt,
              }
            : null,
          assignments: undefined,
        };
      });

      return { items: mapped, total, page, perPage };
    }),

  /**
   * Get equipment by ID with current assignment, full assignment history,
   * and shipments with events.
   */
  getById: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            orderBy: { assignedAt: "desc" },
            include: {
              contractor: {
                select: { id: true, legalName: true, displayName: true },
              },
            },
          },
          shipments: {
            orderBy: { createdAt: "desc" },
            include: {
              events: {
                orderBy: { occurredAt: "asc" },
              },
            },
          },
          _count: {
            select: { shipments: true },
          },
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const currentAssignment =
        equipment.assignments.find((a) => !a.unassignedAt) ?? null;

      return plain({
        ...equipment,
        currentAssignment,
      });
    }),

  /**
   * Create a new equipment item.
   */
  create: tenantProcedure
    .use(requirePermission({ equipment: ["create"] }))
    .input(equipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          serialNumber: input.serialNumber ?? null,
          type: input.type,
          customType: input.customType ?? null,
          notes: input.notes ?? null,
          purchaseDate: input.purchaseDate ?? null,
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "equipment.create",
          resourceType: "EQUIPMENT",
          resourceId: equipment.id,
          resourceName: equipment.name,
          newValuesJson: input,
        },
      });

      return plain(equipment);
    }),

  /**
   * Update equipment (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(equipmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const existing = await prisma.equipment.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const equipment = await prisma.equipment.update({
        where: { id },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.serialNumber !== undefined && {
            serialNumber: fields.serialNumber ?? null,
          }),
          ...(fields.type !== undefined && { type: fields.type }),
          ...(fields.customType !== undefined && {
            customType: fields.customType ?? null,
          }),
          ...(fields.notes !== undefined && { notes: fields.notes ?? null }),
          ...(fields.purchaseDate !== undefined && {
            purchaseDate: fields.purchaseDate ?? null,
          }),
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "equipment.update",
          resourceType: "EQUIPMENT",
          resourceId: equipment.id,
          resourceName: equipment.name,
          oldValuesJson: {
            name: existing.name,
            serialNumber: existing.serialNumber,
            type: existing.type,
            customType: existing.customType,
            notes: existing.notes,
            purchaseDate: existing.purchaseDate,
          },
          newValuesJson: fields,
        },
      });

      return plain(equipment);
    }),

  /**
   * Retire equipment. Must not be currently assigned.
   */
  retire: tenantProcedure
    .use(requirePermission({ equipment: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
          },
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      if (equipment.assignments.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: EQUIPMENT_CURRENTLY_ASSIGNED,
        });
      }

      const updated = await prisma.equipment.update({
        where: { id: input.id },
        data: { status: "RETIRED" },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "equipment.retire",
          resourceType: "EQUIPMENT",
          resourceId: updated.id,
          resourceName: updated.name,
          oldValuesJson: { status: equipment.status },
          newValuesJson: { status: "RETIRED" },
        },
      });

      return plain(updated);
    }),

  // ─── Assignment ─────────────────────────────────────────────────────

  /**
   * Assign equipment to a contractor.
   * Equipment must be in AVAILABLE status (per D-07).
   */
  assign: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(equipmentAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.findFirst({
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

      if (equipment.status !== "AVAILABLE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: EQUIPMENT_NOT_AVAILABLE,
        });
      }

      // Verify contractor exists in same org
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.contractorId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: CONTRACTOR_NOT_FOUND,
        });
      }

      const [assignment, updated] = await prisma.$transaction([
        prisma.equipmentAssignment.create({
          data: {
            organizationId: ctx.organizationId,
            equipmentId: input.equipmentId,
            contractorId: input.contractorId,
            assignedByUserId: ctx.user!.id,
            notes: input.notes ?? null,
          },
        }),
        prisma.equipment.update({
          where: { id: input.equipmentId },
          data: { status: "ASSIGNED" },
        }),
      ]);

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "equipment.assign",
          resourceType: "EQUIPMENT",
          resourceId: updated.id,
          resourceName: updated.name,
          newValuesJson: {
            contractorId: input.contractorId,
            contractorName: contractor.displayName,
            assignmentId: assignment.id,
          },
        },
      });

      return plain(updated);
    }),

  /**
   * Unassign equipment from its current contractor.
   * Marks the active assignment with unassigned timestamp.
   */
  unassign: tenantProcedure
    .use(requirePermission({ equipment: ["update"] }))
    .input(equipmentUnassignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.findFirst({
        where: {
          id: input.equipmentId,
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            where: { unassignedAt: null },
            take: 1,
          },
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const activeAssignment = equipment.assignments[0];
      if (!activeAssignment) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      const [, updated] = await prisma.$transaction([
        prisma.equipmentAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            unassignedAt: new Date(),
            unassignedByUserId: ctx.user!.id,
            notes: input.notes
              ? `${activeAssignment.notes ? activeAssignment.notes + "\n" : ""}Unassign: ${input.notes}`
              : activeAssignment.notes,
          },
        }),
        prisma.equipment.update({
          where: { id: input.equipmentId },
          data: { status: "AVAILABLE" },
        }),
      ]);

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
          action: "equipment.unassign",
          resourceType: "EQUIPMENT",
          resourceId: updated.id,
          resourceName: updated.name,
          oldValuesJson: {
            contractorId: activeAssignment.contractorId,
            assignmentId: activeAssignment.id,
          },
        },
      });

      return plain(updated);
    }),

  // ─── Shipment ───────────────────────────────────────────────────────

  /**
   * Create a shipment for equipment with an initial CREATED event.
   * Auto-advances equipment status based on direction (D-06).
   */
  createShipment: tenantProcedure
    .use(requirePermission({ equipment: ["create"] }))
    .input(shipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await prisma.equipment.findFirst({
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

      const shipment = await prisma.$transaction(async (tx) => {
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
            createdByUserId: ctx.user!.id,
          },
        });

        // Create initial event
        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: created.id,
            status: "CREATED",
            notes: input.notes ?? null,
            createdByUserId: ctx.user!.id,
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
      const result = await prisma.shipment.findUnique({
        where: { id: shipment.id },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
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
      const shipment = await prisma.shipment.findFirst({
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

      await prisma.$transaction(async (tx) => {
        // Create event
        await tx.shipmentEvent.create({
          data: {
            organizationId: ctx.organizationId,
            shipmentId: input.shipmentId,
            status: input.status,
            notes: input.notes ?? null,
            createdByUserId: ctx.user!.id,
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
          const allowedTransitions =
            EQUIPMENT_STATUS_TRANSITIONS[shipment.equipment.status] ?? [];
          if (allowedTransitions.includes(newEquipmentStatus)) {
            await tx.equipment.update({
              where: { id: shipment.equipmentId },
              data: { status: newEquipmentStatus as never },
            });
          }
        }
      });

      const result = await prisma.shipment.findUnique({
        where: { id: input.shipmentId },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: "USER",
          actorId: ctx.user!.id,
          actorName: ctx.user!.name,
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
      const shipment = await prisma.shipment.findFirst({
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
      const shipments = await prisma.shipment.findMany({
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
      const shipment = await prisma.shipment.findFirst({
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

      await prisma.$transaction([
        prisma.shipmentEvent.deleteMany({
          where: { shipmentId: input.id },
        }),
        prisma.shipment.delete({
          where: { id: input.id },
        }),
      ]);

      return { success: true };
    }),

  // ─── Contractor Equipment ───────────────────────────────────────────

  /**
   * List equipment assigned to a specific contractor.
   * Returns active assignments with equipment details and latest shipment.
   */
  listByContractor: tenantProcedure
    .use(requirePermission({ equipment: ["read"] }))
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const assignments = await prisma.equipmentAssignment.findMany({
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
