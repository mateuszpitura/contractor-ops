// packages/api/src/routers/skonto.ts
//
// Phase 63 · Plan 06 · D-27 — Skonto (early payment discount) tRPC router.
// Provides: upsertForInvoice, deleteForInvoice, upsertForBillingProfile,
//           deleteForBillingProfile, evaluateForInvoice.
//
// All procedures are tenant-scoped. Feature-flagged via payments.skonto-enabled.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { plain } from '../lib/plain.js';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../middleware/feature-flag.js';
import { requirePermission } from '../middleware/rbac.js';
import type { SkontoTermData } from '../services/skonto.js';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../services/skonto.js';

const log = createLogger({ service: 'skonto-router' });

// ---------------------------------------------------------------------------
// Shared validation schemas
// ---------------------------------------------------------------------------

const skontoTermInputSchema = z
  .object({
    percent: z.number().gt(0).lte(50),
    discountDays: z.number().int().gte(1),
    netDays: z.number().int().lte(180),
  })
  .refine(d => d.discountDays < d.netDays, {
    message: 'Discount period must be shorter than net period',
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const skontoRouter = router({
  /**
   * Upsert Skonto term for a specific invoice.
   * Creates or updates an invoice-level Skonto term (overrides profile default).
   */
  upsertForInvoice: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z
        .object({
          invoiceId: z.string(),
        })
        .and(skontoTermInputSchema),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify invoice belongs to tenant
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        });
      }

      const term = await ctx.db.skontoTerm.upsert({
        where: { invoiceId: input.invoiceId },
        create: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
          billingProfileId: null,
          discountPercent: input.percent,
          discountPeriodDays: input.discountDays,
          netPeriodDays: input.netDays,
        },
        update: {
          discountPercent: input.percent,
          discountPeriodDays: input.discountDays,
          netPeriodDays: input.netDays,
        },
      });

      log.info({ invoiceId: input.invoiceId, termId: term.id }, 'upserted skonto term for invoice');

      return plain(term);
    }),

  /**
   * Delete invoice-level Skonto term (falls back to profile default).
   */
  deleteForInvoice: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.skontoTerm.findFirst({
        where: {
          invoiceId: input.invoiceId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No Skonto term found for this invoice',
        });
      }

      await ctx.db.skontoTerm.delete({ where: { id: existing.id } });

      log.info({ invoiceId: input.invoiceId }, 'deleted skonto term for invoice');

      return { success: true };
    }),

  /**
   * Upsert Skonto term for a billing profile (default for all invoices under it).
   */
  upsertForBillingProfile: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z
        .object({
          billingProfileId: z.string(),
        })
        .and(skontoTermInputSchema),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify billing profile belongs to tenant
      const profile = await ctx.db.contractorBillingProfile.findFirst({
        where: {
          id: input.billingProfileId,
          organizationId: ctx.organizationId,
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Billing profile not found',
        });
      }

      const term = await ctx.db.skontoTerm.upsert({
        where: { billingProfileId: input.billingProfileId },
        create: {
          organizationId: ctx.organizationId,
          invoiceId: null,
          billingProfileId: input.billingProfileId,
          discountPercent: input.percent,
          discountPeriodDays: input.discountDays,
          netPeriodDays: input.netDays,
        },
        update: {
          discountPercent: input.percent,
          discountPeriodDays: input.discountDays,
          netPeriodDays: input.netDays,
        },
      });

      log.info(
        { billingProfileId: input.billingProfileId, termId: term.id },
        'upserted skonto term for billing profile',
      );

      return plain(term);
    }),

  /**
   * Delete billing-profile-level Skonto term default.
   */
  deleteForBillingProfile: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ billingProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.skontoTerm.findFirst({
        where: {
          billingProfileId: input.billingProfileId,
          organizationId: ctx.organizationId,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No Skonto term found for this billing profile',
        });
      }

      await ctx.db.skontoTerm.delete({ where: { id: existing.id } });

      log.info(
        { billingProfileId: input.billingProfileId },
        'deleted skonto term for billing profile',
      );

      return { success: true };
    }),

  /**
   * Evaluate Skonto eligibility for a specific invoice.
   * Resolves the effective term (invoice-level then profile default) and
   * evaluates eligibility based on payment date vs discount window.
   *
   * `asOf` is intentionally NOT accepted from the client — any downstream
   * decision (auto-applied discount on a payment run, a contractor's
   * claim) must be based on server clock. A client-supplied `asOf` would
   * let a caller coerce the server into reporting "eligible" for a date
   * outside the real discount window.
   */
  evaluateForInvoice: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        invoiceId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        include: {
          contractor: {
            include: {
              billingProfiles: {
                where: { isDefault: true },
                include: { skontoTerms: true },
                take: 1,
              },
            },
          },
          skontoTerms: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invoice not found',
        });
      }

      // Resolve effective skonto term via cascade.
      //
      // Schema note: `Invoice.skontoTerms` and `BillingProfile.skontoTerms`
      // are declared as arrays in Prisma, but `SkontoTerm.invoiceId` and
      // `SkontoTerm.billingProfileId` are both `@unique` — so the
      // cardinality on the SkontoTerm side is at most one. We index `[0]`
      // to recover the singular logical relationship.
      const invoiceSkontoTerm = invoice.skontoTerms[0] ?? null;
      const invoiceTerm = invoiceSkontoTerm
        ? {
            discountPercent: Number(invoiceSkontoTerm.discountPercent),
            discountPeriodDays: invoiceSkontoTerm.discountPeriodDays,
            netPeriodDays: invoiceSkontoTerm.netPeriodDays,
          }
        : null;

      const defaultProfile = invoice.contractor?.billingProfiles?.[0] ?? null;
      const profileSkontoTerm = defaultProfile?.skontoTerms?.[0] ?? null;
      const profileTerm = profileSkontoTerm
        ? {
            discountPercent: Number(profileSkontoTerm.discountPercent),
            discountPeriodDays: profileSkontoTerm.discountPeriodDays,
            netPeriodDays: profileSkontoTerm.netPeriodDays,
          }
        : null;

      const effectiveTerm = resolveSkontoTerm(invoiceTerm, profileTerm) as SkontoTermData | null;

      // Skonto basis = invoice.amountToPayMinor (NOT totalMinor). For invoices
      // with reverse-charge VAT or supplier withholding the two fields differ;
      // the discount must apply against the amount the buyer is actually paying
      // (matches packages/api/src/routers/payment.ts:applySkontoToItem).
      // Fixes B-01 (CR-02 in 63-VERIFICATION.md) — Phase 65 CONTEXT.md D-03.
      const result = evaluateSkontoEligibility({
        invoiceTotalMinor: invoice.amountToPayMinor,
        invoiceIssueDate: invoice.issueDate,
        skontoTerm: effectiveTerm,
        paidAt: invoice.paidAt,
        asOf: new Date(),
      });

      return result;
    }),
});
