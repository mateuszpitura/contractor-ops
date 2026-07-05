import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiInvoiceListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listInput = publicApiInvoiceListInputSchema;

// ---------------------------------------------------------------------------
// Public API invoice router
// ---------------------------------------------------------------------------

export const publicInvoiceRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (input.filter?.status) where.status = input.filter.status;
      if (input.filter?.contractorId) where.contractorId = input.filter.contractorId;

      const rows = await ctx.db.invoice.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotalMinor: true,
          vatAmountMinor: true,
          totalMinor: true,
          amountToPayMinor: true,
          sellerTaxId: true,
          sellerName: true,
          status: true,
          matchStatus: true,
          source: true,
          contractorId: true,
          contractId: true,
          isReverseCharge: true,
          createdAt: true,
          updatedAt: true,
        },
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });

      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          servicePeriodStart: true,
          servicePeriodEnd: true,
          currency: true,
          subtotalMinor: true,
          vatRate: true,
          vatAmountMinor: true,
          totalMinor: true,
          withholdingMinor: true,
          amountToPayMinor: true,
          sellerTaxId: true,
          sellerName: true,
          sellerBankAccount: true,
          status: true,
          matchStatus: true,
          source: true,
          isReverseCharge: true,
          contractorId: true,
          contractId: true,
          createdAt: true,
          updatedAt: true,
          contractor: {
            select: { id: true, legalName: true, taxId: true },
          },
          contract: {
            select: { id: true, title: true, type: true, status: true },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      return invoice;
    }),
});
