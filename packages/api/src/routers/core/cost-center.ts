// ---------------------------------------------------------------------------
// Organization Definitions — CostCenter router
// ---------------------------------------------------------------------------
// CRUD + transactional CSV import for the /organization/cost-centers page.

import {
  costCenterCreateSchema,
  costCenterCsvImportSchema,
  costCenterListSchema,
  costCenterUpdateSchema,
  orgDefinitionArchiveSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog, writeAuditLogMany } from '../../services/audit-writer';

export const costCenterRouter = router({
  list: tenantProcedure
    .use(requirePermission({ costCenter: ['read'] }))
    .input(costCenterListSchema.optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      const search = input?.search;
      const cursor = input?.cursor;
      const limit = input?.limit ?? 50;

      const rows = await ctx.db.costCenter.findMany({
        where: {
          ...(status ? { status } : {}),
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
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          updatedAt: true,
        },
      });

      const hasMore = rows.length > limit;
      return {
        items: hasMore ? rows.slice(0, limit) : rows,
        nextCursor: hasMore ? rows[limit - 1]?.id : null,
      };
    }),

  get: tenantProcedure
    .use(requirePermission({ costCenter: ['read'] }))
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const cc = await ctx.db.costCenter.findFirst({ where: { id: input.id } });
      if (!cc) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost center not found' });
      return cc;
    }),

  create: tenantProcedure
    .use(requirePermission({ costCenter: ['create'] }))
    .input(costCenterCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.costCenter.create({
        data: {
          organizationId: ctx.organizationId,
          name: input.name,
          code: input.code,
          status: input.status,
        },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'costCenter.create',
        resourceType: 'ORGANIZATION',
        resourceId: created.id,
        resourceName: created.name,
        newValues: { name: created.name, code: created.code, status: created.status },
      });
      return created;
    }),

  update: tenantProcedure
    .use(requirePermission({ costCenter: ['update'] }))
    .input(costCenterUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.costCenter.findFirst({ where: { id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost center not found' });

      const updated = await ctx.db.costCenter.update({ where: { id }, data: rest });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'costCenter.update',
        resourceType: 'ORGANIZATION',
        resourceId: id,
        resourceName: updated.name,
        oldValues: { name: before.name, code: before.code, status: before.status },
        newValues: { name: updated.name, code: updated.code, status: updated.status },
      });
      return updated;
    }),

  archive: tenantProcedure
    .use(requirePermission({ costCenter: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.costCenter.findFirst({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Cost center not found' });

      const updated = await ctx.db.costCenter.update({
        where: { id: input.id },
        data: { status: 'ARCHIVED' },
      });
      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'costCenter.archive',
        resourceType: 'ORGANIZATION',
        resourceId: input.id,
        resourceName: updated.name,
        oldValues: { status: before.status },
        newValues: { status: updated.status },
      });
      return updated;
    }),

  importCsv: tenantProcedure
    .use(requirePermission({ costCenter: ['create'] }))
    .input(costCenterCsvImportSchema)
    .mutation(async ({ ctx, input }) => {
      // Transactional: any failure rolls back every insert. The CSV upload UI
      // pre-validates each row, but we still need a server-side guard for
      // (organizationId, code) uniqueness — Prisma will surface a P2002 which
      // bubbles up as INTERNAL_SERVER_ERROR; we catch it and turn it into a
      // friendlier CONFLICT.
      try {
        const created = await ctx.db.$transaction(async tx => {
          return Promise.all(
            input.rows.map(row =>
              tx.costCenter.create({
                data: {
                  organizationId: ctx.organizationId,
                  name: row.name,
                  code: row.code,
                  status: 'ACTIVE',
                },
              }),
            ),
          );
        });

        await writeAuditLogMany({
          rows: created.map(cc => ({
            organizationId: ctx.organizationId,
            actorType: 'USER' as const,
            actorId: ctx.user?.id ?? null,
            action: 'costCenter.importCsv',
            resourceType: 'ORGANIZATION' as const,
            resourceId: cc.id,
            resourceName: cc.name,
            newValues: { name: cc.name, code: cc.code },
          })),
        });

        return { inserted: created.length };
      } catch (err) {
        if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'One or more codes already exist in this organisation',
          });
        }
        throw err;
      }
    }),
});
