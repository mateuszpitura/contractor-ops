// Skonto (early payment discount) tRPC router.
// Provides: upsertForInvoice, deleteForInvoice, upsertForBillingProfile,
//           deleteForBillingProfile, evaluateForInvoice.
//
// All procedures are tenant-scoped. Feature-flagged via payments.skonto-enabled.

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  BILLING_PROFILE_NOT_FOUND,
  INVOICE_NOT_FOUND,
  SKONTO_DISCOUNT_PERIOD_INVALID,
} from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../../middleware/feature-flag';
import { requirePermission } from '../../middleware/rbac';
import type { SkontoTermData } from '../../services/skonto';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../../services/skonto';

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
    message: SKONTO_DISCOUNT_PERIOD_INVALID,
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Owner reference for a SkontoTerm — exactly one of invoice / billing profile. */
type SkontoTermOwner = { invoiceId: string } | { billingProfileId: string };

type SkontoTermInput = z.infer<typeof skontoTermInputSchema>;

/**
 * Upsert a SkontoTerm keyed by either invoiceId or billingProfileId. Both
 * keys are unique on the table, so the where-clause discriminator selects the
 * row. The unset side is written as null on create.
 */
async function upsertSkontoTermByOwner(
  db: TenantScopedDb,
  organizationId: string,
  owner: SkontoTermOwner,
  input: SkontoTermInput,
) {
  const data = {
    discountPercent: input.percent,
    discountPeriodDays: input.discountDays,
    netPeriodDays: input.netDays,
  };
  return db.skontoTerm.upsert({
    where: owner,
    create: {
      organizationId,
      invoiceId: 'invoiceId' in owner ? owner.invoiceId : null,
      billingProfileId: 'billingProfileId' in owner ? owner.billingProfileId : null,
      ...data,
    },
    update: data,
  });
}

/**
 * Delete a SkontoTerm matching the given owner reference; throws NOT_FOUND
 * if no row exists. Tenant-scope is enforced by both the soft-delete-extended
 * client and the explicit `organizationId` filter.
 */
async function deleteSkontoTermByOwner(
  db: TenantScopedDb,
  organizationId: string,
  owner: SkontoTermOwner,
  notFoundMessage: string,
) {
  const existing = await findOrThrow(
    () => db.skontoTerm.findFirst({ where: { ...owner, organizationId } }),
    notFoundMessage,
  );
  await db.skontoTerm.delete({ where: { id: existing.id } });
}

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
      await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
            where: { id: input.invoiceId, organizationId: ctx.organizationId },
          }),
        INVOICE_NOT_FOUND,
      );

      const term = await upsertSkontoTermByOwner(
        ctx.db,
        ctx.organizationId,
        { invoiceId: input.invoiceId },
        input,
      );

      log.info({ invoiceId: input.invoiceId, termId: term.id }, 'upserted skonto term for invoice');

      return term;
    }),

  /**
   * Delete invoice-level Skonto term (falls back to profile default).
   */
  deleteForInvoice: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSkontoTermByOwner(
        ctx.db,
        ctx.organizationId,
        { invoiceId: input.invoiceId },
        'No Skonto term found for this invoice',
      );

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
      await findOrThrow(
        () =>
          ctx.db.contractorBillingProfile.findFirst({
            where: {
              id: input.billingProfileId,
              organizationId: ctx.organizationId,
            },
          }),
        BILLING_PROFILE_NOT_FOUND,
      );

      const term = await upsertSkontoTermByOwner(
        ctx.db,
        ctx.organizationId,
        { billingProfileId: input.billingProfileId },
        input,
      );

      log.info(
        { billingProfileId: input.billingProfileId, termId: term.id },
        'upserted skonto term for billing profile',
      );

      return term;
    }),

  /**
   * Delete billing-profile-level Skonto term default.
   */
  deleteForBillingProfile: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.skonto-enabled'))
    .use(requirePermission({ contractor: ['update'] }))
    .input(z.object({ billingProfileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteSkontoTermByOwner(
        ctx.db,
        ctx.organizationId,
        { billingProfileId: input.billingProfileId },
        'No Skonto term found for this billing profile',
      );

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
      const invoice = await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
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
          }),
        INVOICE_NOT_FOUND,
      );

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
      // (matches payment.ts:applySkontoToItem).
      const result = evaluateSkontoEligibility({
        invoiceTotalMinor: invoice.amountToPayMinor,
        invoiceIssueDate: invoice.issueDate,
        skontoTerm: effectiveTerm,
        paidAt: invoice.paidAt,
        asOf: new Date(),
      });

      // `paidAt` lets the invoice-detail banner distinguish "discount window
      // still open" from "discount was already applied/missed at payment"
      // without an extra round-trip to fetch the invoice.
      const invoiceTermMapped = invoiceTerm
        ? {
            discountPercent: invoiceTerm.discountPercent,
            discountDays: invoiceTerm.discountPeriodDays,
            netDays: invoiceTerm.netPeriodDays,
          }
        : null;
      const profileDefaultMapped = profileTerm
        ? {
            discountPercent: profileTerm.discountPercent,
            discountDays: profileTerm.discountPeriodDays,
            netDays: profileTerm.netPeriodDays,
          }
        : null;

      return {
        ...result,
        paidAt: invoice.paidAt,
        formTerms: {
          invoiceTerm: invoiceTermMapped,
          profileDefault: profileDefaultMapped,
        },
      };
    }),
});
