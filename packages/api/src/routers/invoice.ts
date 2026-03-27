import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  invoiceCreateSchema,
  invoiceUpdateSchema,
  invoiceListSchema,
  invoiceManualMatchSchema,
} from "@contractor-ops/validators";
import * as E from "../errors.js";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  computeDuplicateCheckHash,
  runAutoMatch,
} from "../services/invoice-matching.js";
import { dispatch } from "../services/notification-service.js";

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
    .mutation(async ({ ctx, input }) => {
      const { documentIds, ...invoiceData } = input;

      // Compute duplicate check hash if seller info available
      let duplicateCheckHash: string | null = null;
      if (invoiceData.sellerTaxId && invoiceData.invoiceNumber) {
        duplicateCheckHash = computeDuplicateCheckHash(
          invoiceData.invoiceNumber,
          invoiceData.sellerTaxId,
          invoiceData.totalGrosze,
        );
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
            subtotalGrosze: invoiceData.subtotalGrosze,
            vatRate: invoiceData.vatRate ?? null,
            vatAmountGrosze: invoiceData.vatAmountGrosze ?? null,
            totalGrosze: invoiceData.totalGrosze,
            withholdingGrosze: invoiceData.withholdingGrosze ?? null,
            amountToPayGrosze: invoiceData.amountToPayGrosze,
            sellerTaxId: invoiceData.sellerTaxId ?? null,
            sellerName: invoiceData.sellerName ?? null,
            sellerBankAccount: invoiceData.sellerBankAccount ?? null,
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
          body: `From ${invoiceData.sellerName ?? "Unknown"} - ${(invoiceData.totalGrosze / 100).toFixed(2)} ${invoiceData.currency}`,
          entityType: "INVOICE",
          entityId: invoice.id,
          metadata: {
            invoiceNumber: invoice.invoiceNumber,
            contractorName: invoiceData.sellerName ?? "Unknown",
            amount: (invoiceData.totalGrosze / 100).toFixed(2),
            currency: invoiceData.currency,
          },
        }).catch((err) =>
          console.error("[invoice] dispatch INVOICE_RECEIVED failed:", err),
        );
      }

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
              rateValueGrosze: true,
              currency: true,
            },
          },
          files: {
            include: {
              document: true,
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
    .mutation(async ({ ctx, input }) => {
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
        updateData.servicePeriodStart = new Date(
          updateData.servicePeriodStart as string,
        );
      }
      if (updateData.servicePeriodEnd) {
        updateData.servicePeriodEnd = new Date(
          updateData.servicePeriodEnd as string,
        );
      }

      // Recompute duplicate check hash if relevant fields changed
      const invoiceNumber =
        (updateData.invoiceNumber as string) ?? existing.invoiceNumber;
      const sellerTaxId =
        (updateData.sellerTaxId as string) ?? existing.sellerTaxId;
      const totalGrosze =
        (updateData.totalGrosze as number) ?? existing.totalGrosze;

      if (
        sellerTaxId &&
        invoiceNumber &&
        (updateData.invoiceNumber ||
          updateData.sellerTaxId ||
          updateData.totalGrosze !== undefined)
      ) {
        updateData.duplicateCheckHash = computeDuplicateCheckHash(
          invoiceNumber,
          sellerTaxId,
          totalGrosze,
        );
      }

      const updated = await prisma.invoice.update({
        where: { id: input.id },
        data: updateData,
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
      const deviationThreshold =
        (settings.invoiceDeviationThresholdPercent as number) ?? 10;

      // Run auto-match
      const matchResult = await runAutoMatch(
        prisma,
        ctx.organizationId,
        {
          id: invoice.id,
          sellerTaxId: invoice.sellerTaxId,
          totalGrosze: invoice.totalGrosze,
          currency: invoice.currency,
          duplicateCheckHash: invoice.duplicateCheckHash,
          servicePeriodStart: invoice.servicePeriodStart,
          servicePeriodEnd: invoice.servicePeriodEnd,
        },
        deviationThreshold,
      );

      // Create match result record and update invoice in a transaction
      const updated = await prisma.$transaction(async (tx) => {
        await tx.invoiceMatchResult.create({
          data: {
            organizationId: ctx.organizationId,
            invoiceId: invoice.id,
            matchedContractId: matchResult.contractId,
            matchedContractorId: matchResult.contractorId,
            matchScore: matchResult.score,
            expectedAmountGrosze: matchResult.expectedAmountGrosze,
            amountDeltaGrosze: matchResult.amountDeltaGrosze,
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
          },
        });

        return inv;
      });

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

      const currentFlags = Array.isArray(invoice.flagsJson)
        ? (invoice.flagsJson as string[])
        : [];
      const updatedFlags = currentFlags.filter(
        (f) => f !== "DUPLICATE_SUSPECTED",
      );

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
          rateValueGrosze: true,
          currency: true,
        },
      });

      return plain(contracts);
    }),
});
