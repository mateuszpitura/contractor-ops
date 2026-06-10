/**
 * Invoice CRUD procedures.
 */

import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  entityWithDataSchema,
  invoiceCreateSchema,
  invoiceListSchema,
  invoiceUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { auditedMutation, auditMutationCtx } from '../../lib/audited-mutation';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { computeDuplicateCheckHash } from '../../services/invoice-matching';
import { dispatch } from '../../services/notification-service';
import { sanitizeStrings } from '../../services/sanitize';
import {
  coerceInvoiceDateFields,
  getFinanceTeamUserIds,
  recomputeDuplicateHash,
  resolveEffectiveVatRate,
  resolveReverseCharge,
  revalidateStaleVatIfNeeded,
  validateInvoiceAmounts,
  validateServicePeriod,
  type ContractorTaxSnapshot,
} from './invoice-shared';

export const invoiceCrudRouter = router({


  /**
   * Create a new invoice with linked documents.
   * Sets status to RECEIVED, source to MANUAL_UPLOAD.
   * Computes duplicate check hash when sellerTaxId is available.
   */
  create: tenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .input(invoiceCreateSchema)
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const { documentIds, ...invoiceData } = input;

      // Check for duplicate before creating
      let duplicateCheckHash: string | null = null;
      if (invoiceData.sellerTaxId && invoiceData.invoiceNumber) {
        duplicateCheckHash = computeDuplicateCheckHash(
          invoiceData.invoiceNumber,
          invoiceData.sellerTaxId,
          invoiceData.totalMinor,
        );

        const existing = await ctx.db.invoice.findFirst({
          where: {
            organizationId: ctx.organizationId,
            duplicateCheckHash,
          },
          select: { id: true, invoiceNumber: true },
        });

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: E.INVOICE_DUPLICATE,
          });
        }
      }

      // ---------------------------------------------------------------------
      // Phase 57 · Plan 04 — invoice-line tax pipeline
      // Steps: load org/contractor, staleness revalidation, reverse-charge
      // detection, default-rate preselect, Kleinunternehmer override.
      // ---------------------------------------------------------------------
      const org = await ctx.db.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true, isKleinunternehmer: true },
      });

      let contractor: ContractorTaxSnapshot | null = null;
      if (invoiceData.contractorId) {
        contractor = await ctx.db.contractor.findFirst({
          where: {
            id: invoiceData.contractorId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: {
            id: true,
            countryCode: true,
            vatId: true,
            type: true,
            latestVatValidatedAt: true,
            latestVatValidationStatus: true,
          },
        });

        if (contractor) {
          await revalidateStaleVatIfNeeded(contractor, {
            organizationId: ctx.organizationId,
            db: ctx.db,
            userId: ctx.user?.id,
          });
        }
      }

      const finalIsReverseCharge = resolveReverseCharge(
        contractor,
        org.countryCode,
        invoiceData.serviceType,
        invoiceData.reverseChargeOverride,
      );
      const rcShouldApply = resolveReverseCharge(
        contractor,
        org.countryCode,
        invoiceData.serviceType,
        undefined,
      );

      const effectiveVatRate = await resolveEffectiveVatRate(
        invoiceData.vatRate,
        finalIsReverseCharge,
        org,
        ctx.db,
      );
      // ---------------------------------------------------------------------

      const invoice = await ctx.db.$transaction(async tx => {
        // Create invoice record
        const inv = await tx.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceNumber: invoiceData.invoiceNumber,
            issueDate: new Date(invoiceData.issueDate),
            dueDate: new Date(invoiceData.dueDate),
            servicePeriodStart: invoiceData.servicePeriodStart
              ? new Date(invoiceData.servicePeriodStart)
              : null,
            servicePeriodEnd: invoiceData.servicePeriodEnd
              ? new Date(invoiceData.servicePeriodEnd)
              : null,
            currency: invoiceData.currency,
            subtotalMinor: invoiceData.subtotalMinor,
            vatRate: effectiveVatRate,
            vatAmountMinor: invoiceData.vatAmountMinor ?? null,
            totalMinor: invoiceData.totalMinor,
            withholdingMinor: invoiceData.withholdingMinor ?? null,
            amountToPayMinor: invoiceData.amountToPayMinor,
            sellerTaxId: invoiceData.sellerTaxId ?? null,
            sellerName: invoiceData.sellerName ?? null,
            sellerBankAccount: invoiceData.sellerBankAccount ?? null,
            isReverseCharge: finalIsReverseCharge,
            reverseChargeOverride: invoiceData.reverseChargeOverride ?? null,
            contractorId: contractor?.id ?? null,
            status: 'RECEIVED',
            matchStatus: 'UNMATCHED',
            source: 'MANUAL_UPLOAD',
            duplicateCheckHash,
          },
        });

        // --- Step 6: Override-with-reason audit (D-13) -----------------------
        if (
          invoiceData.reverseChargeOverride === false &&
          rcShouldApply &&
          invoiceData.reverseChargeOverrideReason
        ) {
          await auditedMutation(
            auditMutationCtx(ctx),
            {
              action: 'invoice.reverse-charge-override',
              resourceType: 'INVOICE',
              resourceId: inv.id,
              metadata: {
                reason: invoiceData.reverseChargeOverrideReason,
                autoDetected: true,
                userDisabled: true,
              },
            },
            async () => inv,
            tx,
          );
        }

        // Create InvoiceFile records linking each document
        if (documentIds.length > 0) {
          await tx.invoiceFile.createMany({
            data: documentIds.map(documentId => ({
              organizationId: ctx.organizationId,
              invoiceId: inv.id,
              documentId,
              role: 'SOURCE_ORIGINAL' as const,
            })),
          });
        }

        // Create DocumentLink records with entityType INVOICE
        if (documentIds.length > 0) {
          await tx.documentLink.createMany({
            data: documentIds.map(documentId => ({
              organizationId: ctx.organizationId,
              documentId,
              entityType: 'INVOICE' as const,
              entityId: inv.id,
              linkRole: 'PRIMARY' as const,
            })),
          });
        }

        return inv;
      });

      // Fire-and-forget: dispatch INVOICE_RECEIVED to finance team
      const financeUserIds = await getFinanceTeamUserIds(ctx.db, ctx.organizationId);
      if (financeUserIds.length > 0) {
        dispatch({
          organizationId: ctx.organizationId,
          type: 'INVOICE_RECEIVED',
          recipientUserIds: financeUserIds,
          title: `New invoice received: ${invoice.invoiceNumber}`,
          body: `From ${invoiceData.sellerName ?? 'Unknown'} - ${(invoiceData.totalMinor / 100).toFixed(2)} ${invoiceData.currency}`,
          entityType: 'INVOICE',
          entityId: invoice.id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            contractorName: invoiceData.sellerName ?? 'Unknown',
            amount: (invoiceData.totalMinor / 100).toFixed(2),
            currency: invoiceData.currency,
          },
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return invoice;
    }),


  /**
   * Get an invoice by ID with full relations (contractor, contract, files, match results).
   */
  getById: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      return findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            include: {
              contractor: {
                select: {
                  id: true,
                  legalName: true,
                  taxId: true,
                  countryCode: true,
                  isBusinessCustomer: true,
                },
              },
              contract: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  status: true,
                  rateValueMinor: true,
                  currency: true,
                },
              },
              files: {
                include: {
                  document: {
                    select: {
                      id: true,
                      originalFileName: true,
                      mimeType: true,
                      fileSizeBytes: true,
                      createdAt: true,
                      virusScanStatus: true,
                    },
                  },
                },
              },
              matchResults: {
                orderBy: { createdAt: 'desc' },
              },
              eInvoiceLifecycle: {
                include: {
                  events: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                  },
                },
              },
            },
          }),
        E.INVOICE_NOT_FOUND,
      );
    }),


  /**
   * Update an invoice (PATCH semantics).
   * Only allows updates when invoice is in RECEIVED status.
   * Recomputes duplicate check hash on relevant field changes.
   */
  update: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(entityWithDataSchema(invoiceUpdateSchema))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const existing = await findOrThrow(
        () =>
          ctx.db.invoice.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
          }),
        E.INVOICE_NOT_FOUND,
      );

      if (existing.status !== 'RECEIVED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INVOICE_NOT_RECEIVED_STATUS,
        });
      }

      const updateData: Record<string, unknown> = { ...input.data };

      // Remove documentIds from update data — not a direct Invoice field
      delete updateData.documentIds;

      coerceInvoiceDateFields(updateData);
      validateServicePeriod(updateData, existing);
      validateInvoiceAmounts(updateData, existing);
      recomputeDuplicateHash(updateData, existing);

      const updated = await ctx.db.invoice.update({
        where: { id: input.id },
        data: updateData,
        select: {
          id: true,
          organizationId: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          servicePeriodStart: true,
          servicePeriodEnd: true,
          currency: true,
          subtotalMinor: true,
          vatRate: true,
          vatAmountMinor: true,
          totalMinor: true,
          withholdingMinor: true,
          amountToPayMinor: true,
          sellerTaxId: true,
          sellerName: true,
          status: true,
          matchStatus: true,
          source: true,
          contractorId: true,
          contractId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return updated;
    }),


  /**
   * List invoices with pagination, sorting, filtering, and search.
   * Search covers invoiceNumber and contractor legalName (case-insensitive).
   */
  list: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(invoiceListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, filters } = input;

      const where: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Apply filters
      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }
      if (filters?.matchStatus?.length) {
        where.matchStatus = { in: filters.matchStatus };
      }
      if (filters?.source?.length) {
        where.source = { in: filters.source };
      }
      if (filters?.contractorId) {
        where.contractorId = filters.contractorId;
      }
      if (filters?.overdue) {
        where.dueDate = { lt: new Date() };
        // Mirror UI helper in columns.tsx: terminal states (PAID/VOID) cannot
        // be "overdue".
        where.status = where.status
          ? { ...(where.status as object), notIn: ['PAID', 'VOID'] }
          : { notIn: ['PAID', 'VOID'] };
      }

      // Search via invoiceNumber OR contractor legalName (case-insensitive)
      if (search && search.length >= 1) {
        where.OR = [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          {
            contractor: {
              legalName: { contains: search, mode: 'insensitive' },
            },
          },
        ];
      }

      const [invoices, total] = await Promise.all([
        ctx.db.invoice.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            contractor: {
              select: { id: true, legalName: true },
            },
            // Plan 61-08 — compliance column on invoices-list needs per-row
            // lifecycle status. `null` when no XRechnung XML has been
            // generated (maps to the `notGenerated` compliance bucket).
            eInvoiceLifecycle: {
              select: { validationStatus: true, transmissionStatus: true },
            },
          },
        }),
        ctx.db.invoice.count({ where }),
      ]);

      return { items: invoices, total, page, pageSize };
    }),


  /**
   * Get invoice status and match status counts for the organization.
   * Returns grouped counts for dashboard widgets.
   */
  statusCounts: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .query(async ({ ctx }) => {
      const [statusGroups, matchStatusGroups] = await Promise.all([
        ctx.db.invoice.groupBy({
          by: ['status'],
          where: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          _count: { id: true },
        }),
        ctx.db.invoice.groupBy({
          by: ['matchStatus'],
          where: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          _count: { id: true },
        }),
      ]);

      const counts: Record<string, number> = {};

      for (const group of statusGroups) {
        counts[`status:${group.status}`] = group._count.id;
      }

      for (const group of matchStatusGroups) {
        counts[`matchStatus:${group.matchStatus}`] = group._count.id;
      }

      return counts;
    }),
});
