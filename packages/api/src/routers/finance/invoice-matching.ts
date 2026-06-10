/**
 * Invoice matching procedures.
 */

import type { Prisma } from '@contractor-ops/db';
import { entityIdSchema, invoiceManualMatchSchema } from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { runAutoMatch } from '../../services/invoice-matching';
import { applyReverseCharge } from '../../services/reverse-charge.service';

export const invoiceMatchingRouter = router({
  /**
   * Submit an invoice for automatic matching.
   * Validates RECEIVED status, runs auto-match pipeline, creates match result,
   * and updates invoice with matched contractor/contract/status.
   * Uses a transaction for atomicity.
   */
  submitForMatching: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      if (invoice.status !== 'RECEIVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INVOICE_NOT_RECEIVED_STATUS,
        });
      }

      // Read org settings for deviation threshold
      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      const settings = (org?.settingsJson as Record<string, unknown>) ?? {};
      const deviationThreshold = (settings.invoiceDeviationThresholdPercent as number) ?? 10;

      // Run auto-match
      const matchResult = await runAutoMatch(
        ctx.db,
        ctx.organizationId,
        {
          id: invoice.id,
          sellerTaxId: invoice.sellerTaxId,
          totalMinor: invoice.totalMinor,
          currency: invoice.currency,
          duplicateCheckHash: invoice.duplicateCheckHash,
          issueDate: invoice.issueDate,
          servicePeriodStart: invoice.servicePeriodStart,
          servicePeriodEnd: invoice.servicePeriodEnd,
        },
        deviationThreshold,
      );

      // Auto-detect reverse charge when matched to a contractor
      let reverseChargeUpdate: { isReverseCharge: boolean } | undefined;
      if (matchResult.contractorId) {
        const rcResult = await applyReverseCharge({
          organizationId: ctx.organizationId,
          contractorId: matchResult.contractorId,
          reverseChargeOverride: invoice.reverseChargeOverride,
        });
        reverseChargeUpdate = { isReverseCharge: rcResult.isReverseCharge };
      }

      // Create match result record and update invoice in a transaction
      const updated = await ctx.db.$transaction(async tx => {
        await tx.invoiceMatchResult.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceId: invoice.id,
            matchedContractId: matchResult.contractId,
            matchedContractorId: matchResult.contractorId,
            matchScore: matchResult.score,
            expectedAmountMinor: matchResult.expectedAmountMinor,
            amountDeltaMinor: matchResult.amountDeltaMinor,
            amountDeltaPercent: matchResult.amountDeltaPercent,
            matchedBy: 'RULE_ENGINE',
            status: matchResult.matchStatus,
            explanationJson: {
              flags: matchResult.flags,
              duplicateInvoiceId: matchResult.duplicateInvoiceId,
            },
            createdByUserId: ctx.user?.id,
          },
        });

        const inv = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            contractorId: matchResult.contractorId,
            contractId: matchResult.contractId,
            matchStatus: matchResult.matchStatus,
            status: 'UNDER_REVIEW',
            flagsJson: matchResult.flags.length > 0 ? matchResult.flags : undefined,
            ...reverseChargeUpdate,
          },
        });

        return inv;
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Manually match an invoice to a contractor and optionally a contract.
   * Creates a MANUALLY_CONFIRMED match result.
   */
  manualMatch: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(invoiceManualMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      // Validate contractor belongs to org
      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.contractorId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_CONTRACTOR_NOT_FOUND,
        });
      }

      // Validate contract belongs to org (if provided)
      if (input.contractId) {
        const contract = await ctx.db.contract.findFirst({
          where: {
            id: input.contractId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (!contract) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.INVOICE_CONTRACT_NOT_FOUND,
          });
        }
      }

      // Auto-detect reverse charge for manual match
      const rcResult = await applyReverseCharge({
        organizationId: ctx.organizationId,
        contractorId: input.contractorId,
      });

      const updated = await ctx.db.$transaction(async tx => {
        // Create manual match result
        await tx.invoiceMatchResult.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceId: input.invoiceId,
            matchedContractId: input.contractId ?? null,
            matchedContractorId: input.contractorId,
            matchScore: 100,
            matchedBy: 'MANUAL',
            status: 'MANUALLY_CONFIRMED',
            createdByUserId: ctx.user?.id,
          },
        });

        const inv = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            contractorId: input.contractorId,
            contractId: input.contractId ?? null,
            matchStatus: 'MANUALLY_CONFIRMED',
            isReverseCharge: rcResult.isReverseCharge,
          },
        });

        return inv;
      });

      return updated;
    }),

  /**
   * Dismiss a duplicate flag from an invoice's flagsJson.
   * Removes DUPLICATE_SUSPECTED from the flags array.
   */
  dismissDuplicate: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      const currentFlags = Array.isArray(invoice.flagsJson) ? (invoice.flagsJson as string[]) : [];
      const updatedFlags = currentFlags.filter(f => f !== 'DUPLICATE_SUSPECTED');

      const updated = await ctx.db.invoice.update({
        where: { id: input.id },
        data: {
          flagsJson: updatedFlags.length > 0 ? updatedFlags : undefined,
        },
      });

      return updated;
    }),

  /**
   * Search contractors by legalName or taxId (for manual matching UI).
   * Empty query returns the first `take` contractors (browse list); non-empty
   * query filters case-insensitively on name or NIP.
   */
  searchContractors: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        query: z.string().max(100).default(''),
        // Bound autocomplete to a documented cap. Default 10 keeps dropdown
        // UX snappy; max 200 leaves headroom for rare bulk uses.
        take: z.number().int().min(1).max(200).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const trimmed = input.query.trim();
      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (trimmed.length > 0) {
        where.OR = [
          { legalName: { contains: trimmed, mode: 'insensitive' } },
          { taxId: { contains: trimmed, mode: 'insensitive' } },
        ];
      }

      const contractors = await ctx.db.contractor.findMany({
        where,
        select: {
          id: true,
          legalName: true,
          taxId: true,
          status: true,
        },
        take: input.take,
        orderBy: { legalName: 'asc' },
      });

      return contractors;
    }),

  /**
   * Get active/expiring contracts for a given contractor (for manual matching UI).
   */
  contractsForContractor: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contracts = await ctx.db.contract.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          rateValueMinor: true,
          currency: true,
        },
      });

      return contracts;
    }),
});
