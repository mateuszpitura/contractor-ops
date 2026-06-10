// ---------------------------------------------------------------------------
// Organization Definitions — CostCenter router
// ---------------------------------------------------------------------------
// CRUD + transactional CSV import for the /organization/cost-centers page.

import {
  costCenterCreateSchema,
  costCenterCsvImportSchema,
  costCenterListSchema,
  costCenterUpdateSchema,
  entityIdSchema,
  orgDefinitionArchiveSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { COST_CENTER_NOT_FOUND, TEMPLATE_CODES_ALREADY_EXIST } from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { findTenantFirstOrThrow, tenantScopedWhere } from '../../lib/tenant-find';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLogMany } from '../../services/audit-writer';
export const costCenterRouter = router({
  list: tenantProcedure
    .use(requirePermission({ costCenter: ['read'] }))
    .input(costCenterListSchema.optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status;
      const search = input?.search;

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
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          updatedAt: true,
        },
        ...cursorClause(input),
      });

      return paginateByLastKept(rows, input);
    }),

  get: tenantProcedure
    .use(requirePermission({ costCenter: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      return findTenantFirstOrThrow(
        () =>
          ctx.db.costCenter.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        COST_CENTER_NOT_FOUND,
      );
    }),

  create: tenantProcedure
    .use(requirePermission({ costCenter: ['create'] }))
    .input(costCenterCreateSchema)
    .mutation(async ({ ctx, input }) => {
      let created!: Awaited<ReturnType<typeof ctx.db.costCenter.create>>;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'costCenter.create',
          resourceType: 'ORGANIZATION',
          get resourceId() {
            return created.id;
          },
          get resourceName() {
            return created.name;
          },
          get newValues() {
            return { name: created.name, code: created.code, status: created.status };
          },
        },
        async tx => {
          created = await tx.costCenter.create({
            data: {
              organizationId: ctx.organizationId,
              name: input.name,
              code: input.code,
              status: input.status,
            },
          });
          return created;
        },
      );
    }),

  update: tenantProcedure
    .use(requirePermission({ costCenter: ['update'] }))
    .input(costCenterUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.costCenter.findFirst({
            where: tenantScopedWhere(ctx, id, { softDelete: false }),
          }),
        COST_CENTER_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'costCenter.update',
          resourceType: 'ORGANIZATION',
          resourceId: id,
          get resourceName() {
            return updated.name;
          },
          oldValues: { name: before.name, code: before.code, status: before.status },
          get newValues() {
            return { name: updated.name, code: updated.code, status: updated.status };
          },
        },
        async tx => {
          updated = await tx.costCenter.update({ where: { id }, data: rest });
          return updated;
        },
      );
    }),

  archive: tenantProcedure
    .use(requirePermission({ costCenter: ['archive'] }))
    .input(orgDefinitionArchiveSchema)
    .mutation(async ({ ctx, input }) => {
      const before = await findTenantFirstOrThrow(
        () =>
          ctx.db.costCenter.findFirst({
            where: tenantScopedWhere(ctx, input.id, { softDelete: false }),
          }),
        COST_CENTER_NOT_FOUND,
      );

      let updated!: typeof before;
      return auditedMutation(
        auditMutationCtx(ctx),
        {
          action: 'costCenter.archive',
          resourceType: 'ORGANIZATION',
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
          updated = await tx.costCenter.update({
            where: { id: input.id },
            data: { status: 'ARCHIVED' },
          });
          return updated;
        },
      );
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
            message: TEMPLATE_CODES_ALREADY_EXIST,
          });
        }
        throw err;
      }
    }),
});
