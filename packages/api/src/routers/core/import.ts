/**
 * Import tRPC router for CSV/XLSX file import with parse, validate, and commit endpoints.
 * Supports contractor and contract entity types with column auto-mapping,
 * row validation, duplicate detection, and batch database operations.
 */

import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import type { DbClient } from '../../services/types';

type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

import { mapCountryCodeToJurisdiction } from '@contractor-ops/compliance-policy';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { materialiseFromPolicy } from '../../services/compliance-supersession';
import {
  assertValidContractorTaxId,
  normalizeContractorTaxId,
} from '../../services/contractor-tax-id';
import {
  autoMapColumns,
  parseImportFile,
  processImportFile,
  validateContractorRow,
  validateContractRow,
} from '../../services/import-processor';

const log = createLogger({ service: 'import-router' });

// ---------------------------------------------------------------------------
// Commit helpers
// ---------------------------------------------------------------------------

/** Update an existing contractor matched by tax ID; 'failed' if none found. */
async function updateExistingContractor(
  tx: TxClient,
  organizationId: string,
  row: Record<string, unknown>,
  taxId: string,
): Promise<'updated' | 'failed'> {
  const existing = await tx.contractor.findFirst({
    where: { organizationId, taxId, deletedAt: null },
  });
  if (!existing) return 'failed';

  await tx.contractor.update({
    where: { id: existing.id },
    data: {
      legalName: String(row.legalName ?? existing.legalName),
      displayName: String(row.displayName ?? existing.displayName),
      email: String(row.email ?? existing.email),
      phone: row.phone ? String(row.phone) : existing.phone,
      countryCode: String(row.countryCode ?? existing.countryCode),
      currency: String(row.currency ?? existing.currency),
      taxId,
    },
  });
  return 'updated';
}

/** Create a new contractor + default billing profile; 'failed' on any error. */
async function createContractorFromRow(
  tx: TxClient,
  organizationId: string,
  userId: string | undefined,
  row: Record<string, unknown>,
  taxId: string,
  countryCode: string,
): Promise<'created' | 'failed'> {
  const displayName = String(row.displayName ?? row.legalName ?? '');
  const email = String(row.email ?? '');
  const worker = await tx.worker.create({
    data: {
      organizationId,
      workerType: 'CONTRACTOR',
      displayName,
      email: email || null,
    },
  });
  const created = await tx.contractor.create({
    data: {
      organizationId,
      workerId: worker.id,
      legalName: String(row.legalName ?? ''),
      displayName,
      type: String(row.type ?? 'COMPANY') as
        | 'SOLE_TRADER'
        | 'COMPANY'
        | 'INDIVIDUAL_FREELANCER'
        | 'OTHER',
      taxId,
      vatId: row.vatId ? String(row.vatId) : null,
      email,
      phone: row.phone ? String(row.phone) : null,
      countryCode,
      currency: String(row.currency ?? 'PLN'),
      status: 'ACTIVE',
      lifecycleStage: 'ACTIVE',
      ownerUserId: userId,
    },
  });
  await tx.contractorBillingProfile.create({
    data: {
      organizationId,
      contractorId: created.id,
      legalEntityName: created.legalName,
      billingEmail: created.email,
      countryCode: created.countryCode,
      preferredCurrency: created.currency,
      taxId: created.taxId,
      vatId: created.vatId,
      validFrom: new Date(),
      isDefault: true,
    },
  });

  const jurisdiction = mapCountryCodeToJurisdiction(countryCode);
  if (jurisdiction) {
    const existingItems = await tx.contractorComplianceItem.count({
      where: { organizationId, contractorId: created.id, status: { not: 'WAIVED' } },
    });
    if (existingItems === 0) {
      await materialiseFromPolicy(tx, {
        organizationId,
        contractorId: created.id,
        contractId: null,
        engagement: {
          jurisdiction,
          outcome: '__unclassified__',
          sector: null,
          contractorNationality: countryCode,
          requiresRegulatedEquipment: false,
        },
      });
    }
  }

  return 'created';
}

/**
 * Handles importing a single contractor row: skip, update, or create.
 */
async function commitContractorRow(
  tx: TxClient,
  organizationId: string,
  userId: string | undefined,
  row: Record<string, unknown>,
  duplicateAction: string | undefined,
): Promise<'created' | 'updated' | 'skipped' | 'failed'> {
  const countryCode = String(row.countryCode ?? 'PL');
  const taxId =
    normalizeContractorTaxId(countryCode, String(row.taxId ?? row.contractorTaxId ?? '')) ?? '';
  try {
    assertValidContractorTaxId(countryCode, taxId);
  } catch {
    return 'failed';
  }

  if (duplicateAction === 'skip') return 'skipped';

  if (duplicateAction === 'update') {
    return updateExistingContractor(tx, organizationId, row, taxId);
  }

  return createContractorFromRow(tx, organizationId, userId, row, taxId, countryCode);
}

/**
 * Handles importing a single contract row: resolve contractor and create.
 */
async function commitContractRow(
  tx: TxClient,
  organizationId: string,
  userId: string | undefined,
  row: Record<string, unknown>,
): Promise<'created' | 'updated' | 'skipped' | 'failed'> {
  let contractorId = row.contractorId ? String(row.contractorId) : null;

  if (!contractorId) {
    const countryCode = String(row.countryCode ?? 'PL');
    const taxId = normalizeContractorTaxId(countryCode, String(row.contractorTaxId ?? '')) ?? '';
    const contractor = await tx.contractor.findFirst({
      where: {
        organizationId,
        taxId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!contractor) return 'failed';
    contractorId = contractor.id;
  }

  await tx.contract.create({
    data: {
      organizationId,
      contractorId,
      title: String(row.title ?? ''),
      type: String(row.type ?? 'OTHER') as
        | 'B2B_MASTER_SERVICE'
        | 'STATEMENT_OF_WORK'
        | 'NDA'
        | 'IP_ASSIGNMENT'
        | 'DPA'
        | 'OTHER',
      startDate: new Date(String(row.startDate)),
      endDate: row.endDate ? new Date(String(row.endDate)) : null,
      currency: String(row.currency ?? 'PLN'),
      billingModel: 'MONTHLY_RETAINER',
      rateType: 'MONTHLY_FIXED',
      status: 'DRAFT',
      internalOwnerUserId: userId,
    },
  });
  return 'created';
}

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const entityTypeSchema = z.enum(['contractor', 'contract']);

const MAX_BASE64_SIZE = 13_333_334; // 10MB binary (base64 overhead ~33%)

/**
 * Commit row cap — matches `import-processor.ts` MAX_IMPORT_ROWS so the commit
 * boundary rejects the same oversized payload the parser/validator already
 * reject, rather than opening an unbounded transaction.
 */
const MAX_COMMIT_ROWS = 5000;

const fileInputSchema = z.object({
  fileBase64: z
    .string()
    .min(1, 'File data is required')
    .max(MAX_BASE64_SIZE, 'File too large (max ~10MB)'),
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
    .use(requirePermission({ contractor: ['create'] }))
    .input(fileInputSchema)
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');

      let rows: Record<string, string>[];
      try {
        rows = await parseImportFile(buffer);
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to parse import file',
        });
      }

      if (rows.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.IMPORT_NO_DATA_ROWS,
        });
      }

      const headers = Object.keys(rows[0] ?? {});
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
    .use(requirePermission({ contractor: ['create'] }))
    .input(
      fileInputSchema.extend({
        // Zod v4: record requires explicit key schema. Keys here are CSV/XLSX
        // header names (arbitrary strings); values are nullable target field names.
        columnMapping: z.record(z.string(), z.string().nullable()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const buffer = Buffer.from(input.fileBase64, 'base64');

      try {
        const result = await processImportFile(
          buffer,
          input.entityType,
          ctx.organizationId,
          input.columnMapping,
          ctx.db,
        );
        return result;
      } catch (err) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: err instanceof Error ? err.message : 'Failed to process import file',
        });
      }
    }),

  /**
   * Commit validated rows to the database.
   * Supports per-duplicate actions: skip, update, or create.
   * Uses a Prisma transaction for atomicity.
   */
  commit: tenantProcedure
    .use(requirePermission({ contractor: ['create'] }))
    .input(
      z.object({
        entityType: entityTypeSchema,
        rows: z
          .array(z.record(z.string(), z.unknown()))
          .max(MAX_COMMIT_ROWS, `Cannot commit more than ${MAX_COMMIT_ROWS} rows`),
        duplicateActions: z.record(z.string(), z.enum(['skip', 'update', 'create'])),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actorUserId = ctx.user?.id;
      if (!actorUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      const { entityType, rows, duplicateActions } = input;
      const counts = { created: 0, updated: 0, skipped: 0, failed: 0 };

      try {
        // Explicit timeout sized to the MAX_COMMIT_ROWS cap: committing up to
        // 5000 rows via per-row savepoints far exceeds Prisma's default 5s
        // interactive-transaction timeout and would otherwise abort real
        // imports with P2028.
        await ctx.db.$transaction(
          async tx => {
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i]!;
              const savepoint = `import_row_${i}`;
              await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);

              try {
                const normalizedRow = { ...row };
                const validation =
                  entityType === 'contractor'
                    ? validateContractorRow(normalizedRow)
                    : validateContractRow(normalizedRow);
                if (!validation.valid) {
                  await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                  counts.failed++;
                  continue;
                }

                const countryCode = String(normalizedRow.countryCode ?? 'PL');
                const taxId =
                  normalizeContractorTaxId(
                    countryCode,
                    String(normalizedRow.taxId ?? normalizedRow.contractorTaxId ?? ''),
                  ) ?? '';
                const result =
                  entityType === 'contractor'
                    ? await commitContractorRow(
                        tx,
                        ctx.organizationId,
                        actorUserId,
                        normalizedRow,
                        duplicateActions[taxId],
                      )
                    : await commitContractRow(tx, ctx.organizationId, actorUserId, normalizedRow);
                counts[result]++;
                await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
              } catch (err) {
                await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
                counts.failed++;
                // Log only the classified error name — the raw Prisma error
                // message embeds the offending row's field values (PII), so it
                // must never reach the logs.
                log.warn(
                  { errName: err instanceof Error ? err.name : 'unknown', rowIndex: i, entityType },
                  'import commit row failed',
                );
              }
            }

            await writeAuditLog({
              tx,
              organizationId: ctx.organizationId,
              actorType: 'USER',
              actorId: actorUserId,
              action: 'import.commit',
              resourceType: 'ORGANIZATION',
              resourceId: ctx.organizationId,
              newValues: { entityType, ...counts },
            });
          },
          { timeout: 120_000, maxWait: 10_000 },
        );
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Import commit failed',
        });
      }

      return counts;
    }),
});
