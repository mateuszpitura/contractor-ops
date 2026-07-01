import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { tenantProcedure } from '../../middleware/tenant';

// ---------------------------------------------------------------------------
// Read-only Form 1099-K informational band surface for the contractor profile.
//
// Ships dark behind `module.us-expansion`: the router is conditionally spread
// into appRouter at boot (root.ts) and re-evaluates the flag per request via
// `assertUsExpansionEnabled`. The band state is written EXCLUSIVELY by the
// form-1099k-tracker cron — this surface never mutates it, so a client can
// never set a band, payout, or transaction count. Purely informational; the
// platform does not file a 1099-K.
// ---------------------------------------------------------------------------

export const form1099kTrackerRouter = router({
  /**
   * Read the informational 1099-K band for a contractor's tax year — band +
   * cumulative settled USD payout + transaction count + the tax-year threshold.
   * Tenant-scoped (IDOR guard on the contractor) and us-expansion gated.
   */
  getTrackerState: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(
      z
        .object({
          contractorId: z.string().min(1),
          taxYear: z.number().int().min(2020).max(2100).optional(),
        })
        .strict(),
    )
    .query(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const taxYear = input.taxYear ?? new Date().getUTCFullYear();

      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const [state, threshold] = await Promise.all([
        ctx.db.form1099KTrackerState.findFirst({
          where: {
            contractorId: input.contractorId,
            organizationId: ctx.organizationId,
            taxYear,
          },
          select: {
            currentBand: true,
            cumulativePayoutMinor: true,
            transactionCount: true,
            lastScannedAt: true,
            lastCrossedAt: true,
          },
        }),
        ctx.db.tax1099KThreshold.findUnique({
          where: { taxYear },
          select: {
            amountThresholdMinor: true,
            transactionCountThreshold: true,
            currency: true,
          },
        }),
      ]);

      return {
        taxYear,
        band: state?.currentBand ?? ('SAFE' as const),
        cumulativePayoutMinor: state?.cumulativePayoutMinor ?? 0,
        transactionCount: state?.transactionCount ?? 0,
        lastScannedAt: state?.lastScannedAt ?? null,
        lastCrossedAt: state?.lastCrossedAt ?? null,
        threshold: threshold
          ? {
              amountThresholdMinor: threshold.amountThresholdMinor,
              transactionCountThreshold: threshold.transactionCountThreshold,
              currency: threshold.currency,
            }
          : null,
        // The platform is not the settlement entity — it never files a 1099-K.
        informationalOnly: true as const,
      };
    }),
});
