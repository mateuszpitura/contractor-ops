// tRPC router for WorkflowRoleTemplate CRUD + auto-selection helper consumed
// by startOffboardingRun.
//
// Multi-tenant: every Prisma query scopes to ctx.organizationId via tenantProcedure.
// Actor identity (createdByUserId equivalents) is derived from ctx.user.id —
// Zod schemas explicitly do NOT include actor fields.
//
// Seed templates (isSeed=true) are read-only at the CRUD layer — update/delete
// return FORBIDDEN. onDelete: Cascade on the FK ensures children are removed
// when an ops-added (isSeed=false) parent is deleted.

import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { entityIdSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  ROLE_TEMPLATE_NOT_FOUND,
  WORKFLOW_TEMPLATE_SEED_NO_DELETE,
  WORKFLOW_TEMPLATE_SEED_NO_UPDATE,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

const logger = createLogger({ service: 'workflow-roles' });

const taskItemInputSchema = z.object({
  sortOrder: z.number().int().nonnegative(),
  titleEn: z.string().min(1).max(200),
  titlePl: z.string().max(200).optional(),
  titleDe: z.string().max(200).optional(),
  descriptionEn: z.string().max(2000).optional(),
  descriptionPl: z.string().max(2000).optional(),
  descriptionDe: z.string().max(2000).optional(),
  dueDayOffset: z.number().int().nonnegative(),
  requiredDocs: z.array(z.string()).optional(),
});

const createInputSchema = z.object({
  role: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/, 'role slug must be lowercase letters, digits, hyphen, or underscore'),
  displayNameEn: z.string().min(1).max(120),
  displayNamePl: z.string().max(120).optional(),
  displayNameDe: z.string().max(120).optional(),
  taskItems: z.array(taskItemInputSchema).min(1).max(20),
});

const updateInputSchema = createInputSchema.merge(entityIdSchema);

const deleteInputSchema = entityIdSchema;

const selectForContractorInputSchema = z.object({ contractorId: z.string().min(1) });

export const workflowRolesRouter = router({
  /**
   * List all role templates (seed + ops-added) for the current organization.
   * Ordered: seed rows first, then ops-added by displayNameEn ascending.
   */
  list: tenantProcedure.use(requirePermission({ workflow: ['read'] })).query(async ({ ctx }) => {
    return ctx.db.workflowRoleTemplate.findMany({
      where: { organizationId: ctx.organizationId },
      include: { taskTemplates: { orderBy: { sortOrder: 'asc' } } },
      orderBy: [{ isSeed: 'desc' }, { displayNameEn: 'asc' }],
    });
  }),

  /**
   * Create an ops-added role template (isSeed=false) plus its child task rows.
   */
  create: tenantProcedure
    .use(requirePermission({ workflow: ['create'] }))
    .input(createInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const created = await tx.workflowRoleTemplate.create({
          data: {
            organizationId: ctx.organizationId,
            role: input.role,
            displayNameEn: input.displayNameEn,
            displayNamePl: input.displayNamePl ?? null,
            displayNameDe: input.displayNameDe ?? null,
            isSeed: false,
          },
        });
        await tx.workflowRoleTaskTemplate.createMany({
          data: input.taskItems.map(item => ({
            organizationId: ctx.organizationId,
            workflowRoleTemplateId: created.id,
            sortOrder: item.sortOrder,
            titleEn: item.titleEn,
            titlePl: item.titlePl ?? null,
            titleDe: item.titleDe ?? null,
            descriptionEn: item.descriptionEn ?? null,
            descriptionPl: item.descriptionPl ?? null,
            descriptionDe: item.descriptionDe ?? null,
            dueDayOffset: item.dueDayOffset,
            requiredDocsJson: item.requiredDocs ? [...item.requiredDocs] : Prisma.JsonNull,
          })),
        });
        return tx.workflowRoleTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { taskTemplates: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    }),

  /**
   * Update an ops-added role template. Refuses isSeed=true rows (FORBIDDEN).
   * Replaces task rows transactionally (delete-all + recreate) to keep the
   * surface model simple.
   */
  update: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () =>
          ctx.db.workflowRoleTemplate.findFirst({
            where: { id: input.id, organizationId: ctx.organizationId },
            select: { id: true, isSeed: true },
          }),
        ROLE_TEMPLATE_NOT_FOUND,
      );
      if (existing.isSeed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: WORKFLOW_TEMPLATE_SEED_NO_UPDATE,
        });
      }

      return ctx.db.$transaction(async tx => {
        await tx.workflowRoleTemplate.update({
          where: { id: input.id },
          data: {
            role: input.role,
            displayNameEn: input.displayNameEn,
            displayNamePl: input.displayNamePl ?? null,
            displayNameDe: input.displayNameDe ?? null,
          },
        });
        await tx.workflowRoleTaskTemplate.deleteMany({
          where: { workflowRoleTemplateId: input.id },
        });
        await tx.workflowRoleTaskTemplate.createMany({
          data: input.taskItems.map(item => ({
            organizationId: ctx.organizationId,
            workflowRoleTemplateId: input.id,
            sortOrder: item.sortOrder,
            titleEn: item.titleEn,
            titlePl: item.titlePl ?? null,
            titleDe: item.titleDe ?? null,
            descriptionEn: item.descriptionEn ?? null,
            descriptionPl: item.descriptionPl ?? null,
            descriptionDe: item.descriptionDe ?? null,
            dueDayOffset: item.dueDayOffset,
            requiredDocsJson: item.requiredDocs ? [...item.requiredDocs] : Prisma.JsonNull,
          })),
        });
        return tx.workflowRoleTemplate.findUniqueOrThrow({
          where: { id: input.id },
          include: { taskTemplates: { orderBy: { sortOrder: 'asc' } } },
        });
      });
    }),

  /**
   * Delete an ops-added role template + its child task rows (Cascade).
   * Refuses isSeed=true rows (FORBIDDEN).
   */
  delete: tenantProcedure
    .use(requirePermission({ workflow: ['delete'] }))
    .input(deleteInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await findOrThrow(
        () =>
          ctx.db.workflowRoleTemplate.findFirst({
            where: { id: input.id, organizationId: ctx.organizationId },
            select: { id: true, isSeed: true },
          }),
        ROLE_TEMPLATE_NOT_FOUND,
      );
      if (existing.isSeed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: WORKFLOW_TEMPLATE_SEED_NO_DELETE,
        });
      }
      await ctx.db.workflowRoleTemplate.delete({ where: { id: input.id } });
      logger.info({ organizationId: ctx.organizationId, id: input.id }, 'role template deleted');
      return { id: input.id };
    }),

  /**
   * Auto-selection helper for startOffboardingRun.
   * Returns the templateId derived from Contractor.workflowRoleId, or the
   * Generic Consultant seed as the deterministic fallback when NULL.
   */
  selectForContractor: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(selectForContractorInputSchema)
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirstOrThrow({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { workflowRoleId: true },
      });

      const offboardingTemplate = await ctx.db.workflowTemplate.findFirst({
        where: {
          organizationId: ctx.organizationId,
          type: 'OFFBOARDING',
          status: 'ACTIVE',
          appliesToEntityType: 'CONTRACTOR',
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });

      if (contractor.workflowRoleId) {
        return {
          templateId: offboardingTemplate?.id ?? null,
          roleTemplateId: contractor.workflowRoleId,
          source: 'contractor_role_id' as const,
        };
      }

      const genericRole = await ctx.db.workflowRoleTemplate.findFirst({
        where: {
          organizationId: ctx.organizationId,
          role: 'generic_consultant',
          isSeed: true,
        },
        select: { id: true },
      });

      return {
        templateId: offboardingTemplate?.id ?? null,
        roleTemplateId: genericRole?.id ?? null,
        source: 'fallback_generic_consultant' as const,
      };
    }),
});
