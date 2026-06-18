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
  entityIdSchema,
  equipmentAssignSchema,
  equipmentCreateSchema,
  equipmentListSchema,
  equipmentUnassignSchema,
  equipmentUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { mergeRouters, router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { findOrThrow } from '../../lib/find-or-throw';
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
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const equipment = await findOrThrow(
        () =>
          ctx.db.equipment.findFirst({
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
          }),
        EQUIPMENT_NOT_FOUND,
      );

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
      let equipment!: Awaited<ReturnType<typeof ctx.db.equipment.create>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'equipment.create',
          resourceType: 'EQUIPMENT',
          get resourceId() {
            return equipment.id;
          },
          get resourceName() {
            return equipment.name;
          },
          newValues: input as Record<string, unknown>,
        },
        async tx => {
          equipment = await tx.equipment.create({
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
          return equipment;
        },
      );
    }),

  /**
   * Update equipment (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fields } = input;

      const existing = await findOrThrow(
        () => ctx.db.equipment.findFirst({ where: { id, organizationId: ctx.organizationId } }),
        EQUIPMENT_NOT_FOUND,
      );

      const equipment = await auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'equipment.update',
          resourceType: 'EQUIPMENT',
          resourceId: id,
          resourceName: fields.name ?? existing.name,
          oldValues: {
            name: existing.name,
            serialNumber: existing.serialNumber,
            type: existing.type,
            customType: existing.customType,
            notes: existing.notes,
            purchaseDate: existing.purchaseDate,
          },
          newValues: fields as Record<string, unknown>,
        },
        async tx =>
          tx.equipment.update({
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
          }),
      );

      return equipment;
    }),

  /**
   * Retire equipment. Must not be currently assigned.
   */
  retire: tenantProcedure
    .use(requirePermission({ equipment: ['delete'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await findOrThrow(
        () =>
          ctx.db.equipment.findFirst({
            where: { id: input.id, organizationId: ctx.organizationId },
            include: {
              assignments: {
                where: { unassignedAt: null },
                take: 1,
              },
            },
          }),
        EQUIPMENT_NOT_FOUND,
      );

      if (equipment.assignments.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_CURRENTLY_ASSIGNED,
        });
      }

      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'equipment.retire',
          resourceType: 'EQUIPMENT',
          resourceId: input.id,
          resourceName: equipment.name,
          oldValues: { status: equipment.status },
          newValues: { status: 'RETIRED' },
        },
        async tx =>
          tx.equipment.update({
            where: { id: input.id },
            data: { status: 'RETIRED' },
          }),
      );
    }),

  // ─── Assignment ─────────────────────────────────────────────────────

  /**
   * Assign equipment to a contractor.
   * Equipment must be in AVAILABLE status.
   */
  assign: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentAssignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await findOrThrow(
        () =>
          ctx.db.equipment.findFirst({
            where: {
              id: input.equipmentId,
              organizationId: ctx.organizationId,
            },
          }),
        EQUIPMENT_NOT_FOUND,
      );

      if (equipment.status !== 'AVAILABLE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_AVAILABLE,
        });
      }

      const contractor = await findOrThrow(
        () =>
          ctx.db.contractor.findFirst({
            where: {
              id: input.contractorId,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        CONTRACTOR_NOT_FOUND,
      );

      let assignment!: Awaited<ReturnType<typeof ctx.db.equipmentAssignment.create>>;
      let updated!: Awaited<ReturnType<typeof ctx.db.equipment.update>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'equipment.assign',
          resourceType: 'EQUIPMENT',
          get resourceId() {
            return updated.id;
          },
          get resourceName() {
            return updated.name;
          },
          newValues: {
            contractorId: input.contractorId,
            contractorName: contractor.displayName,
            get assignmentId() {
              return assignment.id;
            },
          },
        },
        async tx => {
          assignment = await tx.equipmentAssignment.create({
            data: {
              organizationId: ctx.organizationId,
              equipmentId: input.equipmentId,
              contractorId: input.contractorId,
              assignedByUserId: ctx.user.id,
              notes: input.notes ?? null,
            },
          });
          updated = await tx.equipment.update({
            where: { id: input.equipmentId },
            data: { status: 'ASSIGNED' },
          });
          return updated;
        },
      );
    }),

  /**
   * Unassign equipment from its current contractor.
   * Marks the active assignment with unassigned timestamp.
   */
  unassign: tenantProcedure
    .use(requirePermission({ equipment: ['update'] }))
    .input(equipmentUnassignSchema)
    .mutation(async ({ ctx, input }) => {
      const equipment = await findOrThrow(
        () =>
          ctx.db.equipment.findFirst({
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
          }),
        EQUIPMENT_NOT_FOUND,
      );

      const activeAssignment = equipment.assignments[0];
      if (!activeAssignment) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: EQUIPMENT_NOT_ASSIGNED,
        });
      }

      let updated!: Awaited<ReturnType<typeof ctx.db.equipment.update>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'equipment.unassign',
          resourceType: 'EQUIPMENT',
          get resourceId() {
            return updated.id;
          },
          get resourceName() {
            return updated.name;
          },
          oldValues: {
            contractorId: activeAssignment.contractorId,
            assignmentId: activeAssignment.id,
          },
        },
        async tx => {
          await tx.equipmentAssignment.update({
            where: { id: activeAssignment.id },
            data: {
              unassignedAt: new Date(),
              unassignedByUserId: ctx.user?.id,
              notes: input.notes
                ? `${activeAssignment.notes ? `${activeAssignment.notes}\n` : ''}Unassign: ${input.notes}`
                : activeAssignment.notes,
            },
          });
          updated = await tx.equipment.update({
            where: { id: input.equipmentId },
            data: { status: 'AVAILABLE' },
          });
          return updated;
        },
      );
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
