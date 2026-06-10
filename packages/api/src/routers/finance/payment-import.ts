import { bankStatementConfirmSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { matchStatementToRun, parseBankStatement } from '../../services/bank-statement';
import { autoCompleteRunIfTerminal } from './payment-shared';

export const paymentImportRouter = router({
  importStatement: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(
      z.object({
        runId: z.cuid(),
        fileContent: z.string(),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: {
          id: input.runId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              billingProfile: {
                select: { bankAccountMasked: true },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      if (run.status !== 'EXPORTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PAYMENT_BANK_STATEMENT_EXPORTED_ONLY,
        });
      }

      const transactions = parseBankStatement(input.fileContent, input.fileName);

      const matchItems = run.items.map(item => ({
        id: item.id,
        amountMinor: item.amountMinor,
        iban: item.billingProfile?.bankAccountMasked ?? '',
      }));

      const matches = matchStatementToRun(transactions, matchItems);

      return { matches, transactions };
    }),

  confirmStatementMatches: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(bankStatementConfirmSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();

        const matchedItemIds = input.matches.map(m => m.itemId);
        const validItems = await tx.paymentRunItem.findMany({
          where: {
            id: { in: matchedItemIds },
            paymentRunId: run.id,
            organizationId: ctx.organizationId,
          },
          select: { id: true, invoiceId: true },
        });

        if (validItems.length > 0) {
          const validItemIds = validItems.map(i => i.id);
          const invoiceIds = validItems.map(i => i.invoiceId);

          await tx.paymentRunItem.updateMany({
            where: { id: { in: validItemIds } },
            data: { status: 'PAID', markedPaidAt: now },
          });

          await tx.invoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { paymentStatus: 'PAID', paidAt: now },
          });
        }

        await autoCompleteRunIfTerminal(tx, run.id);

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'payment_run.confirm_statement_matches',
          resourceType: 'PAYMENT_RUN',
          resourceId: run.id,
          resourceName: run.runNumber,
          newValues: {
            confirmedItemIds: validItems.map(i => i.id),
            confirmedInvoiceIds: validItems.map(i => i.invoiceId),
            matchCount: validItems.length,
          },
        });

        const updatedRun = await tx.paymentRun.findUnique({
          where: { id: run.id },
          include: { items: true },
        });

        return updatedRun;
      });

      return result;
    }),
});
