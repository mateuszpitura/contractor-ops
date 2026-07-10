import { bankStatementConfirmSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { matchStatementToRun, parseBankStatement } from '../../services/bank-statement';
import type { OutboxTransactionalClient } from '../../services/outbox';
import {
  enqueuePaymentStatusNotification,
  getPaymentNotifyUserIds,
} from '../../services/payment-notification';
import { applyInvoicePaymentOutcome, autoCompleteRunIfTerminal } from './payment-shared';

/**
 * Upper bound on the raw statement text. `fileContent` is parsed as UTF-8
 * (MT940/CSV) — not base64 — so the cap is on characters. 5 MB of statement
 * text is far beyond any real bank export and keeps the
 * O(transactions × runItems) matcher bounded against an oversized upload.
 */
const MAX_STATEMENT_CHARS = 5_000_000;

export const paymentImportRouter = router({
  importStatement: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(
      z.object({
        runId: z.cuid(),
        fileContent: z.string().max(MAX_STATEMENT_CHARS, 'Statement file too large (max ~5MB)'),
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
      const financeRecipients = await getPaymentNotifyUserIds(ctx.db, ctx.organizationId);

      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
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
                invoice: { select: { invoiceNumber: true, currency: true } },
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
        const eligibleItems = run.items.filter(
          item => item.status === 'PENDING' || item.status === 'EXPORTED',
        );
        const matchItems = eligibleItems.map(item => ({
          id: item.id,
          amountMinor: item.amountMinor,
          iban: item.billingProfile?.bankAccountMasked ?? '',
        }));

        const serverMatches = matchStatementToRun(transactions, matchItems);
        const serverMatchByItemId = new Map(
          serverMatches
            .filter(m => m.paymentRunItemId && m.confidence !== 'unmatched' && m.amountMatched)
            .map(m => [m.paymentRunItemId, m]),
        );

        const confirmedItemIds: string[] = [];
        for (const clientMatch of input.matches) {
          const serverMatch = serverMatchByItemId.get(clientMatch.itemId);
          if (!serverMatch || serverMatch.transactionIndex !== clientMatch.transactionIndex) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: E.PAYMENT_STATEMENT_MATCH_INVALID,
            });
          }
          confirmedItemIds.push(clientMatch.itemId);
        }

        const now = new Date();

        const validItems = eligibleItems.filter(i => confirmedItemIds.includes(i.id));

        if (validItems.length > 0) {
          const validItemIds = validItems.map(i => i.id);

          const updated = await tx.paymentRunItem.updateMany({
            where: {
              id: { in: validItemIds },
              paymentRunId: run.id,
              organizationId: ctx.organizationId,
              status: { in: ['PENDING', 'EXPORTED'] },
            },
            data: { status: 'PAID', markedPaidAt: now },
          });

          if (updated.count !== validItemIds.length) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: E.PAYMENT_STATEMENT_MATCH_INVALID,
            });
          }

          for (const item of validItems) {
            await applyInvoicePaymentOutcome(tx, {
              organizationId: ctx.organizationId,
              invoiceId: item.invoiceId,
              amountMinor: item.amountMinor,
              paidAt: now,
              sourceKind: 'BANK_STATEMENT',
              sourcePaymentRunItemId: item.id,
              createdByUserId: ctx.user.id,
            });

            await enqueuePaymentStatusNotification(tx as unknown as OutboxTransactionalClient, {
              organizationId: ctx.organizationId,
              paymentRunId: run.id,
              runNumber: run.runNumber,
              itemId: item.id,
              invoiceId: item.invoiceId,
              invoiceNumber: item.invoice?.invoiceNumber ?? null,
              status: 'PAID',
              amountMinor: item.amountMinor,
              currency: item.invoice?.currency ?? 'EUR',
              recipientUserIds: validItems.length > 0 ? financeRecipients : [],
            });
          }
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
