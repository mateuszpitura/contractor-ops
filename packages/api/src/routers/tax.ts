import { whtServiceTypeEnum } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { tenantProcedure } from '../middleware/tenant.js';
import {
  calculateWht,
  getTaxRatesForCountry,
  validateVatRateCode,
} from '../services/tax-rate.service.js';
import { createWhtCertificate, listWhtCertificates } from '../services/wht-certificate.service.js';

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
        organizationId: ctx.organizationId,
        paymentRunItemId: input.paymentRunItemId,
        generatedByUserId: ctx.user.id,
      });
    }),

  /** List WHT certificates for the org */
  listWhtCertificates: tenantProcedure.query(async ({ ctx }) => {
    return listWhtCertificates(ctx.organizationId);
  }),

  /** Get a single WHT certificate by ID */
  getWhtCertificate: tenantProcedure
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

    // WHT withheld this period
    const whtCerts = await ctx.db.whtCertificate.findMany({
      where: {
        organizationId: ctx.organizationId,
        generatedAt: { gte: startOfPeriod, lte: endOfPeriod },
      },
      select: { whtAmountMinor: true },
    });
    const whtWithheld = whtCerts.reduce((sum, c) => sum + c.whtAmountMinor, 0);
    const whtCertCount = whtCerts.length;

    // Pending WHT (payment run items with WHT but no certificate)
    const pendingWht = await ctx.db.paymentRunItem.aggregate({
      where: {
        organizationId: ctx.organizationId,
        whtAmountMinor: { gt: 0 },
        createdAt: { gte: startOfPeriod, lte: endOfPeriod },
      },
      _sum: { whtAmountMinor: true },
      _count: true,
    });

    return {
      vatCollectedMinor: vatCollected._sum.vatAmountMinor ?? 0,
      vatOwedMinor: vatOwed._sum.vatAmountMinor ?? 0,
      vatNetMinor: (vatCollected._sum.vatAmountMinor ?? 0) - (vatOwed._sum.vatAmountMinor ?? 0),
      whtWithheldMinor: whtWithheld,
      whtCertCount,
      whtPendingMinor: (pendingWht._sum.whtAmountMinor ?? 0) - whtWithheld,
      whtPendingCount: Math.max(0, (pendingWht._count ?? 0) - whtCertCount),
      periodStart: startOfPeriod.toISOString(),
      periodEnd: endOfPeriod.toISOString(),
    };
  }),
});
