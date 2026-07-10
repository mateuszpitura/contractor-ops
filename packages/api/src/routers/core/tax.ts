import { whtServiceTypeEnum } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import {
  calculateWht,
  getTaxRatesForCountry,
  validateVatRateCode,
} from '../../services/tax-rate.service';
import { createWhtCertificate, listWhtCertificates } from '../../services/wht-certificate.service';

export const taxRouter = router({
  /** Get active tax rates for the tenant org's country */
  getRates: tenantProcedure.query(async ({ ctx }) => {
    const org = await ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
      select: { countryCode: true },
    });
    if (!org.countryCode) return [];
    return getTaxRatesForCountry(org.countryCode);
  }),

  /** Get tax rates for a specific country (for cross-border scenarios) */
  getRatesByCountry: tenantProcedure
    .input(z.object({ countryCode: z.string().length(2) }))
    .query(async ({ input }) => {
      return getTaxRatesForCountry(input.countryCode);
    }),

  /** Validate a VAT rate code against the org's country */
  validateRate: tenantProcedure
    .input(z.object({ code: z.string().max(10) }))
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode) return { valid: false };
      const valid = await validateVatRateCode(org.countryCode, input.code);
      return { valid };
    }),

  /** Calculate WHT for a cross-border payment */
  calculateWht: tenantProcedure
    .input(
      z.object({
        contractorResidency: z.string().length(2),
        serviceType: whtServiceTypeEnum,
        grossAmountMinor: z.number().int().min(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode) return null;
      return calculateWht(
        org.countryCode,
        input.contractorResidency,
        input.serviceType,
        input.grossAmountMinor,
      );
    }),

  /** Generate WHT certificate for a payment run item */
  generateWhtCertificate: tenantProcedure
    .input(z.object({ paymentRunItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return createWhtCertificate({
        db: ctx.db,
        organizationId: ctx.organizationId,
        paymentRunItemId: input.paymentRunItemId,
        generatedByUserId: ctx.user.id,
      });
    }),

  /** List WHT certificates for the org */
  listWhtCertificates: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .query(async ({ ctx }) => {
      return listWhtCertificates(ctx.organizationId, ctx.db);
    }),

  /** Get a single WHT certificate by ID */
  getWhtCertificate: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ certificateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const cert = await ctx.db.whtCertificate.findUnique({
        where: { id: input.certificateId },
      });
      if (!cert || cert.organizationId !== ctx.organizationId) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      return cert;
    }),

  /** Get tax obligation summary for the compliance dashboard */
  taxSummary: tenantProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // VAT collected (from approved/paid invoices this period)
    const vatCollected = await ctx.db.invoice.aggregate({
      where: {
        organizationId: ctx.organizationId,
        issueDate: { gte: startOfPeriod, lte: endOfPeriod },
        status: { in: ['APPROVED', 'READY_FOR_PAYMENT', 'PAID', 'PARTIALLY_PAID'] },
        vatAmountMinor: { not: null },
      },
      _sum: { vatAmountMinor: true },
    });

    // VAT owed (from received/under_review invoices this period)
    const vatOwed = await ctx.db.invoice.aggregate({
      where: {
        organizationId: ctx.organizationId,
        issueDate: { gte: startOfPeriod, lte: endOfPeriod },
        status: { in: ['RECEIVED', 'UNDER_REVIEW', 'APPROVAL_PENDING'] },
        vatAmountMinor: { not: null },
      },
      _sum: { vatAmountMinor: true },
    });

    // WHT withheld this period (certificates issued in the window)
    const whtCerts = await ctx.db.whtCertificate.findMany({
      where: {
        organizationId: ctx.organizationId,
        generatedAt: { gte: startOfPeriod, lte: endOfPeriod },
      },
      select: { whtAmountMinor: true },
    });
    const whtWithheld = whtCerts.reduce((sum, c) => sum + c.whtAmountMinor, 0);
    const whtCertCount = whtCerts.length;

    // Pending WHT: items in period with WHT that still lack any linked certificate
    const itemsWithWht = await ctx.db.paymentRunItem.findMany({
      where: {
        organizationId: ctx.organizationId,
        whtAmountMinor: { gt: 0 },
        createdAt: { gte: startOfPeriod, lte: endOfPeriod },
      },
      select: { id: true, whtAmountMinor: true },
    });
    const itemIds = itemsWithWht.map(i => i.id);
    const linkedCerts =
      itemIds.length === 0
        ? []
        : await ctx.db.whtCertificate.findMany({
            where: {
              organizationId: ctx.organizationId,
              paymentRunItemId: { in: itemIds },
            },
            select: { paymentRunItemId: true },
          });
    const certedItemIds = new Set(linkedCerts.map(c => c.paymentRunItemId));
    const pendingItems = itemsWithWht.filter(i => !certedItemIds.has(i.id));
    const whtPendingMinor = pendingItems.reduce((sum, i) => sum + (i.whtAmountMinor ?? 0), 0);
    const whtPendingCount = pendingItems.length;

    return {
      vatCollectedMinor: vatCollected._sum.vatAmountMinor ?? 0,
      vatOwedMinor: vatOwed._sum.vatAmountMinor ?? 0,
      vatNetMinor: (vatCollected._sum.vatAmountMinor ?? 0) - (vatOwed._sum.vatAmountMinor ?? 0),
      whtWithheldMinor: whtWithheld,
      whtCertCount,
      whtPendingMinor,
      whtPendingCount,
      periodStart: startOfPeriod.toISOString(),
      periodEnd: endOfPeriod.toISOString(),
    };
  }),
});
