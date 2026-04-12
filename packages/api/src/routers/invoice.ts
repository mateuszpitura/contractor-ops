import { prisma } from "@contractor-ops/db";
import {
  invoiceCreateSchema,
  invoiceListSchema,
  invoiceManualMatchSchema,
  invoiceUpdateSchema,
} from "@contractor-ops/validators";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as E from "../errors.js";
import { router } from "../init.js";
import { requirePermission } from "../middleware/rbac.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { CacheKeys, invalidateByPrefix } from "../services/cache.js";
import { deleteCalendarEvent } from "../services/calendar-event-service.js";
import { computeDuplicateCheckHash, runAutoMatch } from "../services/invoice-matching.js";
import { dispatch } from "../services/notification-service.js";
import { applyReverseCharge } from "../services/reverse-charge.service.js";
import { sanitizeStrings } from "../services/sanitize.js";

// ---------------------------------------------------------------------------
// Finance team helper
// ---------------------------------------------------------------------------

/**
 * Queries organization members with FINANCE_ADMIN role and returns their user IDs.
 */
async function getFinanceTeamUserIds(orgId: string): Promise<string[]> {
  const members = await prisma.member.findMany({
    where: {
      organizationId: orgId,
      role: "FINANCE_ADMIN",
    },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
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
    .use(requirePermission({ invoice: ["create"] }))
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

        const existing = await prisma.invoice.findFirst({
          where: {
            organizationId: ctx.organizationId,
            duplicateCheckHash,
          },
          select: { id: true, invoiceNumber: true },
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: E.INVOICE_DUPLICATE,
          });
        }
      }

      const invoice = await prisma.$transaction(async (tx) => {
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
            vatRate: invoiceData.vatRate ?? null,
            vatAmountMinor: invoiceData.vatAmountMinor ?? null,
            totalMinor: invoiceData.totalMinor,
            withholdingMinor: invoiceData.withholdingMinor ?? null,
            amountToPayMinor: invoiceData.amountToPayMinor,
            sellerTaxId: invoiceData.sellerTaxId ?? null,
            sellerName: invoiceData.sellerName ?? null,
            sellerBankAccount: invoiceData.sellerBankAccount ?? null,
            isReverseCharge: invoiceData.isReverseCharge ?? false,
            reverseChargeOverride: invoiceData.reverseChargeOverride ?? null,
            status: "RECEIVED",
            matchStatus: "UNMATCHED",
            source: "MANUAL_UPLOAD",
            duplicateCheckHash,
          },
        });

        // Create InvoiceFile records linking each document
        if (documentIds.length > 0) {
          await tx.invoiceFile.createMany({
            data: documentIds.map((documentId) => ({
              organizationId: ctx.organizationId,
              invoiceId: inv.id,
              documentId,
              role: "SOURCE_ORIGINAL" as const,
            })),
          });
        }

        // Create DocumentLink records with entityType INVOICE
        if (documentIds.length > 0) {
          await tx.documentLink.createMany({
            data: documentIds.map((documentId) => ({
              organizationId: ctx.organizationId,
              documentId,
              entityType: "INVOICE" as const,
              entityId: inv.id,
              linkRole: "PRIMARY" as const,
            })),
          });
        }

        return inv;
      });

      // Fire-and-forget: dispatch INVOICE_RECEIVED to finance team
      const financeUserIds = await getFinanceTeamUserIds(ctx.organizationId);
      if (financeUserIds.length > 0) {
        dispatch({
          organizationId: ctx.organizationId,
          type: "INVOICE_RECEIVED",
          recipientUserIds: financeUserIds,
          title: `New invoice received: ${invoice.invoiceNumber}`,
          body: `From ${invoiceData.sellerName ?? "Unknown"} - ${(invoiceData.totalMinor / 100).toFixed(2)} ${invoiceData.currency}`,
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            contractorName: invoiceData.sellerName ?? "Unknown",
            amount: (invoiceData.totalMinor / 100).toFixed(2),
            currency: invoiceData.currency,
          },
        }).catch((err) => console.error("[invoice] dispatch INVOICE_RECEIVED failed:", err));
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(invoice);
    }),

  /**
   * Get an invoice by ID with full relations (contractor, contract, files, match results).
   */
  getById: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          contractor: {
            select: { id: true, legalName: true, taxId: true },
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
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      return plain(invoice);
    }),

  /**
   * Update an invoice (PATCH semantics).
   * Only allows updates when invoice is in RECEIVED status.
   * Recomputes duplicate check hash on relevant field changes.
   */
  update: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ id: z.string(), data: invoiceUpdateSchema }))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const existing = await prisma.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      if (existing.status !== "RECEIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.INVOICE_NOT_RECEIVED_STATUS,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = { ...input.data };

      // Remove documentIds from update data — not a direct Invoice field
      delete updateData.documentIds;

      // Convert date strings to Date objects
      if (updateData.issueDate) {
        updateData.issueDate = new Date(updateData.issueDate as string);
      }
      if (updateData.dueDate) {
        updateData.dueDate = new Date(updateData.dueDate as string);
      }
      if (updateData.servicePeriodStart) {
        updateData.servicePeriodStart = new Date(updateData.servicePeriodStart as string);
      }
      if (updateData.servicePeriodEnd) {
        updateData.servicePeriodEnd = new Date(updateData.servicePeriodEnd as string);
      }

      // Validate service period: end must be >= start (merge with existing values)
      const effectiveStart =
        (updateData.servicePeriodStart as Date | undefined) ?? existing.servicePeriodStart;
      const effectiveEnd =
        (updateData.servicePeriodEnd as Date | undefined) ?? existing.servicePeriodEnd;
      if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Service period end date must be on or after the start date.",
        });
      }

      // Validate arithmetic consistency when any amount field is updated
      if (
        updateData.subtotalMinor !== undefined ||
        updateData.vatAmountMinor !== undefined ||
        updateData.totalMinor !== undefined ||
        updateData.withholdingMinor !== undefined ||
        updateData.amountToPayMinor !== undefined
      ) {
        const effective = {
          subtotalMinor: (updateData.subtotalMinor as number) ?? existing.subtotalMinor,
          vatAmountMinor: (updateData.vatAmountMinor as number) ?? existing.vatAmountMinor ?? 0,
          totalMinor: (updateData.totalMinor as number) ?? existing.totalMinor,
          withholdingMinor:
            (updateData.withholdingMinor as number) ?? existing.withholdingMinor ?? 0,
          amountToPayMinor: (updateData.amountToPayMinor as number) ?? existing.amountToPayMinor,
        };
        const expectedTotal =
          effective.subtotalMinor + effective.vatAmountMinor - effective.withholdingMinor;
        if (effective.totalMinor !== expectedTotal) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.INVOICE_AMOUNT_MISMATCH,
          });
        }
        if (effective.amountToPayMinor !== effective.totalMinor) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.INVOICE_AMOUNT_MISMATCH,
          });
        }
      }

      // Recompute duplicate check hash if relevant fields changed
      if (
        updateData.invoiceNumber ||
        updateData.sellerTaxId ||
        updateData.totalMinor !== undefined
      ) {
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

      const updated = await prisma.invoice.update({
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

      return plain(updated);
    }),

  /**
   * List invoices with pagination, sorting, filtering, and search.
   * Search covers invoiceNumber and contractor legalName (case-insensitive).
   */
  list: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(invoiceListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, filters } = input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
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
          { invoiceNumber: { contains: search, mode: "insensitive" } },
          {
            contractor: {
              legalName: { contains: search, mode: "insensitive" },
            },
          },
        ];
      }

      const [invoices, totalCount] = await Promise.all([
        prisma.invoice.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            contractor: {
              select: { id: true, legalName: true },
            },
          },
        }),
        prisma.invoice.count({ where }),
      ]);

      return { items: plain(invoices), totalCount, page, pageSize };
    }),

  /**
   * Get invoice status and match status counts for the organization.
   * Returns grouped counts for dashboard widgets.
   */
  statusCounts: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .query(async ({ ctx }) => {
      const [statusGroups, matchStatusGroups] = await Promise.all([
        prisma.invoice.groupBy({
          by: ["status"],
          where: {
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          _count: { id: true },
        }),
        prisma.invoice.groupBy({
          by: ["matchStatus"],
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
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      if (invoice.status !== "RECEIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.INVOICE_NOT_RECEIVED_STATUS,
        });
      }

      // Read org settings for deviation threshold
      const org = await prisma.organization.findUnique({
        where: { id: ctx.organizationId },
        select: { settingsJson: true },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const settings = (org?.settingsJson as Record<string, any>) ?? {};
      const deviationThreshold = (settings.invoiceDeviationThresholdPercent as number) ?? 10;

      // Run auto-match
      const matchResult = await runAutoMatch(
        prisma,
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
      const updated = await prisma.$transaction(async (tx) => {
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
            matchedBy: "RULE_ENGINE",
            status: matchResult.matchStatus,
            explanationJson: {
              flags: matchResult.flags,
              duplicateInvoiceId: matchResult.duplicateInvoiceId,
            },
            createdByUserId: ctx.user!.id,
          },
        });

        const inv = await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            contractorId: matchResult.contractorId,
            contractId: matchResult.contractId,
            matchStatus: matchResult.matchStatus,
            status: "UNDER_REVIEW",
            flagsJson: matchResult.flags.length > 0 ? matchResult.flags : undefined,
            ...reverseChargeUpdate,
          },
        });

        return inv;
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(updated);
    }),

  /**
   * Manually match an invoice to a contractor and optionally a contract.
   * Creates a MANUALLY_CONFIRMED match result.
   */
  manualMatch: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(invoiceManualMatchSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      // Validate contractor belongs to org
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.contractorId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_CONTRACTOR_NOT_FOUND,
        });
      }

      // Validate contract belongs to org (if provided)
      if (input.contractId) {
        const contract = await prisma.contract.findFirst({
          where: {
            id: input.contractId,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (!contract) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: E.INVOICE_CONTRACT_NOT_FOUND,
          });
        }
      }

      // Auto-detect reverse charge for manual match
      const rcResult = await applyReverseCharge({
        organizationId: ctx.organizationId,
        contractorId: input.contractorId,
      });

      const updated = await prisma.$transaction(async (tx) => {
        // Create manual match result
        await tx.invoiceMatchResult.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceId: input.invoiceId,
            matchedContractId: input.contractId ?? null,
            matchedContractorId: input.contractorId,
            matchScore: 100,
            matchedBy: "MANUAL",
            status: "MANUALLY_CONFIRMED",
            createdByUserId: ctx.user!.id,
          },
        });

        const inv = await tx.invoice.update({
          where: { id: input.invoiceId },
          data: {
            contractorId: input.contractorId,
            contractId: input.contractId ?? null,
            matchStatus: "MANUALLY_CONFIRMED",
            isReverseCharge: rcResult.isReverseCharge,
          },
        });

        return inv;
      });

      return plain(updated);
    }),

  /**
   * Void an invoice (soft status transition to VOID).
   */
  voidInvoice: tenantProcedure
    .use(requirePermission({ invoice: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      const updated = await prisma.invoice.update({
        where: { id: input.id },
        data: { status: "VOID" },
      });

      // Calendar cleanup: remove payment deadline event (D-08)
      void deleteCalendarEvent(prisma, {
        organizationId: ctx.organizationId,
        entityType: "INVOICE",
        entityId: input.id,
      }).catch((err) => console.error("[invoice] calendar event cleanup on void failed:", err));

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(updated);
    }),

  /**
   * Dismiss a duplicate flag from an invoice's flagsJson.
   * Removes DUPLICATE_SUSPECTED from the flags array.
   */
  dismissDuplicate: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.INVOICE_NOT_FOUND,
        });
      }

      const currentFlags = Array.isArray(invoice.flagsJson) ? (invoice.flagsJson as string[]) : [];
      const updatedFlags = currentFlags.filter((f) => f !== "DUPLICATE_SUSPECTED");

      const updated = await prisma.invoice.update({
        where: { id: input.id },
        data: {
          flagsJson: updatedFlags.length > 0 ? updatedFlags : undefined,
        },
      });

      return plain(updated);
    }),

  /**
   * Search contractors by legalName or taxId (for manual matching UI).
   * Case-insensitive, limit 10 results.
   */
  searchContractors: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const contractors = await prisma.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          OR: [
            {
              legalName: { contains: input.query, mode: "insensitive" },
            },
            {
              taxId: { contains: input.query, mode: "insensitive" },
            },
          ],
        },
        select: {
          id: true,
          legalName: true,
          taxId: true,
          status: true,
        },
        take: 10,
      });

      return plain(contractors);
    }),

  /**
   * Get active/expiring contracts for a given contractor (for manual matching UI).
   */
  contractsForContractor: tenantProcedure
    .use(requirePermission({ invoice: ["read"] }))
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contracts = await prisma.contract.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
          status: { in: ["ACTIVE", "EXPIRING"] },
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

      return plain(contracts);
    }),

  /**
   * Toggle reverse charge status on an invoice.
   * Records the override so audit trail distinguishes auto-detected from manual.
   */
  toggleReverseCharge: tenantProcedure
    .use(requirePermission({ invoice: ["update"] }))
    .input(
      z.object({
        invoiceId: z.string(),
        isReverseCharge: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await prisma.invoice.update({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
        },
        data: {
          isReverseCharge: input.isReverseCharge,
          reverseChargeOverride: input.isReverseCharge,
        },
      });
      return plain(invoice);
    }),
});
