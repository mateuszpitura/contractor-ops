// ---------------------------------------------------------------------------
// ZATCA tRPC Router — Device Onboarding & Management
// ---------------------------------------------------------------------------
// Exposes ZATCA onboarding wizard steps as tRPC mutations/queries.
// All mutations require authenticated user with org settings:update permission.
// Per T-48-16: All onboarding mutations require authenticated user with org admin role.
// ---------------------------------------------------------------------------

import { zatcaTaxDetailsSchema } from '@contractor-ops/einvoice';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import {
  exchangeProductionCertificate,
  generateAndStoreCsr,
  getOnboardingState,
  requestComplianceCsid,
  runComplianceChecks,
  saveTaxDetails,
} from '../../services/zatca-onboarding';
import { queueZatcaSubmission } from '../../services/zatca-submission';

// ---------------------------------------------------------------------------
// ZATCA Router
// ---------------------------------------------------------------------------

export const zatcaRouter = router({
  /**
   * Step 1: Save organization tax details for ZATCA onboarding.
   * Validates VAT number format, Arabic org name, and Saudi address.
   */
  saveTaxDetails: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ taxDetails: zatcaTaxDetailsSchema }))
    .mutation(async ({ ctx, input }) => {
      await saveTaxDetails(ctx.organizationId, input.taxDetails, ctx.user.id, ctx.db);
      return { success: true };
    }),

  /**
   * Step 2: Generate ECDSA P-256 CSR with ZATCA-required attributes.
   * Private key is stored in Infisical and never returned to the client.
   * Returns the CSR PEM for UI preview.
   */
  generateCsr: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .mutation(async ({ ctx }) => {
      return generateAndStoreCsr(ctx.organizationId, ctx.db);
    }),

  /**
   * Step 3: Submit CSR to ZATCA and receive compliance CSID.
   * Stores compliance certificate and API secret in Infisical.
   */
  requestComplianceCsid: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(z.object({ otp: z.string().min(4).max(32) }))
    .mutation(async ({ ctx, input }) => {
      return requestComplianceCsid(ctx.organizationId, input.otp, {
        db: ctx.db,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
      });
    }),

  /**
   * Step 4: Submit 6 test invoices to ZATCA compliance endpoint.
   * Returns results for each test invoice (CLEARED/REPORTED/REJECTED).
   */
  runComplianceChecks: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .mutation(async ({ ctx }) => {
      return runComplianceChecks(ctx.organizationId, ctx.db);
    }),

  /**
   * Step 5: Exchange compliance CSID for production certificate.
   * Overwrites compliance credentials with production ones.
   */
  exchangeProductionCert: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .mutation(async ({ ctx }) => {
      await exchangeProductionCertificate(ctx.organizationId, {
        db: ctx.db,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
      });
      return { success: true };
    }),

  /**
   * Query current onboarding wizard state.
   * Returns which step the organization is on and progress flags.
   */
  getOnboardingState: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      return getOnboardingState(ctx.organizationId, ctx.db);
    }),

  // -------------------------------------------------------------------------
  // Submission & Chain Management (Plan 04)
  // -------------------------------------------------------------------------

  /**
   * Get ZATCA submission status for a specific invoice.
   * Per T-48-12: Checks invoice belongs to caller's org.
   */
  getStatus: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chain = await ctx.db.zatcaInvoiceChain.findFirst({
        where: {
          invoiceId: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          icv: true,
          zatcaUuid: true,
          zatcaStatus: true,
          zatcaResponse: true,
          submittedAt: true,
          clearedAt: true,
          reportedAt: true,
          rejectedAt: true,
          rejectionReason: true,
          createdAt: true,
          invoiceHash: true,
          previousHash: true,
        },
      });
      return chain;
    }),

  /**
   * Get the full invoice chain for the organization.
   * Returns recent chain entries with pagination.
   */
  getInvoiceChain: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.zatcaInvoiceChain.findMany({
        where: { organizationId: ctx.organizationId },
        orderBy: { icv: 'desc' },
        select: {
          id: true,
          icv: true,
          invoiceId: true,
          zatcaUuid: true,
          zatcaStatus: true,
          submittedAt: true,
          createdAt: true,
        },
        ...cursorClause(input, 20),
      });

      const { items: entries, nextCursor } = paginateByLastKeptUndefined(rows, input, 20);
      return { entries, nextCursor };
    }),

  /**
   * Resubmit a failed/rejected invoice to ZATCA.
   * Per T-48-12: Checks invoice belongs to caller's org before resubmit.
   */
  resubmit: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify invoice belongs to org
      const chain = await ctx.db.zatcaInvoiceChain.findFirst({
        where: {
          invoiceId: input.invoiceId,
          organizationId: ctx.organizationId,
          zatcaStatus: { in: ['REJECTED', 'PENDING'] },
        },
      });

      if (!chain) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.ZATCA_INVOICE_NOT_RESUBMITTABLE,
        });
      }

      await queueZatcaSubmission(input.invoiceId, ctx.organizationId);
      return { queued: true };
    }),

  /**
   * Get ZATCA compliance statistics for the organization.
   * Returns counts by status for dashboard widget.
   */
  getComplianceStats: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .query(async ({ ctx }) => {
      const [total, cleared, reported, rejected, pending, warning] = await Promise.all([
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId },
        }),
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId, zatcaStatus: 'CLEARED' },
        }),
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId, zatcaStatus: 'REPORTED' },
        }),
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId, zatcaStatus: 'REJECTED' },
        }),
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId, zatcaStatus: 'PENDING' },
        }),
        ctx.db.zatcaInvoiceChain.count({
          where: { organizationId: ctx.organizationId, zatcaStatus: 'WARNING' },
        }),
      ]);

      return { total, cleared, reported, rejected, pending, warning };
    }),
});
