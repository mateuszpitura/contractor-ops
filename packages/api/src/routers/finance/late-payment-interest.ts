// Late payment interest tRPC router.
// Provides: getForInvoice, getForOrg, waive, revokeWaiver, claim, downloadClaim.
//
// All procedures are tenant-scoped. Feature-flagged via the canonical
// 'payments.late-interest-enabled' flag key.

import { createLogger } from '@contractor-ops/logger';
import { LPCDA_SECTION_REF } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { requireFeatureFlag, tenantFlaggedProcedure } from '../../middleware/feature-flag';
import { requirePermission } from '../../middleware/rbac';
import { loadBoeRateHistory } from '../../services/boe-rate-cache';
import { calculateLateInterest, getCompensationTier } from '../../services/late-payment-interest';
import { signExistingDownload } from '../../services/r2';

const log = createLogger({ service: 'late-payment-interest-router' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format minor units to a decimal string for PDF display. */
function _formatGbp(minor: number): string {
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
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
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
          }),
        'Invoice not found',
      );

      // Load BoE rate history (global, not tenant-scoped) via cache.
      const rateHistory = await loadBoeRateHistory(ctx.db);

      // Scope gates
      if (!invoice.contractor) {
        return { applicable: false as const, reason: 'NO_CONTRACTOR' };
      }

      const contractor = invoice.contractor;

      if (contractor.countryCode !== 'GB') {
        return { applicable: false as const, reason: 'NON_GB_INVOICE' };
      }

      if (!contractor.isBusinessCustomer) {
        return { applicable: false as const, reason: 'B2C_TRANSACTION' };
      }

      if (invoice.currency !== 'GBP') {
        return { applicable: false as const, reason: 'NON_GBP_CURRENCY' };
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
      const waiverStatus = activeWaivers.length > 0 ? ('WAIVED' as const) : ('NONE' as const);

      const claimStatus =
        invoice.interestClaims.length > 0 ? ('CLAIMED' as const) : ('NONE' as const);

      return {
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
          pdfStatus: c.pdfStatus,
          pdfReadyAt: c.pdfReadyAt,
          pdfError: c.pdfError,
        })),
      };
    }),

  /**
   * Paginated list of overdue GB B2B invoices with computed interest for the org.
   */
  getForOrg: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        status: z.enum(['ALL', 'ACCRUING', 'CLAIMED', 'WAIVED']).optional(),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Find overdue GB B2B invoices. Compound order `(dueDate, id)` so
      // the cursor has a deterministic anchor even when multiple invoices
      // share a dueDate.
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
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        ...cursorClause(input, 20),
      });

      const { items, nextCursor } = paginateByLastKept(invoices, input, 20);

      // Load BoE rate history once (cached, invalidated on admin writes).
      const rateHistory = await loadBoeRateHistory(ctx.db);

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

      return {
        items: filtered,
        nextCursor,
      };
    }),

  /**
   * Waive statutory interest and/or compensation for an invoice.
   * Requires a reason of at least 10 characters for audit trail.
   */
  waive: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        waiveType: z.enum(['STATUTORY_INTEREST', 'COMPENSATION', 'BOTH']),
        reason: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED', message: E.UNAUTHORIZED });

      // Verify invoice exists and belongs to org
      await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
            where: { id: input.invoiceId, organizationId: ctx.organizationId },
            select: { id: true },
          }),
        'Invoice not found',
      );

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
          message: E.INVOICE_INTEREST_WAIVER_EXISTS,
        });
      }

      const waiver = await ctx.db.invoiceInterestWaiver.create({
        data: {
          organizationId: ctx.organizationId,
          invoiceId: input.invoiceId,
          waiveType: input.waiveType,
          reason: input.reason,
          waivedByUserId: userId,
          waivedAt: new Date(),
        },
      });

      log.info(
        { invoiceId: input.invoiceId, waiverId: waiver.id, waiveType: input.waiveType },
        'Interest waiver created',
      );

      return { waiverId: waiver.id };
    }),

  /**
   * Revoke an existing interest waiver.
   */
  revokeWaiver: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        waiverId: z.string(),
        revokeReason: z.string().min(10),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const waiver = await findOrThrow(
        () =>
          ctx.db.invoiceInterestWaiver.findFirst({
            where: {
              id: input.waiverId,
              organizationId: ctx.organizationId,
              revokedAt: null,
            },
          }),
        'Active waiver not found',
      );

      await ctx.db.invoiceInterestWaiver.update({
        where: { id: input.waiverId },
        data: {
          revokedAt: new Date(),
          revokedByUserId: ctx.user?.id,
          revokeReason: input.revokeReason,
        },
      });

      log.info(
        { waiverId: input.waiverId, invoiceId: waiver.invoiceId },
        'Interest waiver revoked',
      );

      return { revoked: true };
    }),

  /**
   * Create a statutory interest claim with PDF letter and optional secondary invoice.
   */
  claim: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        issueAsSecondaryInvoice: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED', message: E.UNAUTHORIZED });

      const invoice = await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
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
              interestClaims: { select: { id: true } },
            },
          }),
        'Invoice not found',
      );

      // Duplicate-claim guard: `calculateLateInterest` does not subtract
      // previously claimed amounts, so without this check a caller could
      // fire `claim` repeatedly — producing multiple PDFs and, with
      // issueAsSecondaryInvoice=true, `LPC-*` invoice-number collisions.
      if (invoice.interestClaims.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: E.INTEREST_ALREADY_CLAIMED,
        });
      }

      // Load BoE rate history (cached).
      const rateHistory = await loadBoeRateHistory(ctx.db);

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
          code: 'PRECONDITION_FAILED',
          message: `Cannot claim interest: ${result.reason}`,
        });
      }

      if (result.totalClaimMinor <= 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: E.INTEREST_NOTHING_TO_CLAIM,
        });
      }

      // Create claim record synchronously with pdfStatus=PENDING_RENDER.
      // The actual PDF render + R2 upload runs in a QStash worker (see
      // apps/api/src/routes/late-interest.ts). This keeps the mutation
      // latency bounded — React-PDF + R2 upload can take several seconds
      // on non-trivial claims, which pushed the request against the 30s
      // tRPC timeout. Clients poll `downloadClaim` or watch `pdfStatus`
      // on `getForInvoice`.
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
          claimedByUserId: userId,
          claimedAt: new Date(),
          snapshotInterestMinor: result.accruedInterestMinor,
          snapshotCompensationMinor: result.compensationTierMinor,
          snapshotRateUsed: result.rateUsed,
          snapshotDaysOverdue: result.daysOverdue,
          // pdfKey is null until the worker uploads — the downloadClaim
          // procedure gates on pdfStatus=READY before signing a URL.
          pdfKey: null,
          pdfStatus: 'PENDING_RENDER',
          secondaryInvoiceId,
        },
      });

      // Enqueue the render job. We use dynamic imports so that tests /
      // tooling that load this router without Upstash env vars don't
      // explode at module-load time. Errors here are non-fatal: the claim
      // row is durable and can be re-enqueued manually if needed.
      try {
        const [{ getQStashClient }, { getServerEnv }] = await Promise.all([
          import('@contractor-ops/integrations/services/qstash-client'),
          import('@contractor-ops/validators'),
        ]);
        await getQStashClient().publishJSON({
          url: `${getServerEnv().API_URL}/late-interest/_render-claim-pdf`,
          body: { claimId: claim.id, organizationId: ctx.organizationId },
          retries: 3,
          timeout: '60s',
          // Stable per-claim QStash dedup id so the tRPC retry, the reaper
          // re-enqueue, and the original delivery can't all produce separate
          // QStash messages.
          deduplicationId: `late-interest-pdf-${claim.id}`,
        });
      } catch (err) {
        log.error(
          { err: err instanceof Error ? err.message : String(err), claimId: claim.id },
          'Failed to enqueue claim PDF render job — claim is still persisted',
        );
      }

      log.info(
        {
          invoiceId: input.invoiceId,
          claimId: claim.id,
          totalClaimMinor: result.totalClaimMinor,
          secondaryInvoiceId,
        },
        'Late payment interest claim created (PDF render queued)',
      );

      return {
        claimId: claim.id,
        pdfStatus: 'PENDING_RENDER' as const,
        pdfUrl: null,
        secondaryInvoiceId,
      };
    }),

  /**
   * Download a previously generated claim PDF.
   */
  downloadClaim: tenantFlaggedProcedure
    .use(requireFeatureFlag('payments.late-interest-enabled'))
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ claimId: z.string() }))
    .query(async ({ ctx, input }) => {
      const claim = await findOrThrow(
        () =>
          ctx.db.invoiceInterestClaim.findFirst({
            where: {
              id: input.claimId,
              organizationId: ctx.organizationId,
            },
            include: {
              invoice: { select: { invoiceNumber: true } },
            },
          }),
        'Claim not found',
      );

      // PDF is rendered asynchronously by a QStash worker. The client is
      // expected to poll this procedure; we surface the status verbatim so
      // the UI can show "Generating PDF…" / "Failed" / a download link.
      if (claim.pdfStatus !== 'READY' || !claim.pdfKey) {
        return {
          pdfStatus: claim.pdfStatus,
          pdfError: claim.pdfError,
          downloadUrl: null as string | null,
        };
      }

      const { signedUrl } = await signExistingDownload(
        claim.pdfKey,
        300,
        `late-payment-claim-${claim.invoice.invoiceNumber}.pdf`,
      );

      return {
        pdfStatus: claim.pdfStatus,
        pdfError: null as string | null,
        downloadUrl: signedUrl as string | null,
      };
    }),
});
