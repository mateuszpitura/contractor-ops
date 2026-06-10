// ---------------------------------------------------------------------------
// Organization Definitions — Team router
// ---------------------------------------------------------------------------
// CRUD over the Team table for the /organization/teams page. Reads are open
// to every role (contractor wizard dropdowns need them); mutations require
// owner/admin via the `team` resource added in packages/auth.

import {
  entityIdSchema,
  orgDefinitionArchiveSchema,
  teamCreateSchema,
  teamListSchema,
  teamUpdateSchema,
} from '@contractor-ops/validators';
import { TEAM_NOT_FOUND } from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { findTenantFirstOrThrow, tenantScopedWhere } from '../../lib/tenant-find';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
export const teamRouter = router({
  list: tenantProcedure
    .use(requirePermission({ team: ['read'] }))
    .input(teamListSchema.optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      const source = input?.source;
      const search = input?.search;

      const rows = await ctx.db.team.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(source ? { source } : {}),
          ...(search
            ? {
                OR: [
                  { name: { contains: search, mode: 'insensitive' as const } },
                  { code: { contains: search, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        ...cursorClause(input),
        select: {
          id: true,
          name: true,
          code: true,
          managerUserId: true,
          fallbackApproverId: true,
          status: true,
          source: true,
          externalId: true,
          updatedAt: true,
        },
      });

      return paginateByLastKept(rows, input);
    }),

  get: tenantProcedure
    .use(requirePermission({ team: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      return findTenantFirstOrThrow(
        () =>
          ctx.db.team.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        TEAM_NOT_FOUND,
      );
    }),

  create: tenantProcedure
    .use(requirePermission({ team: ['create'] }))
    .input(teamCreateSchema)
    .mutation(async ({ ctx, input }) => {
      let created!: Awaited<ReturnType<typeof ctx.db.team.create>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'team.create',
          resourceType: 'TEAM',
          get resourceId() {
            return created.id;
          },
          get resourceName() {
            return created.name;
          },
          get newValues() {
            return { name: created.name, code: created.code ?? null, status: created.status };
          },
        },
        async tx => {
          created = await tx.team.create({
            data: {
              organizationId: ctx.organizationId,
              name: input.name,
              code: input.code,
              managerUserId: input.managerUserId,
              fallbackApproverId: input.fallbackApproverId,
              status: input.status,
              source: 'MANUAL',
            },
          });
          return created;
        },
      );
    }),

  update: tenantProcedure
    .use(requirePermission({ team: ['update'] }))
    .input(teamUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.team.findFirst({
            where: tenantScopedWhere(ctx, id, { softDelete: false }),
          }),
        TEAM_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'team.update',
          resourceType: 'TEAM',
          resourceId: id,
          get resourceName() {
            return updated.name;
          },
          oldValues: {
            name: before.name,
            code: before.code ?? null,
            status: before.status,
            managerUserId: before.managerUserId,
            fallbackApproverId: before.fallbackApproverId,
          },
          get newValues() {
            return {
              name: updated.name,
              code: updated.code ?? null,
              status: updated.status,
              managerUserId: updated.managerUserId,
              fallbackApproverId: updated.fallbackApproverId,
            };
          },
        },
        async tx => {
          updated = await tx.team.update({ where: { id }, data: rest });
          return updated;
        },
      );
    }),

  archive: tenantProcedure
    .use(requirePermission({ team: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.team.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        TEAM_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'team.archive',
          resourceType: 'TEAM',
          resourceId: input.id,
          get resourceName() {
            return updated.name;
          },
          oldValues: { status: before.status },
          get newValues() {
            return { status: updated.status };
          },
        },
        async tx => {
          updated = await tx.team.update({
            where: { id: input.id },
            data: { status: 'ARCHIVED' },
          });
          return updated;
        },
      );
    }),
});
