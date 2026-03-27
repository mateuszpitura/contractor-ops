/**
 * Import tRPC router for CSV/XLSX file import with parse, validate, and commit endpoints.
 * Supports contractor and contract entity types with column auto-mapping,
 * row validation, duplicate detection, and batch database operations.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  parseImportFile,
  autoMapColumns,
  processImportFile,
} from "../services/import-processor.js";
import * as E from "../errors.js";

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const entityTypeSchema = z.enum(["contractor", "contract"]);

const MAX_BASE64_SIZE = 13_333_334; // 10MB binary (base64 overhead ~33%)

const fileInputSchema = z.object({
  fileBase64: z
    .string()
    .min(1, "File data is required")
    .max(MAX_BASE64_SIZE, "File too large (max ~10MB)"),
  entityType: entityTypeSchema,
});

// ---------------------------------------------------------------------------
// Import router
// ---------------------------------------------------------------------------

export const importRouter = router({
  /**
   * Parse a CSV/XLSX file: extract headers, sample rows, and suggested column mapping.
   * Does not validate or persist data.
   */
  parse: tenantProcedure
    .use(requirePermission({ contractor: ["create"] }))
    .input(fileInputSchema)
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");

      let rows: Record<string, string>[];
      try {
        rows = await parseImportFile(buffer);
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error
              ? err.message
              : "Failed to parse import file",
        });
      }

      if (rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: E.IMPORT_NO_DATA_ROWS,
        });
      }

      const headers = Object.keys(rows[0]!);
      const suggestedMapping = autoMapColumns(headers, input.entityType);
      const sampleRows = rows.slice(0, 5);

      return {
        headers,
        sampleRows,
        suggestedMapping,
        totalRows: rows.length,
      };
    }),

  /**
   * Validate a file with a provided column mapping.
   * Returns full ImportResult with valid/invalid/duplicate row arrays.
   */
  validate: tenantProcedure
    .use(requirePermission({ contractor: ["create"] }))
    .input(
      fileInputSchema.extend({
        columnMapping: z.record(z.string().nullable()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");

      try {
        const result = await processImportFile(
          buffer,
          input.entityType,
          ctx.organizationId,
          input.columnMapping,
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            err instanceof Error
              ? err.message
              : "Failed to process import file",
        });
      }
    }),

  /**
   * Commit validated rows to the database.
   * Supports per-duplicate actions: skip, update, or create.
   * Uses a Prisma transaction for atomicity.
   */
  commit: tenantProcedure
    .use(requirePermission({ contractor: ["create"] }))
    .input(
      z.object({
        entityType: entityTypeSchema,
        rows: z.array(z.record(z.unknown())),
        duplicateActions: z.record(z.enum(["skip", "update", "create"])),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { entityType, rows, duplicateActions } = input;
      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      try {
        await prisma.$transaction(async (tx) => {
          for (const row of rows) {
            const taxId = String(
              row.taxId ?? row.contractorTaxId ?? "",
            ).trim();
            const duplicateAction = duplicateActions[taxId];

            if (entityType === "contractor") {
              if (duplicateAction === "skip") {
                skipped++;
                continue;
              }

              if (duplicateAction === "update") {
                // Find existing contractor and update
                const existing = await tx.contractor.findFirst({
                  where: {
                    organizationId: ctx.organizationId,
                    taxId,
                    deletedAt: null,
                  },
                });

                if (!existing) {
                  failed++;
                  continue;
                }

                await tx.contractor.update({
                  where: { id: existing.id },
                  data: {
                    legalName: String(row.legalName ?? existing.legalName),
                    displayName: String(
                      row.displayName ?? existing.displayName,
                    ),
                    email: String(row.email ?? existing.email),
                    phone: row.phone ? String(row.phone) : existing.phone,
                    countryCode: String(
                      row.countryCode ?? existing.countryCode,
                    ),
                    currency: String(row.currency ?? existing.currency),
                  },
                });
                updated++;
                continue;
              }

              // Create new contractor
              try {
                await tx.contractor.create({
                  data: {
                    organizationId: ctx.organizationId,
                    legalName: String(row.legalName ?? ""),
                    displayName: String(
                      row.displayName ?? row.legalName ?? "",
                    ),
                    type: String(row.type ?? "COMPANY") as
                      | "SOLE_TRADER"
                      | "COMPANY"
                      | "INDIVIDUAL_FREELANCER"
                      | "OTHER",
                    taxId: String(row.taxId ?? ""),
                    vatId: row.vatId ? String(row.vatId) : null,
                    email: String(row.email ?? ""),
                    phone: row.phone ? String(row.phone) : null,
                    countryCode: String(row.countryCode ?? "PL"),
                    currency: String(row.currency ?? "PLN"),
                    status: "ACTIVE",
                    lifecycleStage: "ACTIVE",
                    ownerUserId: ctx.user!.id,
                  },
                });
                created++;
              } catch {
                failed++;
              }
            } else {
              // Contract import
              const contractorId = row.contractorId
                ? String(row.contractorId)
                : null;

              if (!contractorId) {
                // Try resolving by taxId
                const contractor = await tx.contractor.findFirst({
                  where: {
                    organizationId: ctx.organizationId,
                    taxId: String(row.contractorTaxId ?? ""),
                    deletedAt: null,
                  },
                  select: { id: true },
                });
                if (!contractor) {
                  failed++;
                  continue;
                }
                row.contractorId = contractor.id;
              }

              try {
                await tx.contract.create({
                  data: {
                    organizationId: ctx.organizationId,
                    contractorId: String(row.contractorId),
                    title: String(row.title ?? ""),
                    type: String(row.type ?? "OTHER") as
                      | "B2B_MASTER_SERVICE"
                      | "STATEMENT_OF_WORK"
                      | "NDA"
                      | "IP_ASSIGNMENT"
                      | "DPA"
                      | "OTHER",
                    startDate: new Date(String(row.startDate)),
                    endDate: row.endDate
                      ? new Date(String(row.endDate))
                      : null,
                    currency: String(row.currency ?? "PLN"),
                    billingModel: "MONTHLY_RETAINER",
                    rateType: "MONTHLY_FIXED",
                    status: "DRAFT",
                    internalOwnerUserId: ctx.user!.id,
                  },
                });
                created++;
              } catch {
                failed++;
              }
            }
          }
        });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "Import commit failed",
        });
      }

      return { created, updated, skipped, failed };
    }),
});
