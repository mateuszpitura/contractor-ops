// ---------------------------------------------------------------------------
// Organization Definitions — Team router
// ---------------------------------------------------------------------------
// CRUD over the Team table for the /organization/teams page. Reads are open
// to every role (contractor wizard dropdowns need them); mutations require
// owner/admin via the `team` resource added in packages/auth.

import {
  orgDefinitionArchiveSchema,
  teamCreateSchema,
  teamListSchema,
  teamUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';

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
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.db.team.findFirst({ where: { id: input.id } });
      if (!team) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });
      return team;
    }),

  create: tenantProcedure
    .use(requirePermission({ team: ['create'] }))
    .input(teamCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.team.create({
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
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'team.create',
        resourceType: 'TEAM',
        resourceId: created.id,
        resourceName: created.name,
        newValues: { name: created.name, code: created.code ?? null, status: created.status },
      });
      return created;
    }),

  update: tenantProcedure
    .use(requirePermission({ team: ['update'] }))
    .input(teamUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.team.findFirst({ where: { id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      const updated = await ctx.db.team.update({ where: { id }, data: rest });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'team.update',
        resourceType: 'TEAM',
        resourceId: id,
        resourceName: updated.name,
        oldValues: {
          name: before.name,
          code: before.code ?? null,
          status: before.status,
          managerUserId: before.managerUserId,
          fallbackApproverId: before.fallbackApproverId,
        },
        newValues: {
          name: updated.name,
          code: updated.code ?? null,
          status: updated.status,
          managerUserId: updated.managerUserId,
          fallbackApproverId: updated.fallbackApproverId,
        },
      });
      return updated;
    }),

  archive: tenantProcedure
    .use(requirePermission({ team: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.team.findFirst({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' });

      const updated = await ctx.db.team.update({
        where: { id: input.id },
        data: { status: 'ARCHIVED' },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'team.archive',
        resourceType: 'TEAM',
        resourceId: input.id,
        resourceName: updated.name,
        oldValues: { status: before.status },
        newValues: { status: updated.status },
      });
      return updated;
    }),
});
