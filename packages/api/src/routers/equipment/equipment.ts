/**
 * Equipment router — core CRUD and assignment operations.
 *
 * Sub-routers are merged to compose the full equipment domain:
 * - equipment-shipments.ts — generic shipment CRUD, event tracking, contractor equipment view
 * - equipment-couriers.ts — InPost, DPD, UPS integrations, courier config, label retrieval
 * - equipment-returns.ts — return request approve/reject/list
 */
import type { Prisma } from '@contractor-ops/db';
import {
  equipmentAssignSchema,
  equipmentCreateSchema,
  equipmentListSchema,
  equipmentUnassignSchema,
  equipmentUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { mergeRouters, router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { equipmentCouriersRouter } from './equipment-couriers';
import { equipmentReturnsRouter } from './equipment-returns';
import {
  CONTRACTOR_NOT_FOUND,
  EQUIPMENT_CURRENTLY_ASSIGNED,
  EQUIPMENT_NOT_ASSIGNED,
  EQUIPMENT_NOT_AVAILABLE,
  EQUIPMENT_NOT_FOUND,
} from './equipment-shared';
import { equipmentShipmentsRouter } from './equipment-shipments';

// ---------------------------------------------------------------------------
// Core equipment router (CRUD + assignments)
// ---------------------------------------------------------------------------

const equipmentCoreRouter = router({
  // ─── CRUD ───────────────────────────────────────────────────────────

  /**
   * List equipment with pagination, search, filtering, and sorting.
   * Includes current assignment with contractor name.
   */
  list: tenantProcedure
    .use(requirePermission({ equipment: ['read'] }))
    .input(equipmentListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status, type, assignedContractorId, sortBy, sortOrder } =
        input;

      const where: Prisma.EquipmentWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { serialNumber: { contains: search, mode: 'insensitive' } },
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
        ctx.db.equipment.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
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
        ctx.db.equipment.count({ where }),
      ]);

      const mapped = items.map(eq => {
        const currentAssignment = eq.assignments[0] ?? null;
        return {
          ...eq,
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

      return { items: mapped, total, page, pageSize };
    }),

  /**
   * Get equipment by ID with current assignment, full assignment history,
   * and shipments with events.
   */
  getById: tenantProcedure
    .use(requirePermission({ equipment: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
        },
        include: {
          assignments: {
            orderBy: { assignedAt: 'desc' },
            include: {
              contractor: {
                select: { id: true, legalName: true, displayName: true },
              },
            },
          },
          shipments: {
            orderBy: { createdAt: 'desc' },
            include: {
              events: {
                orderBy: { occurredAt: 'asc' },
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
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const currentAssignment = equipment.assignments.find(a => !a.unassignedAt) ?? null;

      return {
        ...equipment,
        currentAssignment,
      };
    }),

  /**
   * Create a new equipment item.
   */
  create: tenantProcedure
    .use(requirePermission({ equipment: ['create'] }))
    .input(equipmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.create({
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
      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'equipment.create',
          resourceType: 'EQUIPMENT',
          resourceId: equipment.id,
          resourceName: equipment.name,
          newValuesJson: input,
        },
      });

      return equipment;
    }),

  /**
   * Update equipment (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const existing = await ctx.db.equipment.findFirst({
        where: { id, organizationId: ctx.organizationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const equipment = await ctx.db.equipment.update({
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

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'equipment.update',
          resourceType: 'EQUIPMENT',
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

      return equipment;
    }),

  /**
   * Retire equipment. Must not be currently assigned.
   */
  retire: tenantProcedure
    .use(requirePermission({ equipment: ['delete'] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.findFirst({
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
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      if (equipment.assignments.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_CURRENTLY_ASSIGNED,
        });
      }

      const updated = await ctx.db.equipment.update({
        where: { id: input.id },
        data: { status: 'RETIRED' },
      });

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'equipment.retire',
          resourceType: 'EQUIPMENT',
          resourceId: updated.id,
          resourceName: updated.name,
          oldValuesJson: { status: equipment.status },
          newValuesJson: { status: 'RETIRED' },
        },
      });

      return updated;
    }),

  // ─── Assignment ─────────────────────────────────────────────────────

  /**
   * Assign equipment to a contractor.
   * Equipment must be in AVAILABLE status (per D-07).
   */
  assign: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.findFirst({
        where: {
          id: input.equipmentId,
          organizationId: ctx.organizationId,
        },
      });

      if (!equipment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      if (equipment.status !== 'AVAILABLE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_AVAILABLE,
        });
      }

      // Verify contractor exists in same org
      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.contractorId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: CONTRACTOR_NOT_FOUND,
        });
      }

      const [assignment, updated] = await ctx.db.$transaction([
        ctx.db.equipmentAssignment.create({
          data: {
            organizationId: ctx.organizationId,
            equipmentId: input.equipmentId,
            contractorId: input.contractorId,
            assignedByUserId: ctx.user.id,
            notes: input.notes ?? null,
          },
        }),
        ctx.db.equipment.update({
          where: { id: input.equipmentId },
          data: { status: 'ASSIGNED' },
        }),
      ]);

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'equipment.assign',
          resourceType: 'EQUIPMENT',
          resourceId: updated.id,
          resourceName: updated.name,
          newValuesJson: {
            contractorId: input.contractorId,
            contractorName: contractor.displayName,
            assignmentId: assignment.id,
          },
        },
      });

      return updated;
    }),

  /**
   * Unassign equipment from its current contractor.
   * Marks the active assignment with unassigned timestamp.
   */
  unassign: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentUnassignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await ctx.db.equipment.findFirst({
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
          code: 'NOT_FOUND',
          message: EQUIPMENT_NOT_FOUND,
        });
      }

      const activeAssignment = equipment.assignments[0];
      if (!activeAssignment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      const [, updated] = await ctx.db.$transaction([
        ctx.db.equipmentAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            unassignedAt: new Date(),
            unassignedByUserId: ctx.user?.id,
            notes: input.notes
              ? `${activeAssignment.notes ? `${activeAssignment.notes}\n` : ''}Unassign: ${input.notes}`
              : activeAssignment.notes,
          },
        }),
        ctx.db.equipment.update({
          where: { id: input.equipmentId },
          data: { status: 'AVAILABLE' },
        }),
      ]);

      await ctx.db.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'equipment.unassign',
          resourceType: 'EQUIPMENT',
          resourceId: updated.id,
          resourceName: updated.name,
          oldValuesJson: {
            contractorId: activeAssignment.contractorId,
            assignmentId: activeAssignment.id,
          },
        },
      });

      return updated;
    }),
});

// ---------------------------------------------------------------------------
// Merged equipment router — combines core CRUD, shipments, couriers, returns
// ---------------------------------------------------------------------------

export const equipmentRouter = mergeRouters(
  equipmentCoreRouter,
  equipmentShipmentsRouter,
  equipmentCouriersRouter,
  equipmentReturnsRouter,
);
