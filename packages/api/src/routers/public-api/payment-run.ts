import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiPaymentRunListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

const paymentRunSelect = {
  id: true,
  runNumber: true,
  name: true,
  status: true,
  currency: true,
  totalMinor: true,
  invoiceCount: true,
  exportFormat: true,
  exportedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentRunSelect;

export const publicPaymentRunRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(publicApiPaymentRunListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.PaymentRunWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.PaymentRunWhereInput['status'];

      const rows = await ctx.db.paymentRun.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: paymentRunSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: paymentRunSelect,
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
      return run;
    }),
});
