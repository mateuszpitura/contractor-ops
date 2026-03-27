import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  contractCreateSchema,
  contractUpdateSchema,
  contractListSchema,
  contractStatusTransitionSchema,
  amendmentCreateSchema,
  contractExpiryReminderSchema,
} from "@contractor-ops/validators";
import * as E from "../errors.js";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";

// ---------------------------------------------------------------------------
// Contract status transition map
// ---------------------------------------------------------------------------

const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "PENDING_SIGNATURE", "TERMINATED"],
  PENDING_SIGNATURE: ["ACTIVE", "SIGNATURE_DECLINED", "SIGNATURE_EXPIRED", "TERMINATED"],
  SIGNATURE_DECLINED: ["PENDING_SIGNATURE", "TERMINATED"],
  SIGNATURE_EXPIRED: ["PENDING_SIGNATURE", "TERMINATED"],
  ACTIVE: ["EXPIRING", "TERMINATED", "SUPERSEDED"],
  EXPIRING: ["ACTIVE", "EXPIRED", "TERMINATED", "SUPERSEDED"],
  EXPIRED: ["TERMINATED", "SUPERSEDED"],
  TERMINATED: [],
  SUPERSEDED: [],
  ARCHIVED: [],
};

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Contract router
// ---------------------------------------------------------------------------

export const contractRouter = router({
  /**
   * Create a new contract with all metadata fields.
   */
  create: tenantProcedure
    .use(requirePermission({ contract: ["create"] }))
    .input(contractCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await prisma.contract.create({
        data: {
          organizationId: ctx.organizationId,
          contractorId: input.contractorId,
          title: input.title,
          type: input.type,
          startDate: new Date(input.startDate),
          endDate: input.endDate ? new Date(input.endDate) : null,
          noticePeriodDays: input.noticePeriodDays ?? null,
          autoRenewal: input.autoRenewal,
          renewalTerms: input.renewalTerms ?? null,
          currency: input.currency,
          billingModel: input.billingModel,
          rateType: input.rateType,
          rateValueGrosze: input.rateValueGrosze ?? null,
          retainerAmountGrosze: input.retainerAmountGrosze ?? null,
          expectedHoursPerPeriod: input.expectedHoursPerPeriod ?? null,
          paymentTermsDays: input.paymentTermsDays ?? null,
          invoiceCycle: input.invoiceCycle ?? null,
          internalOwnerUserId: input.internalOwnerUserId ?? null,
          teamId: input.teamId ?? null,
          projectId: input.projectId ?? null,
          costCenterId: input.costCenterId ?? null,
          notes: input.notes ?? null,
          status: "DRAFT",
        },
        include: {
          contractor: {
            select: { id: true, legalName: true, displayName: true, status: true },
          },
        },
      });

      return plain(contract);
    }),

  /**
   * Get a contract by ID with full relations.
   */
  getById: tenantProcedure
    .use(requirePermission({ contract: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contract = await prisma.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          contractor: {
            select: { id: true, legalName: true, displayName: true, status: true },
          },
          amendments: {
            orderBy: { effectiveDate: "desc" },
          },
          internalOwner: {
            select: { id: true, name: true },
          },
          _count: {
            select: {
              invoices: true,
            },
          },
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      // Count linked documents
      const documentCount = await prisma.documentLink.count({
        where: {
          organizationId: ctx.organizationId,
          entityType: "CONTRACT",
          entityId: contract.id,
        },
      });

      return plain({ ...contract, documentCount });
    }),

  /**
   * Update a contract (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ contract: ["update"] }))
    .input(z.object({ id: z.string(), data: contractUpdateSchema }))
    .mutation(async ({ ctx, input }) => {
      const existing = await prisma.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = { ...input.data };

      // Convert date strings to Date objects if present
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate as string);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate as string);
      }

      // Validate endDate > startDate when both are being updated
      if (updateData.endDate && updateData.startDate) {
        if (updateData.endDate <= updateData.startDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: E.CONTRACT_END_DATE_BEFORE_START,
          });
        }
      }

      const updated = await prisma.contract.update({
        where: { id: input.id },
        data: updateData,
      });

      return plain(updated);
    }),

  /**
   * List contracts with pagination, sorting, filtering, and full-text search.
   */
  list: tenantProcedure
    .use(requirePermission({ contract: ["read"] }))
    .input(contractListSchema)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, sortBy, sortOrder, contractorId, filters } =
        input;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      // Filter by contractorId
      if (contractorId) {
        where.contractorId = contractorId;
      }

      // Apply filters
      if (filters?.status?.length) {
        where.status = { in: filters.status };
      }
      if (filters?.type?.length) {
        where.type = { in: filters.type };
      }
      if (filters?.billingModel?.length) {
        where.billingModel = { in: filters.billingModel };
      }
      if (filters?.ownerUserId?.length) {
        where.internalOwnerUserId = { in: filters.ownerUserId };
      }
      if (filters?.complianceRiskLevel?.length) {
        where.complianceRiskLevel = { in: filters.complianceRiskLevel };
      }

      // End date range filter
      if (filters?.endDateFrom || filters?.endDateTo) {
        where.endDate = {};
        if (filters.endDateFrom) {
          where.endDate.gte = new Date(filters.endDateFrom);
        }
        if (filters.endDateTo) {
          where.endDate.lte = new Date(filters.endDateTo);
        }
      }

      // Full-text search via PostgreSQL tsvector
      if (search && search.length >= 2) {
        const terms = search
          .trim()
          .split(/\s+/)
          .map((t) => t.replace(/[^a-zA-Z0-9\u00C0-\u024F]/g, ""))
          .filter(Boolean)
          .map((t) => `${t}:*`)
          .join(" & ");

        if (terms) {
          const matchingIds: Array<{ id: string }> = await prisma.$queryRaw`
            SELECT id FROM "Contract"
            WHERE "organizationId" = ${ctx.organizationId}
              AND "deletedAt" IS NULL
              AND "searchVector" @@ to_tsquery('simple', ${terms})
          `;

          if (matchingIds.length === 0) {
            return {
              items: [] as Array<Record<string, unknown>>,
              totalCount: 0,
              page,
              pageSize,
            };
          }

          where.id = { in: matchingIds.map((r) => r.id) };
        }
      }

      const [contracts, totalCount] = await Promise.all([
        prisma.contract.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            contractor: {
              select: { id: true, legalName: true, displayName: true },
            },
            internalOwner: {
              select: { id: true, name: true },
            },
          },
        }),
        prisma.contract.count({ where }),
      ]);

      return { items: plain(contracts), totalCount, page, pageSize };
    }),

  /**
   * Transition contract status with state machine validation.
   */
  transitionStatus: tenantProcedure
    .use(requirePermission({ contract: ["update"] }))
    .input(contractStatusTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contract = await prisma.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      const allowedTargets = CONTRACT_TRANSITIONS[contract.status] ?? [];
      if (!allowedTargets.includes(input.targetStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.CONTRACT_INVALID_TRANSITION,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        status: input.targetStatus,
      };

      if (input.targetStatus === "TERMINATED") {
        updateData.terminatedAt = new Date();
      }

      const updated = await prisma.contract.update({
        where: { id: input.id },
        data: updateData,
      });

      return plain(updated);
    }),

  /**
   * Create a contract amendment.
   */
  createAmendment: tenantProcedure
    .use(requirePermission({ contract: ["update"] }))
    .input(amendmentCreateSchema)
    .mutation(async ({ ctx, input }) => {
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
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      // Auto-generate amendment number
      const existingCount = await prisma.contractAmendment.count({
        where: {
          contractId: input.contractId,
          organizationId: ctx.organizationId,
        },
      });

      const amendment = await prisma.contractAmendment.create({
        data: {
          organizationId: ctx.organizationId,
          contractId: input.contractId,
          amendmentNumber: `AME-${existingCount + 1}`,
          title: input.title,
          effectiveDate: new Date(input.effectiveDate),
          description: input.description ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          changesSummaryJson: input.changesSummaryJson as any,
        },
      });

      return plain(amendment);
    }),

  /**
   * List amendments for a contract.
   */
  listAmendments: tenantProcedure
    .use(requirePermission({ contract: ["read"] }))
    .input(z.object({ contractId: z.string() }))
    .query(async ({ ctx, input }) => {
      const amendments = await prisma.contractAmendment.findMany({
        where: {
          contractId: input.contractId,
          organizationId: ctx.organizationId,
        },
        orderBy: { effectiveDate: "desc" },
      });

      return plain(amendments);
    }),

  /**
   * Update per-contract expiry reminder intervals in metadataJson.
   */
  updateExpiryReminders: tenantProcedure
    .use(requirePermission({ contract: ["update"] }))
    .input(contractExpiryReminderSchema)
    .mutation(async ({ ctx, input }) => {
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
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      const currentMetadata =
        (contract.metadataJson as Record<string, unknown>) ?? {};

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMetadata: any = {
        ...currentMetadata,
        reminderDaysBefore: input.reminderDaysBefore,
      };

      const updated = await prisma.contract.update({
        where: { id: input.contractId },
        data: {
          metadataJson: newMetadata,
        },
      });

      return plain(updated);
    }),

  /**
   * Delete a contract (soft-delete, only if DRAFT status).
   */
  delete: tenantProcedure
    .use(requirePermission({ contract: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contract = await prisma.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      if (contract.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Only draft contracts can be deleted. Use status transitions instead.",
        });
      }

      await prisma.contract.update({
        where: { id: input.id },
        data: { deletedAt: new Date() },
      });

      return { success: true };
    }),

  /**
   * Bulk transition multiple contracts to a target status.
   */
  bulkTransition: tenantProcedure
    .use(requirePermission({ contract: ["update"] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
        targetStatus: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const contracts = await prisma.contract.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: { id: true, status: true },
      });

      const valid: string[] = [];
      const failed: string[] = [];

      for (const contract of contracts) {
        const allowedTargets = CONTRACT_TRANSITIONS[contract.status] ?? [];
        if (allowedTargets.includes(input.targetStatus)) {
          valid.push(contract.id);
        } else {
          failed.push(contract.id);
        }
      }

      // Also track IDs not found
      const foundIds = new Set(contracts.map((c) => c.id));
      for (const id of input.ids) {
        if (!foundIds.has(id)) {
          failed.push(id);
        }
      }

      if (valid.length > 0) {
        await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updateData: Record<string, any> = {
            status: input.targetStatus,
          };

          if (input.targetStatus === "TERMINATED") {
            updateData.terminatedAt = new Date();
          }

          await tx.contract.updateMany({
            where: { id: { in: valid } },
            data: updateData,
          });
        });
      }

      return { updated: valid.length, failed };
    }),
});
