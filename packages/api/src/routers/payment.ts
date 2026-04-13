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
import * as E from '../errors.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { matchStatementToRun, parseBankStatement } from '../services/bank-statement.js';
import type { ExportItem, OrgBankInfo } from '../services/payment-export.js';
import {
  generateCsv,
  generateElixir,
  generateSepaXml,
  generateSwiftXml,
  resolveTransferTitle,
} from '../services/payment-export.js';
import { calculateWht } from '../services/tax-rate.service.js';

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
// Idempotency key cache for payment run creation (24-hour window)
// Payment runs persist much longer than a few minutes, so the cache TTL
// must cover the realistic window in which duplicate requests may arrive.
// ---------------------------------------------------------------------------

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;

/** Maps "orgId:idempotencyKey" → { runIds, expiresAt } or "PENDING" sentinel */
const idempotencyCache = new Map<string, { result: unknown; expiresAt: number } | 'PENDING'>();

if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of idempotencyCache) {
      if (entry === 'PENDING') continue;
      if (now > entry.expiresAt) idempotencyCache.delete(key);
    }
  };
  setInterval(cleanup, 60_000).unref?.();
}

// ---------------------------------------------------------------------------
// Payment run helpers
// ---------------------------------------------------------------------------

/**
 * Generates the sequential run number for a payment run (e.g., PR-2026-001).
 */
// biome-ignore lint/suspicious/noExplicitAny: transaction client type not exported from Prisma
async function _generateRunNumber(tx: any, organizationId: string): Promise<string> {
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
// biome-ignore lint/suspicious/noExplicitAny: transaction client type not exported from Prisma
async function autoCompleteRunIfTerminal(tx: any, paymentRunId: string): Promise<void> {
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
      dueDate: item.invoice.dueDate,
      transferTitle,
    };
  });
}

/**
 * Applies withholding tax calculations for Saudi organizations on cross-border payments.
 */
// biome-ignore lint/suspicious/noExplicitAny: transaction client type not exported from Prisma
async function _applyWhtIfSaudi(tx: any, organizationId: string, paymentRunId: string): Promise<void> {
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
// biome-ignore lint/suspicious/noExplicitAny: transaction client type not exported from Prisma
async function _resolveOrgBankInfo(tx: any, organizationId: string): Promise<{ orgBank: OrgBankInfo; transferTitleTemplate: string }> {
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
    transferTitleTemplate: (settingsJson.paymentTransferTitleTemplate as string | undefined) ?? '{invoice_number}',
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
      // biome-ignore lint/suspicious/noExplicitAny: dynamically built Prisma where clause requires flexible property assignment for nested filter operators (e.g. { gte, lte })
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
        paymentStatus: 'READY',
        deletedAt: null,
      };

      if (input.currency) {
        where.currency = input.currency;
      }

      if (input.dueDateFrom || input.dueDateTo) {
        where.dueDate = {};
        if (input.dueDateFrom) where.dueDate.gte = input.dueDateFrom;
        if (input.dueDateTo) where.dueDate.lte = input.dueDateTo;
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

      return plain({ items, nextCursor });
    }),

  // =========================================================================
  // create — create a new payment run from selected invoices
  // =========================================================================

  create: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunCreateSchema)
    .mutation(async ({ ctx, input }) => {
      // Idempotency check: return cached result if same key was used recently
      const cacheKey = input.idempotencyKey
        ? `${ctx.organizationId}:${input.idempotencyKey}`
        : null;

      if (cacheKey) {
        const cached = idempotencyCache.get(cacheKey);
        if (cached === 'PENDING') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Payment run creation in progress',
          });
        }
        if (cached && Date.now() < cached.expiresAt) {
          return cached.result as ReturnType<typeof plain>;
        }
        // Reserve the key immediately to prevent concurrent requests
        idempotencyCache.set(cacheKey, 'PENDING');
      }

      let result: PaymentRun[];
      try {
        result = await ctx.db.$transaction(async tx => {
          // Fetch all invoices with their data
          const invoices = await tx.invoice.findMany({
            where: {
              id: { in: input.invoiceIds },
              organizationId: ctx.organizationId,
              deletedAt: null,
            },
            include: {
              billingProfile: { select: { id: true, preferredCurrency: true } },
            },
          });

          // Verify all invoices have paymentStatus READY
          const notReady = invoices.filter(inv => inv.paymentStatus !== 'READY');
          if (notReady.length > 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: E.PAYMENT_INVOICES_NOT_READY,
            });
          }

          if (invoices.length !== input.invoiceIds.length) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: E.PAYMENT_INVOICES_NOT_FOUND,
            });
          }

          // Group invoices by currency if requested
          const groups: Map<string, typeof invoices> = new Map();
          if (input.groupByCurrency) {
            for (const inv of invoices) {
              const curr = inv.currency;
              if (!groups.has(curr)) groups.set(curr, []);
              groups.get(curr)?.push(inv);
            }
          } else {
            // Validate all invoices share the same currency
            const currencies = new Set(invoices.map(inv => inv.currency));
            if (currencies.size > 1) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: E.PAYMENT_MIXED_CURRENCIES,
              });
            }
            groups.set(input.currency ?? invoices[0]?.currency ?? 'PLN', invoices);
          }

          const runs: PaymentRun[] = [];

          for (const [currency, groupInvoices] of groups) {
            // Generate sequential run number
            const year = new Date().getFullYear();
            const prefix = `PR-${year}-`;

            const lastRun = await tx.paymentRun.findFirst({
              where: {
                organizationId: ctx.organizationId,
                runNumber: { startsWith: prefix },
              },
              orderBy: { runNumber: 'desc' },
              select: { runNumber: true },
            });

            const seq = lastRun?.runNumber
              ? parseInt(lastRun.runNumber.replace(prefix, ''), 10) + 1
              : 1;

            const runNumber = `${prefix}${String(seq).padStart(3, '0')}`;

            // Calculate totals
            const totalMinor = groupInvoices.reduce((sum, inv) => sum + inv.amountToPayMinor, 0);

            // Create the run
            const run = await tx.paymentRun.create({
              data: {
                organizationId: ctx.organizationId,
                runNumber,
                name: input.name ?? null,
                status: 'DRAFT',
                currency,
                createdByUserId: ctx.user?.id,
                totalMinor,
                invoiceCount: groupInvoices.length,
                notes: input.notes ?? null,
              },
            });

            // Batch-create items and update invoice statuses
            await tx.paymentRunItem.createMany({
              data: groupInvoices.map(inv => ({
                organizationId: ctx.organizationId,
                paymentRunId: run.id,
                invoiceId: inv.id,
                contractorId: inv.contractorId as string,
                billingProfileId: inv.billingProfileId ?? null,
                amountMinor: inv.amountToPayMinor,
                currency: inv.currency,
                status: 'PENDING' as const,
              })),
            });

            // Apply WHT calculations for Saudi orgs on cross-border payments
            await _applyWhtIfSaudi(tx, ctx.organizationId, run.id);

            await tx.invoice.updateMany({
              where: { id: { in: groupInvoices.map(inv => inv.id) } },
              data: { paymentStatus: 'IN_RUN' },
            });

            runs.push(run);
          }

          return runs;
        });

        const plainResult = plain(result);

        // Update cache with actual result
        if (cacheKey) {
          idempotencyCache.set(cacheKey, {
            result: plainResult,
            expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
          });
        }

        return plainResult;
      } catch (err) {
        // Clear reservation on failure so the key can be retried
        if (cacheKey) {
          idempotencyCache.delete(cacheKey);
        }
        throw err;
      }
    }),

  // =========================================================================
  // get — get a single payment run with items and exports
  // =========================================================================

  get: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ runId: z.string().cuid() }))
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

      return plain(run);
    }),

  // =========================================================================
  // list — list payment runs with pagination and filtering
  // =========================================================================

  list: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(paymentRunListSchema)
    .query(async ({ ctx, input }) => {
      // biome-ignore lint/suspicious/noExplicitAny: dynamically built Prisma where clause requires flexible property assignment for nested filter operators (e.g. { gte, lte })
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (input.status) {
        where.status = input.status;
      }

      if (input.dateFrom || input.dateTo) {
        where.createdAt = {};
        if (input.dateFrom) where.createdAt.gte = input.dateFrom;
        if (input.dateTo) where.createdAt.lte = input.dateTo;
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

      return plain({ items, nextCursor });
    }),

  // =========================================================================
  // lockAndExport — lock a run and generate export file
  // =========================================================================

  lockAndExport: tenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(paymentRunLockSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
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
            fileBase64: null,
            fileName: null,
            idempotent: true,
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

        const freshTotalMinor = itemsAgg._sum.amountMinor ?? 0;
        const freshInvoiceCount = itemsAgg._count;

        // Fetch org settings for transfer title template and bank info
        const { orgBank, transferTitleTemplate } = await _resolveOrgBankInfo(tx, ctx.organizationId);

        // Build ExportItems and generate export file
        const exportItems = _buildExportItems(run.items, transferTitleTemplate);
        const { fileBuffer, ext } = await _generateExportFileForFormat(
          input.exportFormat,
          exportItems,
          orgBank,
          run.runNumber ?? run.id,
        );

        // Update run status to EXPORTED with fresh totals
        const updatedRun = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: 'EXPORTED',
            exportFormat: input.exportFormat,
            exportedAt: new Date(),
            totalMinor: freshTotalMinor,
            invoiceCount: freshInvoiceCount,
          },
        });

        // Create export record
        await tx.paymentExport.create({
          data: {
            organizationId: ctx.organizationId,
            paymentRunId: run.id,
            format: input.exportFormat,
            status: 'GENERATED',
            generatedByUserId: ctx.user?.id,
          },
        });

        return {
          run: updatedRun,
          fileBase64: fileBuffer.toString('base64'),
          fileName: `${run.runNumber ?? run.id}.${ext}`,
        };
      });

      return plain(result);
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

      return plain(result);
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

      return plain(result);
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
              userId: ctx.user?.id,
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

      return plain(result);
    }),

  // =========================================================================
  // importStatement — parse bank statement and match to run items
  // =========================================================================

  importStatement: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(
      z.object({
        runId: z.string().cuid(),
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

      return plain({ matches, transactions });
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

      return plain(result);
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

      return plain(result);
    }),

  // =========================================================================
  // listByContractor — payment items for contractor profile Payments tab
  // =========================================================================

  listByContractor: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(z.object({ contractorId: z.string().cuid() }))
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
        take: 100,
      });

      return plain(items);
    }),
});
