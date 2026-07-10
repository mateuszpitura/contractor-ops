import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../../middleware/feature-flag';
import { requirePermission } from '../../middleware/rbac';
import { writeAuditLog } from '../../services/audit-writer';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../../services/skonto';

export const paymentSkontoRouter = router({
  applySkontoToItem: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ payment: ['create'] }))
    .input(z.object({ paymentRunItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.paymentRunItem.findFirst({
        where: {
          id: input.paymentRunItemId,
          organizationId: ctx.organizationId,
        },
        include: {
          paymentRun: true,
          skontoApplication: true,
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

      if (item.paymentRun.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PAYMENT_RUN_INVALID_STATUS,
        });
      }

      if (item.status !== 'PENDING') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PAYMENT_RUN_INVALID_STATUS,
        });
      }

      if (item.skontoApplication) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.PAYMENT_INVOICE_NOT_SKONTO_ELIGIBLE,
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
        invoiceTotalMinor: item.amountMinor,
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

        const runTotalAgg = await tx.paymentRunItem.aggregate({
          where: { paymentRunId: item.paymentRunId, status: { not: 'SKIPPED' } },
          _sum: { amountMinor: true },
        });

        await tx.paymentRun.update({
          where: { id: item.paymentRunId },
          data: { totalMinor: runTotalAgg._sum.amountMinor ?? 0 },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user!.id,
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
