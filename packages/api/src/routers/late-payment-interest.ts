// packages/api/src/routers/late-payment-interest.ts
//
// Phase 63 · Plan 05 · D-27 — Late payment interest tRPC router.
// Provides: getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim.
//
// All procedures are tenant-scoped. Feature-flagged via PAY_LATE_INTEREST_ENABLED.

import { createLogger } from '@contractor-ops/logger';
import {
  LPCDA_CLAIM_FOOTER,
  LPCDA_COMPENSATION_LABEL,
  LPCDA_SECTION_REF,
  LPCDA_STATUTORY_RATE_LABEL,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantFlaggedProcedure } from '../middleware/feature-flag.js';
import { requireFeatureFlag } from '../middleware/feature-flag.js';
import {
  calculateLateInterest,
  getCompensationTier,
} from '../services/late-payment-interest.js';
import { putObjectAndSignDownload, signExistingDownload } from '../services/r2.js';

const log = createLogger({ service: 'late-payment-interest-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

/** Format minor units to a decimal string for PDF display. */
function formatGbp(minor: number): string {
  const pounds = (minor / 100).toFixed(2);
  return `£${pounds}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const latePaymentInterestRouter = router({
  /**
   * Get late payment interest details for a single invoice.
   * Checks feature flag, scope gates, creates compensation tier if needed.
   */
  getForInvoice: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        include: {
          contractor: {
            select: {
              id: true,
              countryCode: true,
              isBusinessCustomer: true,
            },
          },
          payments: true,
          interestCompensation: true,
          interestWaivers: true,
          interestClaims: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Load BoE rate history (global, not tenant-scoped)
      const rateHistory = await ctx.db.boEBaseRateHistory.findMany({
        orderBy: { effectiveFrom: 'desc' },
      });

      // Scope gates
      if (!invoice.contractor) {
        return plain({ applicable: false as const, reason: 'NO_CONTRACTOR' });
      }

      const contractor = invoice.contractor;

      if (contractor.countryCode !== 'GB') {
        return plain({ applicable: false as const, reason: 'NON_GB_INVOICE' });
      }

      if (!contractor.isBusinessCustomer) {
        return plain({ applicable: false as const, reason: 'B2C_TRANSACTION' });
      }

      if (invoice.currency !== 'GBP') {
        return plain({ applicable: false as const, reason: 'NON_GBP_CURRENCY' });
      }

      // Ensure compensation tier exists (idempotent upsert)
      let compensation = invoice.interestCompensation;
      const isOverdue = new Date(invoice.dueDate).getTime() < Date.now();

      if (isOverdue && !compensation) {
        const tierMinor = getCompensationTier(invoice.totalMinor);
        const firstOverdueDate = new Date(
          new Date(invoice.dueDate).getTime() + 24 * 60 * 60 * 1000,
        );

        compensation = await ctx.db.invoiceInterestCompensation.upsert({
          where: { invoiceId: input.invoiceId },
          create: {
            organizationId: ctx.organizationId,
            invoiceId: input.invoiceId,
            tierMinor,
            invoiceTotalAtOverdueMinor: invoice.totalMinor,
            firstOverdueDate,
          },
          update: {},
        });
      }

      // Calculate interest
      const result = calculateLateInterest({
        invoiceTotalMinor: invoice.totalMinor,
        invoiceDueDate: invoice.dueDate,
        currency: invoice.currency,
        contractorCountryCode: contractor.countryCode,
        isBusinessCustomer: contractor.isBusinessCustomer,
        rateHistory: rateHistory.map(r => ({
          effectiveFrom: r.effectiveFrom,
          ratePercent: r.ratePercent,
        })),
        payments: invoice.payments.map(p => ({
          amountMinor: p.amountMinor,
          paidAt: p.paidAt,
        })),
        waivers: invoice.interestWaivers.map(w => ({
          waiveType: w.waiveType,
          revokedAt: w.revokedAt,
        })),
        compensationTierMinor: compensation?.tierMinor ?? null,
        paidAt: invoice.paidAt,
      });

      // Determine waiver and claim status
      const activeWaivers = invoice.interestWaivers.filter(w => w.revokedAt === null);
      const waiverStatus = activeWaivers.length > 0
        ? ('WAIVED' as const)
        : ('NONE' as const);

      const claimStatus = invoice.interestClaims.length > 0
        ? ('CLAIMED' as const)
        : ('NONE' as const);

      return plain({
        ...result,
        compensationId: compensation?.id ?? null,
        waiverStatus,
        claimStatus,
        waivers: activeWaivers.map(w => ({
          id: w.id,
          waiveType: w.waiveType,
          reason: w.reason,
          waivedAt: w.waivedAt,
        })),
        claims: invoice.interestClaims.map(c => ({
          id: c.id,
          claimedAt: c.claimedAt,
          snapshotInterestMinor: c.snapshotInterestMinor,
          snapshotCompensationMinor: c.snapshotCompensationMinor,
        })),
      });
    }),

  /**
   * Paginated list of overdue GB B2B invoices with computed interest for the org.
   */
  getForOrg: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        status: z.enum(['ALL', 'ACCRUING', 'CLAIMED', 'WAIVED']).optional(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pageSize = 20;

      // Find overdue GB B2B invoices
      const invoices = await ctx.db.invoice.findMany({
        where: {
          organizationId: ctx.organizationId,
          currency: 'GBP',
          dueDate: { lt: new Date() },
          paymentStatus: { not: 'PAID' },
          deletedAt: null,
          contractor: {
            countryCode: 'GB',
            isBusinessCustomer: true,
          },
        },
        include: {
          contractor: {
            select: { id: true, countryCode: true, isBusinessCustomer: true },
          },
          payments: true,
          interestCompensation: true,
          interestWaivers: true,
          interestClaims: true,
        },
        orderBy: { dueDate: 'asc' },
        take: pageSize + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = invoices.length > pageSize;
      const items = invoices.slice(0, pageSize);

      // Load BoE rate history once
      const rateHistory = await ctx.db.boEBaseRateHistory.findMany({
        orderBy: { effectiveFrom: 'desc' },
      });

      const results = items.map(invoice => {
        const result = calculateLateInterest({
          invoiceTotalMinor: invoice.totalMinor,
          invoiceDueDate: invoice.dueDate,
          currency: invoice.currency,
          contractorCountryCode: invoice.contractor?.countryCode ?? null,
          isBusinessCustomer: invoice.contractor?.isBusinessCustomer ?? false,
          rateHistory: rateHistory.map(r => ({
            effectiveFrom: r.effectiveFrom,
            ratePercent: r.ratePercent,
          })),
          payments: invoice.payments.map(p => ({
            amountMinor: p.amountMinor,
            paidAt: p.paidAt,
          })),
          waivers: invoice.interestWaivers.map(w => ({
            waiveType: w.waiveType,
            revokedAt: w.revokedAt,
          })),
          compensationTierMinor: invoice.interestCompensation?.tierMinor ?? null,
          paidAt: invoice.paidAt,
        });

        const activeWaivers = invoice.interestWaivers.filter(w => w.revokedAt === null);
        const isClaimed = invoice.interestClaims.length > 0;
        const isWaived = activeWaivers.length > 0;

        let status: 'ACCRUING' | 'CLAIMED' | 'WAIVED' = 'ACCRUING';
        if (isClaimed) status = 'CLAIMED';
        else if (isWaived) status = 'WAIVED';

        return {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          dueDate: invoice.dueDate,
          status,
          ...result,
        };
      });

      // Filter by status if requested
      const filtered =
        input.status && input.status !== 'ALL'
          ? results.filter(r => r.status === input.status)
          : results;

      return plain({
        items: filtered,
        nextCursor: hasMore ? items[items.length - 1]?.id : null,
      });
    }),

  /**
   * Waive statutory interest and/or compensation for an invoice.
   * Requires a reason of at least 10 characters for audit trail.
   */
  waive: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        waiveType: z.enum(['STATUTORY_INTEREST', 'COMPENSATION', 'BOTH']),
        reason: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify invoice exists and belongs to org
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        select: { id: true },
      });

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Check for existing active waiver of same type
      const existingWaiver = await ctx.db.invoiceInterestWaiver.findFirst({
        where: {
          invoiceId: input.invoiceId,
          organizationId: ctx.organizationId,
          waiveType: input.waiveType,
          revokedAt: null,
        },
      });

      if (existingWaiver) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An active waiver of this type already exists for this invoice',
        });
      }

      const waiver = await ctx.db.invoiceInterestWaiver.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
          waiveType: input.waiveType,
          reason: input.reason,
          waivedByUserId: ctx.user!.id,
          waivedAt: new Date(),
        },
      });

      log.info(
        { invoiceId: input.invoiceId, waiverId: waiver.id, waiveType: input.waiveType },
        'Interest waiver created',
      );

      return plain({ waiverId: waiver.id });
    }),

  /**
   * Revoke an existing interest waiver.
   */
  revokeWaiver: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        waiverId: z.string(),
        revokeReason: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const waiver = await ctx.db.invoiceInterestWaiver.findFirst({
        where: {
          id: input.waiverId,
          organizationId: ctx.organizationId,
          revokedAt: null,
        },
      });

      if (!waiver) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Active waiver not found',
        });
      }

      await ctx.db.invoiceInterestWaiver.update({
        where: { id: input.waiverId },
        data: {
          revokedAt: new Date(),
          revokedByUserId: ctx.user!.id,
          revokeReason: input.revokeReason,
        },
      });

      log.info(
        { waiverId: input.waiverId, invoiceId: waiver.invoiceId },
        'Interest waiver revoked',
      );

      return plain({ revoked: true });
    }),

  /**
   * Create a statutory interest claim with PDF letter and optional secondary invoice.
   */
  claim: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        issueAsSecondaryInvoice: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.invoiceId, organizationId: ctx.organizationId },
        include: {
          contractor: {
            select: {
              id: true,
              countryCode: true,
              isBusinessCustomer: true,
            },
          },
          organization: {
            select: { id: true, name: true },
          },
          payments: true,
          interestCompensation: true,
          interestWaivers: true,
        },
      });

      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Load BoE rate history
      const rateHistory = await ctx.db.boEBaseRateHistory.findMany({
        orderBy: { effectiveFrom: 'desc' },
      });

      // Compute current interest
      const result = calculateLateInterest({
        invoiceTotalMinor: invoice.totalMinor,
        invoiceDueDate: invoice.dueDate,
        currency: invoice.currency,
        contractorCountryCode: invoice.contractor?.countryCode ?? null,
        isBusinessCustomer: invoice.contractor?.isBusinessCustomer ?? false,
        rateHistory: rateHistory.map(r => ({
          effectiveFrom: r.effectiveFrom,
          ratePercent: r.ratePercent,
        })),
        payments: invoice.payments.map(p => ({
          amountMinor: p.amountMinor,
          paidAt: p.paidAt,
        })),
        waivers: invoice.interestWaivers.map(w => ({
          waiveType: w.waiveType,
          revokedAt: w.revokedAt,
        })),
        compensationTierMinor: invoice.interestCompensation?.tierMinor ?? null,
        paidAt: invoice.paidAt,
      });

      if (!result.applicable) {
        throw new TRPCError({
          code: 'FAILED_PRECONDITION',
          message: `Cannot claim interest: ${result.reason}`,
        });
      }

      if (result.totalClaimMinor <= 0) {
        throw new TRPCError({
          code: 'FAILED_PRECONDITION',
          message: 'No interest or compensation to claim',
        });
      }

      // Generate claim PDF using React-PDF
      const { renderToBuffer } = await import('@react-pdf/renderer');
      const { LatePaymentClaimTemplate } = await import(
        '../pdf-templates/late-payment-claim.js'
      );

      const claimId = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const pdfBuffer = await renderToBuffer(
        LatePaymentClaimTemplate({
          organizationName: invoice.organization.name,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDueDate: invoice.dueDate,
          daysOverdue: result.daysOverdue,
          principalOutstandingMinor: result.principalOutstandingMinor,
          rateUsed: result.rateUsed,
          dailyInterestMinor: result.dailyInterestMinor,
          accruedInterestMinor: result.accruedInterestMinor,
          compensationTierMinor: result.compensationTierMinor,
          totalClaimMinor: result.totalClaimMinor,
          claimedAt: new Date(),
        }),
      );

      // Upload PDF to R2
      const pdfKey = `late-interest-claims/${ctx.organizationId}/${input.invoiceId}/${claimId}.pdf`;

      const { signedUrl } = await putObjectAndSignDownload({
        key: pdfKey,
        body: pdfBuffer,
        contentType: 'application/pdf',
        downloadFilename: `late-payment-claim-${invoice.invoiceNumber}.pdf`,
        ttlSeconds: 300,
      });

      // Create claim record
      let secondaryInvoiceId: string | null = null;

      if (input.issueAsSecondaryInvoice) {
        const secondaryInvoice = await ctx.db.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: invoice.contractorId,
            invoiceNumber: `LPC-${invoice.invoiceNumber}`,
            source: 'LATE_INTEREST_CLAIM',
            sourceReference: input.invoiceId,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            currency: 'GBP',
            subtotalMinor: result.totalClaimMinor,
            totalMinor: result.totalClaimMinor,
            amountToPayMinor: result.totalClaimMinor,
            status: 'RECEIVED',
            matchStatus: 'MATCHED',
            notes: `Statutory late payment interest claim for invoice ${invoice.invoiceNumber}. ${LPCDA_SECTION_REF}.`,
          },
        });
        secondaryInvoiceId = secondaryInvoice.id;
      }

      const claim = await ctx.db.invoiceInterestClaim.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
          claimedByUserId: ctx.user!.id,
          claimedAt: new Date(),
          snapshotInterestMinor: result.accruedInterestMinor,
          snapshotCompensationMinor: result.compensationTierMinor,
          snapshotRateUsed: result.rateUsed,
          snapshotDaysOverdue: result.daysOverdue,
          pdfKey,
          secondaryInvoiceId,
        },
      });

      log.info(
        {
          invoiceId: input.invoiceId,
          claimId: claim.id,
          totalClaimMinor: result.totalClaimMinor,
          secondaryInvoiceId,
        },
        'Late payment interest claim created',
      );

      return plain({
        claimId: claim.id,
        pdfUrl: signedUrl,
        secondaryInvoiceId,
      });
    }),

  /**
   * Download a previously generated claim PDF.
   */
  downloadClaim: tenantFlaggedProcedure
    .use(requireFeatureFlag('PAY_LATE_INTEREST_ENABLED'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ claimId: z.string() }))
    .query(async ({ ctx, input }) => {
      const claim = await ctx.db.invoiceInterestClaim.findFirst({
        where: {
          id: input.claimId,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: { select: { invoiceNumber: true } },
        },
      });

      if (!claim) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Claim not found' });
      }

      const { signedUrl } = await signExistingDownload(
        claim.pdfKey,
        300,
        `late-payment-claim-${claim.invoice.invoiceNumber}.pdf`,
      );

      return plain({ downloadUrl: signedUrl });
    }),
});
