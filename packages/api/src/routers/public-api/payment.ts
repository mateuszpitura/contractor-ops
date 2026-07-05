import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiPaymentListInputSchema,
  publicApiPaymentUpdateInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { autoCompleteRunIfTerminal } from '../finance/payment-shared';
import { writePublicApiAudit } from './write-shared';

// A "payment" in the public API is a payment-run line item — one contractor
// payout within a run. Money fields are exposed read-only.
const paymentSelect = {
  id: true,
  paymentRunId: true,
  invoiceId: true,
  contractorId: true,
  currency: true,
  status: true,
  grossAmountMinor: true,
  whtAmountMinor: true,
  paymentReference: true,
  markedPaidAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentRunItemSelect;

export const publicPaymentRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(publicApiPaymentListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.PaymentRunItemWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.PaymentRunItemWhereInput['status'];
      if (input.filter?.contractorId) where.contractorId = input.filter.contractorId;

      const rows = await ctx.db.paymentRunItem.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: paymentSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const payment = await ctx.db.paymentRunItem.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: paymentSelect,
      });
      if (!payment)
        throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_ITEM_NOT_FOUND });
      return payment;
    }),

  update: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['update'] }))
    .input(publicApiPaymentUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const item = await tx.paymentRunItem.findFirst({
          where: { id: input.itemId, organizationId: ctx.organizationId },
          select: { id: true, status: true, invoiceId: true, paymentRunId: true },
        });
        if (!item) {
          throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_ITEM_NOT_FOUND });
        }

        const updated = await tx.paymentRunItem.update({
          where: { id: item.id },
          data: {
            status: input.status,
            paymentReference: input.paymentReference ?? null,
            failureReason: input.status === 'FAILED' ? (input.failureReason ?? null) : null,
            markedPaidAt: input.status === 'PAID' ? new Date() : null,
          },
          select: paymentSelect,
        });

        if (input.status === 'PAID') {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'PAID', paidAt: new Date() },
          });
        } else if (input.status === 'FAILED') {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'READY' },
          });
        }

        await autoCompleteRunIfTerminal(tx, item.paymentRunId);

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'payment.update',
          resourceType: 'PAYMENT_RUN',
          resourceId: item.paymentRunId,
          oldValues: { itemStatus: item.status },
          newValues: { itemId: updated.id, itemStatus: updated.status },
        });

        return updated;
      });
    }),
});
