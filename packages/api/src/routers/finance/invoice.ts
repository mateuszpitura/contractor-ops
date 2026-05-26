import type { Prisma, TaxIdType } from '@contractor-ops/db';
import {
  invoiceCreateSchema,
  invoiceListSchema,
  invoiceManualMatchSchema,
  invoiceUpdateSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { getHmrcVatClient, getViesClient } from '../../gov-api-clients';
import { router } from '../../init';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { deleteCalendarEvent } from '../../services/calendar-event-service';
import { computeDuplicateCheckHash, runAutoMatch } from '../../services/invoice-matching';
import { applyKleinunternehmerOverride } from '../../services/kleinunternehmer.service';
import { dispatch } from '../../services/notification-service';
import type { DE13bServiceType } from '../../services/reverse-charge.service';
import { applyReverseCharge, detectReverseCharge } from '../../services/reverse-charge.service';
import { sanitizeStrings } from '../../services/sanitize';
import { isValidationFresh, validateTaxId } from '../../services/tax-id-validation.service';
import { getDefaultRateCode } from '../../services/tax-rate.service';

// ---------------------------------------------------------------------------
// Finance team helper
// ---------------------------------------------------------------------------

/**
 * Queries organization members with FINANCE_ADMIN role and returns their user IDs.
 */
async function getFinanceTeamUserIds(db: TenantScopedDb, orgId: string): Promise<string[]> {
  const members = await db.member.findMany({
    where: {
      organizationId: orgId,
      role: 'FINANCE_ADMIN',
    },
    select: { userId: true },
  });
  return members.map((m: { userId: string }) => m.userId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Invoice update helpers
// ---------------------------------------------------------------------------

const INVOICE_DATE_FIELDS = [
  'issueDate',
  'dueDate',
  'servicePeriodStart',
  'servicePeriodEnd',
] as const;

/**
 * Converts date string fields to Date objects in-place.
 */
function coerceInvoiceDateFields(data: Record<string, unknown>) {
  for (const field of INVOICE_DATE_FIELDS) {
    if (data[field]) {
      data[field] = new Date(data[field] as string);
    }
  }
}

/**
 * Validates that the service period end is not before start,
 * merging with existing values if only one is provided.
 */
function validateServicePeriod(
  updateData: Record<string, unknown>,
  existing: { servicePeriodStart: Date | null; servicePeriodEnd: Date | null },
) {
  const effectiveStart =
    (updateData.servicePeriodStart as Date | undefined) ?? existing.servicePeriodStart;
  const effectiveEnd =
    (updateData.servicePeriodEnd as Date | undefined) ?? existing.servicePeriodEnd;

  if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.SERVICE_PERIOD_END_BEFORE_START,
    });
  }
}

/**
 * Validates arithmetic consistency of invoice amounts.
 * subtotal + vat - withholding = total, and amountToPay = total.
 */
function validateInvoiceAmounts(
  updateData: Record<string, unknown>,
  existing: {
    subtotalMinor: number;
    vatAmountMinor: number | null;
    totalMinor: number;
    withholdingMinor: number | null;
    amountToPayMinor: number;
  },
) {
  const hasAmountChange =
    updateData.subtotalMinor !== undefined ||
    updateData.vatAmountMinor !== undefined ||
    updateData.totalMinor !== undefined ||
    updateData.withholdingMinor !== undefined ||
    updateData.amountToPayMinor !== undefined;

  if (!hasAmountChange) return;

  const effective = {
    subtotalMinor: (updateData.subtotalMinor as number) ?? existing.subtotalMinor,
    vatAmountMinor: (updateData.vatAmountMinor as number) ?? existing.vatAmountMinor ?? 0,
    totalMinor: (updateData.totalMinor as number) ?? existing.totalMinor,
    withholdingMinor: (updateData.withholdingMinor as number) ?? existing.withholdingMinor ?? 0,
    amountToPayMinor: (updateData.amountToPayMinor as number) ?? existing.amountToPayMinor,
  };

  const expectedTotal =
    effective.subtotalMinor + effective.vatAmountMinor - effective.withholdingMinor;

  if (effective.totalMinor !== expectedTotal) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.INVOICE_AMOUNT_MISMATCH,
    });
  }
  if (effective.amountToPayMinor !== effective.totalMinor) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.INVOICE_AMOUNT_MISMATCH,
    });
  }
}

/**
 * Recomputes the duplicate check hash if relevant fields changed.
 */
function recomputeDuplicateHash(
  updateData: Record<string, unknown>,
  existing: { invoiceNumber: string | null; sellerTaxId: string | null; totalMinor: number },
) {
  if (
    !(updateData.invoiceNumber || updateData.sellerTaxId) &&
    updateData.totalMinor === undefined
  ) {
    return;
  }

  const effectiveNumber = (updateData.invoiceNumber as string) ?? existing.invoiceNumber;
  const effectiveTaxId = (updateData.sellerTaxId as string) ?? existing.sellerTaxId;
  const effectiveTotal = (updateData.totalMinor as number) ?? existing.totalMinor;

  if (effectiveNumber && effectiveTaxId) {
    updateData.duplicateCheckHash = computeDuplicateCheckHash(
      effectiveNumber,
      effectiveTaxId,
      effectiveTotal,
    );
  }
}

// ---------------------------------------------------------------------------
// Tax pipeline helpers
// ---------------------------------------------------------------------------

type ContractorTaxSnapshot = {
  id: string;
  countryCode: string;
  vatId: string | null;
  type: string;
  latestVatValidatedAt: Date | null;
  latestVatValidationStatus: string | null;
};

/**
 * Re-validates a contractor's VAT ID if the latest validation is stale (>90 days).
 * Only fires for GB_VAT and DE_USTIDNR types. Soft-fails on upstream outage.
 */
async function revalidateStaleVatIfNeeded(
  contractor: ContractorTaxSnapshot,
  ctx: { organizationId: string; db: TenantScopedDb; userId: string },
): Promise<void> {
  if (!contractor.vatId) return;

  const fresh = isValidationFresh(
    contractor.latestVatValidatedAt
      ? {
          responseStatus: (contractor.latestVatValidationStatus ?? 'unavailable') as
            | 'valid'
            | 'invalid'
            | 'stale'
            | 'unavailable',
          requestedAt: contractor.latestVatValidatedAt,
        }
      : null,
  );
  if (fresh) return;

  const taxIdType: TaxIdType | null =
    contractor.countryCode === 'GB'
      ? 'GB_VAT'
      : contractor.countryCode === 'DE'
        ? 'DE_USTIDNR'
        : null;
  if (!taxIdType) return;

  await validateTaxId(
    {
      organizationId: ctx.organizationId,
      contractorId: contractor.id,
      taxIdType,
      taxIdValue: contractor.vatId,
      actor: { userId: ctx.userId },
    },
    {
      db: ctx.db,
      hmrcClient: getHmrcVatClient(),
      viesClient: getViesClient(),
    },
  );
}

/**
 * Resolves the final reverse-charge flag considering auto-detection and user override.
 */
function resolveReverseCharge(
  contractor: ContractorTaxSnapshot | null,
  orgCountryCode: string | null,
  serviceType: string | undefined,
  userOverride: boolean | null | undefined,
): boolean {
  let rcShouldApply = false;
  if (contractor && orgCountryCode) {
    const rc = detectReverseCharge({
      sellerCountry: contractor.countryCode,
      buyerCountry: orgCountryCode,
      buyerHasVatId: !!contractor.vatId,
      isB2B: contractor.type === 'COMPANY' || contractor.type === 'SOLE_TRADER',
      serviceType: serviceType as DE13bServiceType | undefined,
    });
    rcShouldApply = rc.shouldApply;
  }
  if (userOverride === true) return true;
  if (userOverride === false) return false;
  return rcShouldApply;
}

/**
 * Resolves the effective VAT rate code, applying RC default, country default,
 * and Kleinunternehmer override in order.
 */
async function resolveEffectiveVatRate(
  suppliedRate: string | null | undefined,
  isReverseCharge: boolean,
  org: { countryCode: string | null; isKleinunternehmer: boolean },
  db: TenantScopedDb,
): Promise<string | null> {
  let rate: string | null = suppliedRate ?? null;

  if (!rate) {
    if (isReverseCharge) {
      rate = 'RC';
    } else if (org.countryCode) {
      rate = await getDefaultRateCode(org.countryCode, db);
    }
  }

  if (org.countryCode) {
    const ku = applyKleinunternehmerOverride(
      { vatRate: rate },
      { countryCode: org.countryCode, isKleinunternehmer: org.isKleinunternehmer },
    );
    rate = ku.vatRate || rate;
  }

  return rate;
}

// ---------------------------------------------------------------------------
// Invoice router
// ---------------------------------------------------------------------------

export const invoiceRouter = router({
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
          await writeAuditLog({
            tx,
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user?.id,
            action: 'invoice.reverse-charge-override',
            resourceType: 'INVOICE',
            resourceId: inv.id,
            metadata: {
              reason: invoiceData.reverseChargeOverrideReason,
              autoDetected: true,
              userDisabled: true,
            },
          });
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
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
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
          // Plan 61-08 — per-invoice E-invoice tab consumes lifecycle +
          // append-only event log in one query, avoiding a second roundtrip.
          eInvoiceLifecycle: {
            include: {
              events: {
                orderBy: { createdAt: 'desc' },
                take: 50,
              },
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      return invoice;
    }),

  /**
   * Update an invoice (PATCH semantics).
   * Only allows updates when invoice is in RECEIVED status.
   * Recomputes duplicate check hash on relevant field changes.
   */
  update: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ id: z.string(), data: invoiceUpdateSchema }))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const existing = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

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

  /**
   * Submit an invoice for automatic matching.
   * Validates RECEIVED status, runs auto-match pipeline, creates match result,
   * and updates invoice with matched contractor/contract/status.
   * Uses a transaction for atomicity.
   */
  submitForMatching: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ id: z.string() }))
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
   * Void an invoice (soft status transition to VOID).
   */
  voidInvoice: tenantProcedure
    .use(requirePermission({ invoice: ['delete'] }))
    .input(z.object({ id: z.string() }))
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

      if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'IN_RUN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.INVOICE_VOID_NOT_ALLOWED,
        });
      }

      const updated = await ctx.db.$transaction(async tx => {
        const result = await tx.invoice.updateMany({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            status: { not: 'VOID' },
            paymentStatus: { notIn: ['PAID', 'IN_RUN'] },
          },
          data: {
            status: 'VOID',
            paymentStatus: 'NOT_READY',
            approvalStatus: 'CANCELLED',
            paidAt: null,
            readyForPaymentAt: null,
            approvedAt: null,
          },
        });

        if (result.count === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.INVOICE_VOID_NOT_ALLOWED,
          });
        }

        await tx.approvalStep.updateMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['NOT_STARTED', 'PENDING'] },
            approvalFlow: {
              resourceType: 'INVOICE',
              resourceId: input.id,
            },
          },
          data: {
            status: 'CANCELLED',
            actedAt: new Date(),
          },
        });

        await tx.approvalFlow.updateMany({
          where: {
            organizationId: ctx.organizationId,
            resourceType: 'INVOICE',
            resourceId: input.id,
            status: { in: ['NOT_STARTED', 'PENDING'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            cancelledAt: new Date(),
          },
        });

        return tx.invoice.findFirstOrThrow({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });
      });

      // Calendar cleanup: remove payment deadline event (D-08)
      void deleteCalendarEvent(ctx.db, {
        organizationId: ctx.organizationId,
        entityType: 'INVOICE',
        entityId: input.id,
      }).catch(_err => {
        /* fire-and-forget */
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return updated;
    }),

  /**
   * Dismiss a duplicate flag from an invoice's flagsJson.
   * Removes DUPLICATE_SUSPECTED from the flags array.
   */
  dismissDuplicate: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(z.object({ id: z.string() }))
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
   * Case-insensitive, limit 10 results.
   */
  searchContractors: tenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(
      z.object({
        query: z.string().min(1).max(100),
        // F-DB-09: bound autocomplete to a documented cap. Default 10 keeps
        // dropdown UX snappy; max 200 leaves headroom for rare bulk uses.
        take: z.number().int().min(1).max(200).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const contractors = await ctx.db.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          OR: [
            {
              legalName: { contains: input.query, mode: 'insensitive' },
            },
            {
              taxId: { contains: input.query, mode: 'insensitive' },
            },
          ],
        },
        select: {
          id: true,
          legalName: true,
          taxId: true,
          status: true,
        },
        take: input.take,
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

  /**
   * Toggle reverse charge status on an invoice.
   * Records the override so audit trail distinguishes auto-detected from manual.
   */
  toggleReverseCharge: tenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(
      z.object({
        invoiceId: z.string(),
        isReverseCharge: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.update({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        data: {
          isReverseCharge: input.isReverseCharge,
          reverseChargeOverride: input.isReverseCharge,
        },
      });
      return invoice;
    }),
});
