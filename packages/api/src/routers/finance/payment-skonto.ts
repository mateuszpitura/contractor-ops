import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../../services/skonto';

export const paymentSkontoRouter = router({
  applySkontoToItem: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(z.object({ paymentRunItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.paymentRunItem.findFirst({
        where: {
          id: input.paymentRunItemId,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: {
            include: {
              skontoTerms: { take: 1 },
              contractor: {
                include: {
                  billingProfiles: {
                    take: 1,
                    include: { skontoTerms: { take: 1 } },
                  },
                },
              },
            },
          },
        },
      });

      if (!item?.invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PAYMENT_RUN_ITEM_NOT_FOUND,
        });
      }

      const { invoice } = item;
      const invoiceSkontoTerm = invoice.skontoTerms[0];
      const profileSkontoTerm = invoice.contractor?.billingProfiles[0]?.skontoTerms[0];

      const invoiceTerm = invoiceSkontoTerm
        ? {
            discountPercent: Number(invoiceSkontoTerm.discountPercent),
            discountPeriodDays: invoiceSkontoTerm.discountPeriodDays,
            netPeriodDays: invoiceSkontoTerm.netPeriodDays,
          }
        : null;

      const profileTerm = profileSkontoTerm
        ? {
            discountPercent: Number(profileSkontoTerm.discountPercent),
            discountPeriodDays: profileSkontoTerm.discountPeriodDays,
            netPeriodDays: profileSkontoTerm.netPeriodDays,
          }
        : null;

      const effectiveTerm = resolveSkontoTerm(invoiceTerm, profileTerm);

      const eligibility = evaluateSkontoEligibility({
        invoiceTotalMinor: invoice.totalMinor,
        invoiceIssueDate: invoice.issueDate,
        skontoTerm: effectiveTerm,
        paidAt: invoice.paidAt,
        asOf: new Date(),
      });

      if (!eligibility.eligible) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PAYMENT_INVOICE_NOT_SKONTO_ELIGIBLE,
        });
      }

      const skontoTermRecord = invoiceSkontoTerm ?? profileSkontoTerm;

      if (!(skontoTermRecord && effectiveTerm)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PAYMENT_NO_SKONTO_TERM,
        });
      }

      const result = await ctx.db.$transaction(async tx => {
        const updatedItem = await tx.paymentRunItem.update({
          where: { id: input.paymentRunItemId },
          data: { amountMinor: eligibility.discountedAmountMinor },
        });

        await tx.skontoApplication.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunItemId: input.paymentRunItemId,
            skontoTermId: skontoTermRecord.id,
            discountPercentApplied: effectiveTerm.discountPercent,
            discountAmountMinor: eligibility.discountAmountMinor,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user.id,
          action: 'payment_run.apply_skonto',
          resourceType: 'PAYMENT_RUN',
          resourceId: item.paymentRunId,
          oldValues: { itemAmountMinor: item.amountMinor },
          newValues: {
            itemId: input.paymentRunItemId,
            itemAmountMinor: updatedItem.amountMinor,
            discountAmountMinor: eligibility.discountAmountMinor,
            discountPercentApplied: effectiveTerm.discountPercent,
            skontoTermId: skontoTermRecord.id,
          },
        });

        return updatedItem;
      });

      return result;
    }),
});
