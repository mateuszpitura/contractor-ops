import type { Prisma } from '@contractor-ops/db';
import type { PaymentRun } from '@contractor-ops/db/generated/prisma/client';
import {
  bankStatementConfirmSchema,
  markAllPaidSchema,
  paymentRunCancelSchema,
  paymentRunCreateSchema,
  paymentRunItemStatusSchema,
  paymentRunListSchema,
  paymentRunLockSchema,
  readyForPaymentListSchema,
  removeFromRunSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import { acquireXactLock } from '../../lib/advisory-lock.js';
import {
  clear as clearIdempotency,
  complete as completeIdempotency,
  reserve as reserveIdempotency,
} from '../../lib/idempotency.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import { matchStatementToRun, parseBankStatement } from '../../services/bank-statement.js';
import type { ExportItem, OrgBankInfo } from '../../services/payment-export.js';
import {
  generateCsv,
  generateElixir,
  generateSepaXml,
  generateSwiftXml,
  resolveTransferTitle,
} from '../../services/payment-export.js';
import { detectFormat } from '../../services/payment-format-detection.js';
import { evaluateSkontoEligibility, resolveSkontoTerm } from '../../services/skonto.js';
import { calculateWht } from '../../services/tax-rate.service.js';
import type { DbClient } from '../../services/types.js';

/** Transaction client derived from the tenant-scoped DbClient. */
type TxClient = Parameters<Parameters<DbClient['$transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Idempotency key cache for payment run creation (24-hour window)
// Payment runs persist much longer than a few minutes, so the cache TTL
// must cover the realistic window in which duplicate requests may arrive.
//
// Backed by Upstash Redis (see packages/api/src/lib/idempotency.ts) so the
// reservation is shared across all Render instances. The previous in-memory
// Map was process-local — a duplicate retry hitting a different pod could
// create a second payment run, leading to real-money double-spend.
// ---------------------------------------------------------------------------

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

// ---------------------------------------------------------------------------
// Payment run helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// createPaymentRun — composable helpers
//
// The `create` mutation's transaction body was previously a 100+ line block
// mixing input fetch, validation, currency grouping, lock acquisition, and
// per-group run creation. Each concern is now extracted into a thin helper
// below so the top-level $transaction callback reads as a flat sequence of
// well-named steps. Helpers are intentionally local to this file — they
// share the `paymentRunCreateSchema` input shape and have no other call site.
// ---------------------------------------------------------------------------

/**
 * Shape of an invoice loaded for payment-run creation. Captured as a type
 * alias so helpers can express intent without re-deriving the Prisma include
 * payload at every signature.
 */
type EligibleInvoice = Awaited<ReturnType<TxClient['invoice']['findMany']>>[number] & {
  billingProfile: { id: string; preferredCurrency: string } | null;
};

/**
 * Fetches all invoices in the given id list scoped to the organization,
 * pulling the minimum data needed for downstream validation + item seeding.
 */
async function loadEligibleInvoices(
  tx: TxClient,
  organizationId: string,
  invoiceIds: readonly string[],
): Promise<EligibleInvoice[]> {
  return (await tx.invoice.findMany({
    where: {
      id: { in: [...invoiceIds] },
      organizationId,
      deletedAt: null,
    },
    include: {
      billingProfile: { select: { id: true, preferredCurrency: true } },
    },
  })) as EligibleInvoice[];
}

/**
 * Validates that the loaded invoices are usable for a new payment run.
 * Throws TRPCError on any failure; returns void on success.
 *
 * Checks (in this order, matching the original inline flow):
 *   1. Every invoice must have `paymentStatus === 'READY'`.
 *   2. Every requested id must be present (no missing/cross-tenant rows).
 */
function validateInvoicesForRun(
  invoices: EligibleInvoice[],
  requestedIds: readonly string[],
): void {
  if (invoices.some(inv => inv.paymentStatus !== 'READY')) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.PAYMENT_INVOICES_NOT_READY,
    });
  }

  if (invoices.length !== requestedIds.length) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: E.PAYMENT_INVOICES_NOT_FOUND,
    });
  }
}

/**
 * Partitions invoices into per-currency groups when `groupByCurrency` is set,
 * otherwise returns a single group keyed on the explicit currency override
 * (falling back to the invoices' shared currency). Throws BAD_REQUEST when
 * invoices span multiple currencies and grouping is disabled.
 */
function groupInvoicesByCurrency(
  invoices: EligibleInvoice[],
  options: { groupByCurrency: boolean; currencyOverride?: string },
): Map<string, EligibleInvoice[]> {
  const groups = new Map<string, EligibleInvoice[]>();

  if (options.groupByCurrency) {
    for (const inv of invoices) {
      const bucket = groups.get(inv.currency) ?? [];
      bucket.push(inv);
      groups.set(inv.currency, bucket);
    }
    return groups;
  }

  const currencies = new Set(invoices.map(inv => inv.currency));
  if (currencies.size > 1) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: E.PAYMENT_MIXED_CURRENCIES,
    });
  }

  const currency = options.currencyOverride ?? invoices[0]?.currency ?? 'PLN';
  groups.set(currency, invoices);
  return groups;
}

/**
 * Persists payment-run items for the given run and flips the source invoices
 * to `IN_RUN`. Also applies WHT calculations when the organization is in a
 * jurisdiction that requires it (Saudi cross-border).
 *
 * All writes are routed through `tx` so they participate in the caller's
 * transaction — no behavior change from the previous inline implementation.
 */
async function seedRunItems(
  tx: TxClient,
  args: {
    organizationId: string;
    runId: string;
    invoices: EligibleInvoice[];
  },
): Promise<void> {
  await tx.paymentRunItem.createMany({
    data: args.invoices.map(inv => ({
      organizationId: args.organizationId,
      paymentRunId: args.runId,
      invoiceId: inv.id,
      contractorId: inv.contractorId as string,
      billingProfileId: inv.billingProfileId ?? null,
      amountMinor: inv.amountToPayMinor,
      currency: inv.currency,
      status: 'PENDING' as const,
    })),
  });

  // WHT calculations must run after items exist (they update items in-place).
  await _applyWhtIfSaudi(tx, args.organizationId, args.runId);

  await tx.invoice.updateMany({
    where: { id: { in: args.invoices.map(inv => inv.id) } },
    data: { paymentStatus: 'IN_RUN' },
  });
}

/**
 * Allocates the next sequential run number for a payment run within the
 * current year (e.g., `PR-2026-001`). Caller MUST hold the per-org payment
 * advisory lock before invoking — the read-then-format pattern is not safe
 * under concurrent allocation otherwise.
 */
async function allocateRunNumber(tx: TxClient, organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PR-${year}-`;

  const lastRun = await tx.paymentRun.findFirst({
    where: { organizationId, runNumber: { startsWith: prefix } },
    orderBy: { runNumber: 'desc' },
    select: { runNumber: true },
  });

  const seq = lastRun?.runNumber ? parseInt(lastRun.runNumber.replace(prefix, ''), 10) + 1 : 1;

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

/**
 * Generates an export file buffer and extension based on the format.
 */
async function _generateExportFileForFormat(
  format: string,
  exportItems: ExportItem[],
  orgBank: OrgBankInfo,
  runRef: string,
): Promise<{ fileBuffer: Buffer; ext: string }> {
  if (format === 'CSV') {
    return { fileBuffer: await generateCsv(exportItems), ext: 'csv' };
  }
  if (format === 'BANK_FILE') {
    return { fileBuffer: generateElixir(exportItems, orgBank), ext: 'txt' };
  }
  if (format === 'SWIFT_XML') {
    return { fileBuffer: generateSwiftXml(exportItems, orgBank, runRef), ext: 'xml' };
  }
  return { fileBuffer: generateSepaXml(exportItems, orgBank, runRef), ext: 'xml' };
}

/**
 * Checks if all items in a payment run are terminal and auto-completes the run.
 */
async function autoCompleteRunIfTerminal(tx: TxClient, paymentRunId: string): Promise<void> {
  const remaining = await tx.paymentRunItem.count({
    where: { paymentRunId, status: { in: ['PENDING', 'EXPORTED'] } },
  });

  if (remaining > 0) return;

  const failedCount = await tx.paymentRunItem.count({
    where: { paymentRunId, status: 'FAILED' },
  });

  await tx.paymentRun.update({
    where: { id: paymentRunId },
    data: {
      status: failedCount > 0 ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });
}

/**
 * Builds ExportItem array from payment run items with resolved transfer titles.
 */
function _buildExportItems(
  items: Array<{
    amountMinor: number;
    currency: string;
    invoice: {
      invoiceNumber: string | null;
      dueDate: Date | null;
      servicePeriodStart: Date | null;
      servicePeriodEnd: Date | null;
    };
    contractor: { legalName: string; taxId: string | null };
    billingProfile: {
      bankAccountMasked: string | null;
      swiftBic: string | null;
      bankName: string | null;
    } | null;
  }>,
  transferTitleTemplate: string,
): ExportItem[] {
  return items.map(item => {
    const billingPeriod =
      item.invoice.servicePeriodStart && item.invoice.servicePeriodEnd
        ? `${item.invoice.servicePeriodStart.toISOString().slice(0, 10)} - ${item.invoice.servicePeriodEnd.toISOString().slice(0, 10)}`
        : undefined;

    const invoiceNumber = item.invoice.invoiceNumber ?? '';

    const transferTitle = resolveTransferTitle(transferTitleTemplate, {
      invoiceNumber,
      billingPeriod,
      contractorName: item.contractor.legalName,
    });

    return {
      contractorName: item.contractor.legalName,
      iban: item.billingProfile?.bankAccountMasked ?? '',
      amountMinor: item.amountMinor,
      currency: item.currency,
      invoiceNumber,
      taxId: item.contractor.taxId,
      bankName: item.billingProfile?.bankName ?? null,
      swiftBic: item.billingProfile?.swiftBic ?? null,
      dueDate: item.invoice.dueDate ?? new Date(),
      transferTitle,
    };
  });
}

/**
 * Applies withholding tax calculations for Saudi organizations on cross-border payments.
 */
async function _applyWhtIfSaudi(
  tx: TxClient,
  organizationId: string,
  paymentRunId: string,
): Promise<void> {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { countryCode: true },
  });

  if (org.countryCode !== 'SA') return;

  const items = await tx.paymentRunItem.findMany({
    where: { paymentRunId },
    include: { contractor: { select: { countryCode: true } } },
  });

  for (const item of items) {
    const whtResult = await calculateWht(
      org.countryCode,
      item.contractor.countryCode,
      'technical_services',
      item.amountMinor,
    );
    if (!whtResult) continue;

    await tx.paymentRunItem.update({
      where: { id: item.id },
      data: {
        grossAmountMinor: item.amountMinor,
        amountMinor: whtResult.netAmountMinor,
        whtAmountMinor: whtResult.whtAmountMinor,
        whtRate: whtResult.whtRate,
        whtTreatyApplied: whtResult.treatyApplied,
        whtTreatyReference: whtResult.treatyReference,
        whtServiceType: 'technical_services',
      },
    });
    await tx.invoice.update({
      where: { id: item.invoiceId },
      data: { withholdingMinor: whtResult.whtAmountMinor },
    });
  }
}

/**
 * Resolves the organization's bank info and transfer title template from metadata.
 */
async function _resolveOrgBankInfo(
  tx: TxClient,
  organizationId: string,
): Promise<{ orgBank: OrgBankInfo; transferTitleTemplate: string }> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, metadata: true },
  });

  const parsedMetadata = org?.metadata
    ? (JSON.parse(org.metadata) as Record<string, unknown>)
    : null;
  const settingsJson = (parsedMetadata?.settingsJson ?? {}) as Record<string, unknown>;
  const bankAccount = (settingsJson.bankAccount ?? {}) as Record<string, unknown>;

  return {
    transferTitleTemplate:
      (settingsJson.paymentTransferTitleTemplate as string | undefined) ?? '{invoice_number}',
    orgBank: {
      name: org?.name ?? '',
      iban: (bankAccount.iban as string | undefined) ?? '',
      bic: (bankAccount.bic as string | undefined) ?? '',
    },
  };
}

// ---------------------------------------------------------------------------
// Valid status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['LOCKED', 'CANCELLED'],
  LOCKED: ['EXPORTED', 'CANCELLED'],
  EXPORTED: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: ['DRAFT'],
  CANCELLED: [],
};

// ---------------------------------------------------------------------------
// Payment Router
// ---------------------------------------------------------------------------

export const paymentRouter = router({
  // =========================================================================
  // readyForPayment — list invoices ready for payment
  // =========================================================================

  readyForPayment: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(readyForPaymentListSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        paymentStatus: 'READY',
        deletedAt: null,
      };

      if (input.currency) {
        where.currency = input.currency;
      }

      if (input.dueDateFrom || input.dueDateTo) {
        where.dueDate = {
          ...(input.dueDateFrom && { gte: input.dueDateFrom }),
          ...(input.dueDateTo && { lte: input.dueDateTo }),
        };
      }

      if (input.contractorId) {
        where.contractorId = input.contractorId;
      }

      if (input.cursor) {
        where.id = { gt: input.cursor };
      }

      const items = await ctx.db.invoice.findMany({
        where,
        take: input.limit + 1,
        orderBy: { dueDate: 'asc' },
        include: {
          contractor: {
            select: { id: true, legalName: true, taxId: true },
          },
          billingProfile: {
            select: {
              id: true,
              bankAccountMasked: true,
              swiftBic: true,
              bankName: true,
              preferredCurrency: true,
            },
          },
          contract: {
            select: { id: true, contractNumber: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  // =========================================================================
  // create — create a new payment run from selected invoices
  // =========================================================================

  create: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Idempotency check: return cached result if same key was used recently.
      // Backed by Upstash Redis so the reservation is visible across all
      // Render instances; a retry that lands on a different pod sees the same
      // PENDING / HIT state as the original.
      const cacheKey = input.idempotencyKey
        ? `payment-run:${ctx.organizationId}:${input.idempotencyKey}`
        : null;

      if (cacheKey) {
        const hit = await reserveIdempotency<PaymentRun[]>(cacheKey, IDEMPOTENCY_TTL_SECONDS);
        if (hit.kind === 'PENDING') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Payment run creation in progress',
          });
        }
        if (hit.kind === 'HIT') {
          return hit.result;
        }
        // MISS: reservation acquired; fall through to normal processing.
      }

      let result: PaymentRun[];
      try {
        result = await ctx.db.$transaction(async tx => {
          const invoices = await loadEligibleInvoices(tx, ctx.organizationId, input.invoiceIds);
          validateInvoicesForRun(invoices, input.invoiceIds);

          const groups = groupInvoicesByCurrency(invoices, {
            groupByCurrency: input.groupByCurrency,
            currencyOverride: input.currency,
          });

          // Per-org payment-run serialization. Namespace `'payment'`
          // partitions the keyspace from cron / org / sync locks; the org id
          // is the natural key because run numbers are allocated per-org.
          await acquireXactLock(
            tx as unknown as Parameters<typeof acquireXactLock>[0],
            'payment',
            ctx.organizationId,
          );

          const runs: PaymentRun[] = [];
          for (const [currency, groupInvoices] of groups) {
            const runNumber = await allocateRunNumber(tx, ctx.organizationId);
            const totalMinor = groupInvoices.reduce((sum, inv) => sum + inv.amountToPayMinor, 0);

            const run = await tx.paymentRun.create({
              data: {
                organizationId: ctx.organizationId,
                runNumber,
                name: input.name ?? null,
                status: 'DRAFT',
                currency,
                createdByUserId: ctx.user.id,
                totalMinor,
                invoiceCount: groupInvoices.length,
                notes: input.notes ?? null,
              },
            });

            await seedRunItems(tx, {
              organizationId: ctx.organizationId,
              runId: run.id,
              invoices: groupInvoices,
            });

            runs.push(run);
          }

          return runs;
        });

        // Update cache with actual result
        if (cacheKey) {
          await completeIdempotency(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
        }

        return result;
      } catch (err) {
        // Clear reservation on failure so the key can be retried
        if (cacheKey) {
          await clearIdempotency(cacheKey);
        }
        if (
          err &&
          typeof err === 'object' &&
          (err as { code?: string }).code === 'P2002' &&
          ((err as { meta?: { target?: readonly string[] } }).meta?.target ?? []).includes(
            'runNumber',
          )
        ) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Payment run number collision; retry to allocate a new number.',
          });
        }
        throw err;
      }
    }),

  // =========================================================================
  // get — get a single payment run with items and exports
  // =========================================================================

  get: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ runId: z.cuid() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: {
          id: input.runId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              invoice: {
                select: { invoiceNumber: true, dueDate: true },
              },
              contractor: {
                select: { id: true, legalName: true, taxId: true },
              },
              billingProfile: {
                select: {
                  bankAccountMasked: true,
                  swiftBic: true,
                  bankName: true,
                },
              },
            },
          },
          exports: true,
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      return run;
    }),

  // =========================================================================
  // list — list payment runs with pagination and filtering
  // =========================================================================

  list: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(paymentRunListSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.PaymentRunWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (input.status) {
        where.status = input.status;
      }

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {
          ...(input.dateFrom && { gte: input.dateFrom }),
          ...(input.dateTo && { lte: input.dateTo }),
        };
      }

      if (input.cursor) {
        where.id = { gt: input.cursor };
      }

      const items = await ctx.db.paymentRun.findMany({
        where,
        take: input.limit + 1,
        orderBy: { [input.sortBy]: input.sortOrder },
        include: {
          _count: { select: { items: true } },
        },
      });

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop();
        nextCursor = next?.id;
      }

      return { items, nextCursor };
    }),

  // =========================================================================
  // lockAndExport — lock a run and generate export file
  // =========================================================================

  lockAndExport: tenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(paymentRunLockSchema)
    .mutation(async ({ ctx, input }) => {
      // F-DB-16 — file-buffer generation (SEPA / Elixir / Swift XML
      // serialization) is CPU-bound and can take tens-to-hundreds of
      // milliseconds. Doing it inside `$transaction` held row locks on
      // the PaymentRun + every PaymentRunItem for the duration of the
      // CPU work, mixing I/O and CPU under one tx. We split the flow:
      //   tx-1: validate state + idempotency + read items
      //   no-tx: generate the export file
      //   tx-2: persist EXPORTED status + paymentExport row
      // Note: idempotency check covers the case where two concurrent
      // requests reach tx-2 — the second will short-circuit because
      // status is already EXPORTED (validated again under the tx-2 lock).

      // ── tx-1: load run + validate + capture items snapshot ─────────────
      const prepared = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              include: {
                invoice: {
                  select: {
                    invoiceNumber: true,
                    dueDate: true,
                    servicePeriodStart: true,
                    servicePeriodEnd: true,
                  },
                },
                contractor: {
                  select: {
                    legalName: true,
                    taxId: true,
                  },
                },
                billingProfile: {
                  select: {
                    bankAccountMasked: true,
                    swiftBic: true,
                    bankName: true,
                  },
                },
              },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        // Idempotent: if already LOCKED or EXPORTED, return existing run
        if (run.status === 'LOCKED' || run.status === 'EXPORTED') {
          return {
            run,
            idempotent: true as const,
          };
        }

        // Validate transition
        if (
          !(
            VALID_TRANSITIONS[run.status]?.includes('LOCKED') ||
            VALID_TRANSITIONS[run.status]?.includes('EXPORTED')
          )
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        // Re-validate currency consistency at lock time
        const itemCurrencies = await tx.paymentRunItem.findMany({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          select: { currency: true },
          distinct: ['currency'],
        });

        const mismatchedCurrencies = itemCurrencies.filter(item => item.currency !== run.currency);

        if (mismatchedCurrencies.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_MIXED_CURRENCIES,
          });
        }

        // Recalculate totals from actual items to ensure export uses fresh data
        const itemsAgg = await tx.paymentRunItem.aggregate({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          _sum: { amountMinor: true },
          _count: true,
        });

        // Fetch org settings for transfer title template and bank info
        const { orgBank, transferTitleTemplate } = await _resolveOrgBankInfo(
          tx,
          ctx.organizationId,
        );

        return {
          run,
          idempotent: false as const,
          freshTotalMinor: itemsAgg._sum.amountMinor ?? 0,
          freshInvoiceCount: itemsAgg._count,
          orgBank,
          transferTitleTemplate,
        };
      });

      if (prepared.idempotent) {
        return {
          run: prepared.run,
          fileBase64: null,
          fileName: null,
          idempotent: true,
        };
      }

      // ── no tx: CPU-heavy file serialization off the lock-holding path ──
      const exportItems = _buildExportItems(prepared.run.items, prepared.transferTitleTemplate);
      const { fileBuffer, ext } = await _generateExportFileForFormat(
        input.exportFormat,
        exportItems,
        prepared.orgBank,
        prepared.run.runNumber ?? prepared.run.id,
      );

      // ── tx-2: transition + paymentExport ───────────────────────────────
      const updatedRun = await ctx.db.$transaction(async tx => {
        // Re-fetch under the lock to detect concurrent state mutations.
        const current = await tx.paymentRun.findFirst({
          where: { id: prepared.run.id, organizationId: ctx.organizationId },
          select: { status: true },
        });
        if (!current) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }
        // Concurrent finalize won — return idempotent result.
        if (current.status === 'EXPORTED' || current.status === 'LOCKED') {
          return prepared.run;
        }
        const updated = await tx.paymentRun.update({
          where: { id: prepared.run.id },
          data: {
            status: 'EXPORTED',
            exportFormat: input.exportFormat,
            exportedAt: new Date(),
            totalMinor: prepared.freshTotalMinor,
            invoiceCount: prepared.freshInvoiceCount,
          },
        });

        await tx.paymentExport.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: prepared.run.id,
            format: input.exportFormat,
            status: 'GENERATED',
            generatedByUserId: ctx.user.id,
          },
        });

        return updated;
      });

      return {
        run: updatedRun,
        fileBase64: fileBuffer.toString('base64'),
        fileName: `${prepared.run.runNumber ?? prepared.run.id}.${ext}`,
      };
    }),

  // =========================================================================
  // updateItemStatus — mark individual item as paid/failed
  // =========================================================================

  updateItemStatus: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunItemStatusSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const item = await tx.paymentRunItem.findFirst({
          where: {
            id: input.itemId,
            organizationId: ctx.organizationId,
          },
          include: { paymentRun: true },
        });

        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_ITEM_NOT_FOUND,
          });
        }

        // Update item status
        const updatedItem = await tx.paymentRunItem.update({
          where: { id: item.id },
          data: {
            status: input.status,
            paymentReference: input.paymentReference ?? null,
            failureReason: input.status === 'FAILED' ? input.failureReason : null,
            markedPaidAt: input.status === 'PAID' ? new Date() : null,
          },
        });

        // Update invoice paymentStatus
        if (input.status === 'PAID') {
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'PAID', paidAt: new Date() },
          });
        } else if (input.status === 'FAILED') {
          // Auto-release: failed items go back to READY (D-11)
          await tx.invoice.update({
            where: { id: item.invoiceId },
            data: { paymentStatus: 'READY' },
          });
        }

        // Check if all items in run are terminal -> auto-complete
        await autoCompleteRunIfTerminal(tx, item.paymentRunId);

        return updatedItem;
      });

      return result;
    }),

  // =========================================================================
  // markAllPaid — bulk mark all PENDING items as paid
  // =========================================================================

  markAllPaid: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(markAllPaidSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: {
            items: {
              where: { status: { in: ['PENDING', 'EXPORTED'] } },
            },
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();
        const itemIds = run.items.map(i => i.id);
        const invoiceIds = run.items.map(i => i.invoiceId);

        // Batch update all pending items to PAID
        await tx.paymentRunItem.updateMany({
          where: { id: { in: itemIds } },
          data: {
            status: 'PAID',
            paymentReference: input.batchReference ?? null,
            markedPaidAt: now,
          },
        });

        // Batch update all linked invoices to PAID
        await tx.invoice.updateMany({
          where: { id: { in: invoiceIds } },
          data: { paymentStatus: 'PAID', paidAt: now },
        });

        // Mark run as completed
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
          },
        });

        return updatedRun;
      });

      return result;
    }),

  // =========================================================================
  // cancel — cancel a payment run, release invoices back to READY
  // =========================================================================

  cancel: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunCancelSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
          include: { items: true },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        // Check valid transition
        if (!VALID_TRANSITIONS[run.status]?.includes('CANCELLED')) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.PAYMENT_RUN_INVALID_STATUS,
          });
        }

        // EXPORTED runs require admin role (D-15)
        if (run.status === 'EXPORTED') {
          const member = await tx.member.findFirst({
            where: {
              organizationId: ctx.organizationId,
              userId: ctx.user.id,
            },
            select: { role: true },
          });

          if (member?.role !== 'admin') {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message:
                'Only administrators can cancel exported payment runs. Ensure the export was NOT submitted to your bank before cancelling.',
            });
          }
        }

        // Batch release all non-paid items' invoices back to READY
        const unpaidInvoiceIds = run.items
          .filter(item => item.status !== 'PAID')
          .map(item => item.invoiceId);

        if (unpaidInvoiceIds.length > 0) {
          await tx.invoice.updateMany({
            where: { id: { in: unpaidInvoiceIds } },
            data: { paymentStatus: 'READY' },
          });
        }

        // Cancel the run
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: { status: 'CANCELLED' },
        });

        return updatedRun;
      });

      return result;
    }),

  // =========================================================================
  // importStatement — parse bank statement and match to run items
  // =========================================================================

  importStatement: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(
      z.object({
        runId: z.cuid(),
        fileContent: z.string(),
        fileName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: {
          id: input.runId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              billingProfile: {
                select: { bankAccountMasked: true },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.PAYMENT_RUN_NOT_FOUND,
        });
      }

      if (run.status !== 'EXPORTED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Bank statement can only be imported for exported payment runs',
        });
      }

      // Parse statement
      const transactions = parseBankStatement(input.fileContent, input.fileName);

      // Build items for matching
      const matchItems = run.items.map(item => ({
        id: item.id,
        amountMinor: item.amountMinor,
        iban: item.billingProfile?.bankAccountMasked ?? '',
      }));

      const matches = matchStatementToRun(transactions, matchItems);

      return { matches, transactions };
    }),

  // =========================================================================
  // confirmStatementMatches — apply matched transactions as paid
  // =========================================================================

  confirmStatementMatches: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(bankStatementConfirmSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: {
            id: input.runId,
            organizationId: ctx.organizationId,
          },
        });

        if (!run) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: E.PAYMENT_RUN_NOT_FOUND,
          });
        }

        const now = new Date();

        // Batch-verify all matched items exist in this run
        const matchedItemIds = input.matches.map(m => m.itemId);
        const validItems = await tx.paymentRunItem.findMany({
          where: {
            id: { in: matchedItemIds },
            paymentRunId: run.id,
            organizationId: ctx.organizationId,
          },
          select: { id: true, invoiceId: true },
        });

        if (validItems.length > 0) {
          const validItemIds = validItems.map(i => i.id);
          const invoiceIds = validItems.map(i => i.invoiceId);

          // Batch-update all matched items to PAID
          await tx.paymentRunItem.updateMany({
            where: { id: { in: validItemIds } },
            data: { status: 'PAID', markedPaidAt: now },
          });

          // Batch-update all linked invoices to PAID
          await tx.invoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { paymentStatus: 'PAID', paidAt: now },
          });
        }

        // Check if all items terminal -> auto-complete
        await autoCompleteRunIfTerminal(tx, run.id);

        // Return updated run
        const updatedRun = await tx.paymentRun.findUnique({
          where: { id: run.id },
          include: { items: true },
        });

        return updatedRun;
      });

      return result;
    }),

  // =========================================================================
  // removeFromRun — remove an invoice from a DRAFT run (D-04)
  // =========================================================================

  removeFromRun: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(removeFromRunSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(
        async tx => {
          const run = await tx.paymentRun.findFirst({
            where: {
              id: input.runId,
              organizationId: ctx.organizationId,
            },
          });

          if (!run) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_RUN_NOT_FOUND,
            });
          }

          if (run.status !== 'DRAFT') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: E.PAYMENT_RUN_NOT_DRAFT,
            });
          }

          // Find the item
          const item = await tx.paymentRunItem.findFirst({
            where: {
              paymentRunId: run.id,
              invoiceId: input.invoiceId,
              organizationId: ctx.organizationId,
            },
          });

          if (!item) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_INVOICE_NOT_IN_RUN,
            });
          }

          // Delete the item
          await tx.paymentRunItem.delete({
            where: { id: item.id },
          });

          // Release invoice back to READY
          await tx.invoice.update({
            where: { id: input.invoiceId },
            data: { paymentStatus: 'READY' },
          });

          // Recalculate run totals from actual remaining items (not cached values)
          const remainingAgg = await tx.paymentRunItem.aggregate({
            where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
            _sum: { amountMinor: true },
            _count: true,
          });

          const newTotalMinor = remainingAgg._sum.amountMinor ?? 0;
          const newInvoiceCount = remainingAgg._count;

          // If no items remain, auto-cancel the run
          if (newInvoiceCount === 0) {
            return tx.paymentRun.update({
              where: { id: run.id },
              data: {
                totalMinor: 0,
                invoiceCount: 0,
                status: 'CANCELLED',
              },
            });
          }

          return tx.paymentRun.update({
            where: { id: run.id },
            data: {
              totalMinor: newTotalMinor,
              invoiceCount: newInvoiceCount,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );

      return result;
    }),

  // =========================================================================
  // listByContractor — payment items for contractor profile Payments tab
  // =========================================================================

  listByContractor: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(
      z.object({
        contractorId: z.cuid(),
        // F-DB-09: cursor pagination (default 50, max 200). The previous
        // hard cap of 100 silently dropped older payment items for
        // long-tenured contractors.
        take: z.number().int().min(1).max(200).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.paymentRunItem.findMany({
        where: {
          organizationId: ctx.organizationId,
          contractorId: input.contractorId,
        },
        include: {
          paymentRun: {
            select: { runNumber: true, status: true, createdAt: true },
          },
          invoice: {
            select: { invoiceNumber: true, dueDate: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        // take + 1 to detect next page; trimmed before return
        take: input.take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > input.take;
      const trimmed = hasMore ? items.slice(0, input.take) : items;
      const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

      return { items: trimmed, nextCursor };
    }),

  // =========================================================================
  // applySkontoToItem — apply early payment discount to a payment run item
  // =========================================================================

  applySkontoToItem: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(z.object({ paymentRunItemId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.paymentRunItem.findFirst({
        where: {
          id: input.paymentRunItemId,
          organizationId: ctx.organizationId,
        },
        include: {
          invoice: {
            include: {
              skontoTerms: { take: 1 },
              contractor: {
                include: {
                  billingProfiles: {
                    take: 1,
                    include: { skontoTerms: { take: 1 } },
                  },
                },
              },
            },
          },
        },
      });

      if (!item?.invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment run item not found',
        });
      }

      const { invoice } = item;
      const invoiceSkontoTerm = invoice.skontoTerms[0];
      const profileSkontoTerm = invoice.contractor?.billingProfiles[0]?.skontoTerms[0];

      // Resolve effective skonto term via cascade
      const invoiceTerm = invoiceSkontoTerm
        ? {
            discountPercent: Number(invoiceSkontoTerm.discountPercent),
            discountPeriodDays: invoiceSkontoTerm.discountPeriodDays,
            netPeriodDays: invoiceSkontoTerm.netPeriodDays,
          }
        : null;

      const profileTerm = profileSkontoTerm
        ? {
            discountPercent: Number(profileSkontoTerm.discountPercent),
            discountPeriodDays: profileSkontoTerm.discountPeriodDays,
            netPeriodDays: profileSkontoTerm.netPeriodDays,
          }
        : null;

      const effectiveTerm = resolveSkontoTerm(invoiceTerm, profileTerm);

      const eligibility = evaluateSkontoEligibility({
        invoiceTotalMinor: invoice.totalMinor,
        invoiceIssueDate: invoice.issueDate,
        skontoTerm: effectiveTerm,
        paidAt: invoice.paidAt,
        asOf: new Date(),
      });

      if (!eligibility.eligible) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Invoice not eligible for Skonto discount',
        });
      }

      // Find the effective skonto term record for the FK
      const skontoTermRecord = invoiceSkontoTerm ?? profileSkontoTerm;

      if (!(skontoTermRecord && effectiveTerm)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No Skonto term record found',
        });
      }

      const result = await ctx.db.$transaction(async tx => {
        // Update payment run item amount to discounted amount
        const updatedItem = await tx.paymentRunItem.update({
          where: { id: input.paymentRunItemId },
          data: { amountMinor: eligibility.discountedAmountMinor },
        });

        // Create SkontoApplication record
        await tx.skontoApplication.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunItemId: input.paymentRunItemId,
            skontoTermId: skontoTermRecord.id,
            discountPercentApplied: effectiveTerm.discountPercent,
            discountAmountMinor: eligibility.discountAmountMinor,
          },
        });

        return updatedItem;
      });

      return result;
    }),

  // =========================================================================
  // getFormatDetection — detect payment format for items in a run
  // =========================================================================

  getFormatDetection: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ paymentRunId: z.string() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: {
          id: input.paymentRunId,
          organizationId: ctx.organizationId,
        },
        include: {
          items: {
            include: {
              invoice: {
                select: { currency: true },
              },
              contractor: {
                include: {
                  billingProfiles: {
                    take: 1,
                    select: { bankAccountMasked: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!run) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment run not found',
        });
      }

      const detections = run.items.map(item => {
        const currency = item.invoice?.currency ?? run.currency;
        const iban = item.contractor?.billingProfiles[0]?.bankAccountMasked ?? '';
        const format = detectFormat(currency, iban);

        return {
          paymentRunItemId: item.id,
          contractorId: item.contractorId,
          currency,
          iban,
          format,
        };
      });

      return detections;
    }),
});
