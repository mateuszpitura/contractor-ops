import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  contractorCreateSchema,
  contractorUpdateSchema,
  contractorListSchema,
  contractorLifecycleTransitionSchema,
  gusLookupSchema,
  countryFieldsSchemaMap,
  validateTin,
} from "@contractor-ops/validators";
import * as E from "../errors.js";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { encryptBankAccount } from "../services/bank-account-crypto.js";
import { sanitizeStrings } from "../services/sanitize.js";
import { syncSeatCountForOrg } from "../services/billing-service.js";
import { invalidateByPrefix, CacheKeys } from "../services/cache.js";

// ---------------------------------------------------------------------------
// Lifecycle transition map
// ---------------------------------------------------------------------------

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ONBOARDING", "ACTIVE"],
  ONBOARDING: ["ACTIVE", "ENDED"],
  ACTIVE: ["OFFBOARDING", "ENDED"],
  OFFBOARDING: ["ENDED"],
  ENDED: [],
};

// ---------------------------------------------------------------------------
// Compliance health computation
// ---------------------------------------------------------------------------

type HealthFactor = {
  key: "documents" | "contract" | "tasks" | "invoices";
  status: "green" | "yellow" | "red";
  label: string;
  detail?: string;
};

type ComplianceHealthResult = {
  overall: "green" | "yellow" | "red";
  factors: HealthFactor[];
};

function computeComplianceHealth(params: {
  complianceItems: Array<{ status: string; expiresAt: Date | null }>;
  activeContractCount: number;
  expiringContractCount: number;
  overdueTaskCount: number;
  unpaidInvoiceCount: number;
}): ComplianceHealthResult {
  const factors: HealthFactor[] = [];

  // Documents
  const hasMissing = params.complianceItems.some(
    (i) => i.status === "MISSING",
  );
  const hasExpiredOrPending = params.complianceItems.some(
    (i) => i.status === "EXPIRED" || i.status === "PENDING",
  );
  if (hasMissing) {
    factors.push({
      key: "documents",
      status: "red",
      label: "Missing compliance documents",
    });
  } else if (hasExpiredOrPending) {
    factors.push({
      key: "documents",
      status: "yellow",
      label: "Pending or expired compliance documents",
    });
  } else {
    factors.push({
      key: "documents",
      status: "green",
      label: "Documents OK",
    });
  }

  // Contract
  if (params.activeContractCount === 0) {
    factors.push({
      key: "contract",
      status: "red",
      label: "No active contract",
    });
  } else if (params.expiringContractCount > 0) {
    factors.push({
      key: "contract",
      status: "yellow",
      label: "Contract expiring soon",
    });
  } else {
    factors.push({ key: "contract", status: "green", label: "Contract OK" });
  }

  // Tasks (not yet in Phase 2 — default green)
  if (params.overdueTaskCount > 0) {
    factors.push({
      key: "tasks",
      status: "red",
      label: "Overdue tasks",
      detail: `${params.overdueTaskCount} overdue`,
    });
  } else {
    factors.push({ key: "tasks", status: "green", label: "Tasks OK" });
  }

  // Invoices (not yet in Phase 2 — default green)
  if (params.unpaidInvoiceCount > 0) {
    factors.push({
      key: "invoices",
      status: "red",
      label: "Unpaid invoices",
      detail: `${params.unpaidInvoiceCount} unpaid`,
    });
  } else {
    factors.push({ key: "invoices", status: "green", label: "Invoices OK" });
  }

  // Overall: red if any red, yellow if any yellow, green otherwise
  const hasRed = factors.some((f) => f.status === "red");
  const hasYellow = factors.some((f) => f.status === "yellow");
  const overall = hasRed ? "red" : hasYellow ? "yellow" : "green";

  return { overall, factors };
}

/**
 * Simplified health badge for list view: based on compliance item counts only.
 */
function computeListHealthBadge(counts: {
  missingOrExpired: number;
  pending: number;
}): "green" | "yellow" | "red" {
  if (counts.missingOrExpired > 0) return "red";
  if (counts.pending > 0) return "yellow";
  return "green";
}

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Contractor router
// ---------------------------------------------------------------------------

export const contractorRouter = router({
  /**
   * List contractors with pagination, sorting, filtering, and full-text search.
   */
  list: tenantProcedure
    .use(requirePermission({ contractor: ["read"] }))
    .input(contractorListSchema)
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
      if (filters?.lifecycleStage?.length) {
        where.lifecycleStage = { in: filters.lifecycleStage };
      }
      if (filters?.ownerUserId?.length) {
        where.ownerUserId = { in: filters.ownerUserId };
      }
      if (filters?.primaryTeamId?.length) {
        where.primaryTeamId = { in: filters.primaryTeamId };
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
            SELECT id FROM "Contractor"
            WHERE "organizationId" = ${ctx.organizationId}
              AND "deletedAt" IS NULL
              AND "search_vector" @@ to_tsquery('simple', ${terms})
          `;

          if (matchingIds.length === 0) {
            return { items: [] as Array<Record<string, unknown>>, total: 0, page, pageSize };
          }

          where.id = { in: matchingIds.map((r) => r.id) };
        }
      }

      const [contractors, total] = await Promise.all([
        prisma.contractor.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            owner: { select: { id: true, name: true, image: true } },
            primaryTeam: { select: { id: true, name: true } },
            billingProfiles: {
              where: { isDefault: true },
              take: 1,
              select: {
                id: true,
                legalEntityName: true,
                preferredCurrency: true,
                paymentTermsDays: true,
              },
            },
            _count: {
              select: {
                complianceItems: {
                  where: {
                    status: { in: ["MISSING", "EXPIRED"] },
                  },
                },
              },
            },
          },
        }),
        prisma.contractor.count({ where }),
      ]);

      // Compute health badge and get pending counts for each contractor
      const contractorIds = contractors.map((c) => c.id);
      const pendingCounts =
        contractorIds.length > 0
          ? await prisma.contractorComplianceItem.groupBy({
              by: ["contractorId"],
              where: {
                contractorId: { in: contractorIds },
                status: "PENDING",
              },
              _count: true,
            })
          : [];

      const pendingMap = new Map(
        pendingCounts.map((p) => [p.contractorId, p._count]),
      );

      const items = contractors.map((c) => ({
        ...plain(c),
        complianceHealth: computeListHealthBadge({
          missingOrExpired: c._count.complianceItems,
          pending: pendingMap.get(c.id) ?? 0,
        }),
      }));

      // Post-filter by compliance health if requested
      if (filters?.complianceHealth?.length) {
        const filtered = items.filter((i) =>
          filters.complianceHealth!.includes(i.complianceHealth),
        );
        return {
          items: filtered,
          total: filtered.length,
          page,
          pageSize,
        };
      }

      return { items, total, page, pageSize };
    }),

  /**
   * Get a contractor by ID with full relations and computed compliance health.
   */
  getById: tenantProcedure
    .use(requirePermission({ contractor: ["read"] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000,
      );

      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          owner: { select: { id: true, name: true, image: true } },
          primaryTeam: { select: { id: true, name: true } },
          primaryProject: { select: { id: true, name: true } },
          defaultCostCenter: { select: { id: true, name: true } },
          billingProfiles: {
            orderBy: { isDefault: "desc" },
            select: {
              id: true,
              legalEntityName: true,
              billingEmail: true,
              countryCode: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              postalCode: true,
              bankAccountMasked: true,
              bankName: true,
              swiftBic: true,
              preferredCurrency: true,
              paymentTermsDays: true,
              taxId: true,
              vatId: true,
              isDefault: true,
              validFrom: true,
              validTo: true,
            },
          },
          complianceItems: {
            include: {
              contract: { select: { id: true, title: true } },
            },
          },
          contracts: {
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              startDate: true,
              endDate: true,
              billingModel: true,
            },
          },
          _count: {
            select: {
              workflowRuns: true,
              invoices: true,
            },
          },
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      // Count active and expiring contracts
      const activeContractCount = contractor.contracts.filter(
        (c) => c.status === "ACTIVE",
      ).length;
      const expiringContractCount = contractor.contracts.filter(
        (c) =>
          c.status === "ACTIVE" &&
          c.endDate &&
          c.endDate <= thirtyDaysFromNow &&
          c.endDate >= now,
      ).length;

      const health = computeComplianceHealth({
        complianceItems: contractor.complianceItems.map((i) => ({
          status: i.status,
          expiresAt: i.expiresAt,
        })),
        activeContractCount,
        expiringContractCount,
        overdueTaskCount: 0, // Tasks not yet in Phase 2
        unpaidInvoiceCount: 0, // Invoices not yet in Phase 2
      });

      return {
        ...plain(contractor),
        complianceHealth: health,
      };
    }),

  /**
   * Create a new contractor with billing profile.
   */
  create: tenantProcedure
    .use(requirePermission({ contractor: ["create"] }))
    .input(contractorCreateSchema)
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      const contractor = await prisma.$transaction(async (tx) => {
        const created = await tx.contractor.create({
          data: {
            organizationId: ctx.organizationId,
            legalName: companyFields.legalName,
            displayName: companyFields.displayName,
            type: companyFields.type,
            taxId: companyFields.taxId,
            vatId: companyFields.vatId,
            registrationNumber: companyFields.registrationNumber,
            email: companyFields.email,
            phone: companyFields.phone,
            countryCode: companyFields.countryCode,
            currency: companyFields.currency,
            addressLine1: companyFields.addressLine1,
            addressLine2: companyFields.addressLine2,
            city: companyFields.city,
            postalCode: companyFields.postalCode,
            status: "ACTIVE",
            lifecycleStage: "DRAFT",
            ownerUserId,
            primaryTeamId,
            primaryProjectId,
            defaultCostCenterId,
            customFieldsJson: { billingModel, rateValueMinor },
          },
        });

        // Create default billing profile
        const maskedIban = bankAccount
          ? `****${bankAccount.replace(/\s/g, "").slice(-4)}`
          : null;

        await tx.contractorBillingProfile.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: created.id,
            legalEntityName: companyFields.legalName,
            preferredCurrency: companyFields.currency,
            countryCode: companyFields.countryCode,
            bankAccountMasked: maskedIban,
            bankAccountEncrypted: bankAccount
              ? encryptBankAccount(bankAccount.replace(/\s/g, ""))
              : null,
            paymentTermsDays: paymentTermsDays ?? null,
            validFrom: new Date(),
            isDefault: true,
          },
        });

        return created;
      });

      // Fire-and-forget: sync Stripe seat count after new contractor
      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(contractor);
    }),

  /**
   * Update a contractor (PATCH semantics).
   */
  update: tenantProcedure
    .use(requirePermission({ contractor: ["update"] }))
    .input(contractorUpdateSchema.extend({ id: z.string().min(1) }))
    .mutation(async ({ ctx, input: rawInput }) => {
      const input = sanitizeStrings(rawInput);
      const {
        id,
        billingModel,
        rateValueMinor,
        bankAccount,
        paymentTermsDays,
        ownerUserId,
        primaryTeamId,
        primaryProjectId,
        defaultCostCenterId,
        ...companyFields
      } = input;

      // Verify contractor belongs to org
      const existing = await prisma.contractor.findFirst({
        where: {
          id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        ...companyFields,
      };

      if (ownerUserId !== undefined)
        updateData.ownerUserId = ownerUserId ?? null;
      if (primaryTeamId !== undefined)
        updateData.primaryTeamId = primaryTeamId ?? null;
      if (primaryProjectId !== undefined)
        updateData.primaryProjectId = primaryProjectId ?? null;
      if (defaultCostCenterId !== undefined)
        updateData.defaultCostCenterId = defaultCostCenterId ?? null;

      // Update customFieldsJson for billing fields
      if (billingModel !== undefined || rateValueMinor !== undefined) {
        const currentCustom =
          (existing.customFieldsJson as Record<string, unknown>) ?? {};
        updateData.customFieldsJson = {
          ...currentCustom,
          ...(billingModel !== undefined ? { billingModel } : {}),
          ...(rateValueMinor !== undefined ? { rateValueMinor } : {}),
        };
      }

      const updated = await prisma.contractor.update({
        where: { id },
        data: updateData,
      });

      // Update default billing profile if billing fields changed
      if (bankAccount !== undefined || paymentTermsDays !== undefined) {
        const defaultProfile =
          await prisma.contractorBillingProfile.findFirst({
            where: {
              contractorId: id,
              organizationId: ctx.organizationId,
              isDefault: true,
            },
          });

        if (defaultProfile) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profileUpdate: Record<string, any> = {};
          if (bankAccount !== undefined) {
            const cleaned = bankAccount
              ? bankAccount.replace(/\s/g, "")
              : null;
            profileUpdate.bankAccountEncrypted = cleaned
              ? encryptBankAccount(cleaned)
              : null;
            profileUpdate.bankAccountMasked = cleaned
              ? `****${cleaned.slice(-4)}`
              : null;
          }
          if (paymentTermsDays !== undefined) {
            profileUpdate.paymentTermsDays = paymentTermsDays ?? null;
          }
          await prisma.contractorBillingProfile.update({
            where: { id: defaultProfile.id },
            data: profileUpdate,
          });
        }
      }

      return plain(updated);
    }),

  /**
   * Transition contractor lifecycle stage with validation.
   */
  updateLifecycleStage: tenantProcedure
    .use(requirePermission({ contractor: ["update"] }))
    .input(contractorLifecycleTransitionSchema)
    .mutation(async ({ ctx, input }) => {
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      const allowedTargets =
        LEGAL_TRANSITIONS[contractor.lifecycleStage] ?? [];
      if (!allowedTargets.includes(input.stage)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.CONTRACTOR_INVALID_TRANSITION,
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        lifecycleStage: input.stage,
      };

      // Block ENDED transition if contractor has active contracts
      if (input.stage === "ENDED") {
        const activeContracts = await prisma.contract.count({
          where: {
            contractorId: input.id,
            organizationId: ctx.organizationId,
            status: { in: ["ACTIVE", "EXPIRING"] },
            deletedAt: null,
          },
        });

        if (activeContracts > 0) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
          });
        }
      }

      // Side-effects based on target stage
      if (input.stage === "ENDED") {
        updateData.status = "INACTIVE";
      } else if (
        input.stage === "ACTIVE" &&
        contractor.status === "INACTIVE"
      ) {
        updateData.status = "ACTIVE";
      }

      const updated = await prisma.contractor.update({
        where: { id: input.id },
        data: updateData,
      });

      // Sync seat count if status changed (ENDED→INACTIVE or restored→ACTIVE)
      if (updateData.status) {
        void syncSeatCountForOrg(ctx.organizationId);
      }
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(updated);
    }),

  /**
   * Archive a contractor (soft archive).
   */
  archive: tenantProcedure
    .use(requirePermission({ contractor: ["delete"] }))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contractor = await prisma.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      // Block archival if contractor has unpaid invoices
      const unpaidInvoiceCount = await prisma.invoice.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ["PAID", "NOT_READY"] },
        },
      });

      if (unpaidInvoiceCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      // Block archival if contractor has active workflow runs
      const activeWorkflowCount = await prisma.workflowRun.count({
        where: {
          contractorId: input.id,
          status: { in: ["IN_PROGRESS", "BLOCKED"] },
        },
      });

      if (activeWorkflowCount > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: E.CONTRACTOR_HAS_ACTIVE_WORKFLOWS,
        });
      }

      // Block archival if contractor has active contracts
      const activeContracts = await prisma.contract.count({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: { in: ["ACTIVE", "EXPIRING"] },
          deletedAt: null,
        },
      });

      if (activeContracts > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: E.CONTRACTOR_HAS_ACTIVE_CONTRACTS,
        });
      }

      // Auto-reject any pending change requests before archiving
      await prisma.contractorChangeRequest.updateMany({
        where: {
          contractorId: input.id,
          organizationId: ctx.organizationId,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          reviewComment: "Auto-rejected: contractor archived",
        },
      });

      const updated = await prisma.contractor.update({
        where: { id: input.id },
        data: {
          status: "ARCHIVED",
          lifecycleStage: "ENDED",
          archivedAt: new Date(),
        },
      });

      // Fire-and-forget: sync Stripe seat count after archiving
      void syncSeatCountForOrg(ctx.organizationId);
      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(updated);
    }),

  /**
   * Bulk archive multiple contractors.
   */
  bulkArchive: tenantProcedure
    .use(requirePermission({ contractor: ["delete"] }))
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      // Block archival for contractors with unpaid invoices
      const contractorsWithUnpaid = await prisma.invoice.groupBy({
        by: ["contractorId"],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ["PAID", "NOT_READY"] },
        },
      });

      const blockedByUnpaid = new Set(contractorsWithUnpaid.map((i) => i.contractorId).filter(Boolean));

      // Block archival for contractors with active contracts
      const contractorsWithActiveContracts = await prisma.contract.groupBy({
        by: ["contractorId"],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          status: { in: ["ACTIVE", "EXPIRING"] },
          deletedAt: null,
        },
      });

      const blockedByContracts = new Set(contractorsWithActiveContracts.map((c) => c.contractorId).filter(Boolean));
      const blockedIds = new Set([...blockedByUnpaid, ...blockedByContracts]);
      const archivableIds = input.ids.filter((id) => !blockedIds.has(id));

      if (archivableIds.length === 0 && blockedIds.size > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: blockedByContracts.size > 0
            ? E.CONTRACTOR_HAS_ACTIVE_CONTRACTS
            : E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      const result = await prisma.contractor.updateMany({
        where: {
          id: { in: archivableIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: {
          status: "ARCHIVED",
          lifecycleStage: "ENDED",
          archivedAt: new Date(),
        },
      });

      // Fire-and-forget: sync Stripe seat count after bulk archiving
      if (result.count > 0) {
        void syncSeatCountForOrg(ctx.organizationId);
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { count: result.count };
    }),

  /**
   * Bulk assign owner to multiple contractors.
   */
  bulkAssignOwner: tenantProcedure
    .use(requirePermission({ contractor: ["update"] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(100),
        ownerUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await prisma.contractor.updateMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: { ownerUserId: input.ownerUserId },
      });

      return { count: result.count };
    }),

  /**
   * Export contractors as CSV or XLSX (returns base64-encoded file).
   */
  export: tenantProcedure
    .use(requirePermission({ contractor: ["read"] }))
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(500),
        format: z.enum(["csv", "xlsx"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { default: XLSX } = await import("xlsx");

      const contractors = await prisma.contractor.findMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        include: {
          billingProfiles: {
            where: { isDefault: true },
            take: 1,
            select: {
              id: true,
              legalEntityName: true,
              preferredCurrency: true,
              bankAccountMasked: true,
              paymentTermsDays: true,
            },
          },
        },
      });

      const rows = contractors.map((c) => ({
        "Legal Name": c.legalName,
        "Display Name": c.displayName,
        Type: c.type,
        "Tax ID": c.taxId ?? "",
        "VAT ID": c.vatId ?? "",
        Email: c.email ?? "",
        Phone: c.phone ?? "",
        Country: c.countryCode,
        Currency: c.currency,
        Status: c.status,
        "Lifecycle Stage": c.lifecycleStage,
        City: c.city ?? "",
        "Postal Code": c.postalCode ?? "",
        "Payment Terms (days)":
          c.billingProfiles[0]?.paymentTermsDays ?? "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Contractors");

      const buffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: input.format === "csv" ? "csv" : "xlsx",
      }) as Buffer;

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `contractors-${timestamp}.${input.format}`;

      return {
        data: buffer.toString("base64"),
        filename,
        mimeType:
          input.format === "csv"
            ? "text/csv"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }),

  /**
   * Look up company data from GUS BIR1 API by NIP.
   */
  gusLookup: tenantProcedure
    .use(requirePermission({ contractor: ["create"] }))
    .input(gusLookupSchema)
    .query(async ({ input }) => {
      const NETWORK_ERROR_CODES = new Set([
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
        "EAI_AGAIN",
      ]);

      const isNetworkError = (err: unknown): boolean => {
        if (err instanceof Error) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code && NETWORK_ERROR_CODES.has(code)) return true;
          if (err.name === "FetchError" || err.name === "AbortError")
            return true;
          if (
            err.message.includes("fetch failed") ||
            err.message.includes("network")
          )
            return true;
        }
        return false;
      };

      const attempt = async () => {
        const birModule = await import("bir1");
        const Bir = birModule.default;
        const bir = new Bir();

        try {
          await bir.login();
          const result = await bir.search({ nip: input.nip });

          if (!result) {
            return { found: false as const };
          }

          // BIR1 returns an object (or array) with company details
          const entity = Array.isArray(result) ? result[0] : result;

          if (!entity) {
            return { found: false as const };
          }

          return {
            found: true as const,
            legalName:
              (entity as Record<string, string>).Nazwa ?? "",
            regon:
              (entity as Record<string, string>).Regon ?? "",
            addressLine1:
              `${(entity as Record<string, string>).Ulica ?? ""} ${(entity as Record<string, string>).NrNieruchomosci ?? ""}`.trim(),
            city:
              (entity as Record<string, string>).Miejscowosc ?? "",
            postalCode:
              (entity as Record<string, string>).KodPocztowy ?? "",
          };
        } finally {
          await bir.logout().catch(() => {
            // Ignore logout errors
          });
        }
      };

      try {
        return await attempt();
      } catch (err) {
        // Retry once after 2s for network errors
        if (isNetworkError(err)) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          try {
            return await attempt();
          } catch {
            return { found: false as const, error: E.GUS_LOOKUP_FAILED };
          }
        }
        return { found: false as const, error: E.GUS_LOOKUP_FAILED };
      }
    }),

  // ---------------------------------------------------------------------------
  // Country-specific compliance fields (Phase 47)
  // ---------------------------------------------------------------------------

  /** Get country-specific field configuration for the org's country */
  getCountryFieldsConfig: tenantProcedure
    .query(async ({ ctx }) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode || !countryFieldsSchemaMap[org.countryCode]) {
        return { hasCountryFields: false, countryCode: org.countryCode };
      }
      const fields = org.countryCode === "AE"
        ? ["freelancePermitNumber", "tradeLicenseNumber", "freeZone", "tradeLicenseExpiry"]
        : ["freelanceSaLicense", "commercialRegistration", "commercialRegistrationExpiry"];
      return { hasCountryFields: true, countryCode: org.countryCode, fields };
    }),

  /** Get country fields for a specific contractor */
  getCountryFields: tenantProcedure
    .input(z.object({ contractorId: z.string() }))
    .query(async ({ ctx, input }) => {
      const contractor = await prisma.contractor.findUnique({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        select: { countryFields: true },
      });
      if (!contractor) throw new TRPCError({ code: "NOT_FOUND" });
      return contractor.countryFields ?? {};
    }),

  /** Update country fields for a contractor (validated per org country) */
  updateCountryFields: tenantProcedure
    .use(requirePermission({ contractor: ["update"] }))
    .input(z.object({
      contractorId: z.string(),
      countryCode: z.string().length(2),
      fields: z.record(z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
        select: { countryCode: true },
      });
      if (!org.countryCode) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Organization has no country set" });
      }
      const schema = countryFieldsSchemaMap[org.countryCode];
      if (!schema) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `No country-specific fields defined for ${org.countryCode}`,
        });
      }
      const parsed = schema.safeParse(input.fields);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid country fields: ${parsed.error.message}`,
        });
      }
      return prisma.contractor.update({
        where: { id: input.contractorId, organizationId: ctx.organizationId },
        data: { countryFields: parsed.data as object },
      });
    }),

  /** Validate a TIN for a given country */
  validateTin: tenantProcedure
    .input(z.object({
      countryCode: z.string().length(2),
      tin: z.string().min(1),
    }))
    .query(({ input }) => {
      const valid = validateTin(input.countryCode, input.tin);
      return { valid };
    }),
});
