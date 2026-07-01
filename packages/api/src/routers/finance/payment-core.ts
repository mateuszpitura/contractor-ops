import type { Prisma } from '@contractor-ops/db';
import type { PaymentRun } from '@contractor-ops/db/generated/prisma/client';
import { evaluate } from '@contractor-ops/feature-flags';
import type { PayoutInitiationAdapter } from '@contractor-ops/integrations';
import { MockModernTreasuryAdapter, StripeTreasuryAdapter } from '@contractor-ops/integrations';
import {
  paymentRunCreateSchema,
  paymentRunListSchema,
  readyForPaymentListSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { acquireXactLock } from '../../lib/advisory-lock';
import {
  clear as clearIdempotency,
  complete as completeIdempotency,
  reserve as reserveIdempotency,
} from '../../lib/idempotency';
import { requirePermission } from '../../middleware/rbac';
import { assertUsExpansionEnabled } from '../../middleware/require-us-expansion-flag';
import { tenantProcedure } from '../../middleware/tenant';
import { applyAchReturns, parseNachaReturnFile } from '../../services/ach-return.service';
import { writeAuditLog, writeAuditLogMany } from '../../services/audit-writer';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import type { PayoutProvider } from './payment-shared';
import {
  _initiatePayoutForRun,
  allocateRunNumber,
  groupInvoicesByCurrency,
  IDEMPOTENCY_TTL_SECONDS,
  loadEligibleInvoices,
  seedRunItems,
  validateInvoicesForRun,
} from './payment-shared';

/** Resolve the payout adapter for a provider. Mock is the GA default; the live
 * Modern Treasury originator and the Stripe stub are dark until wired. */
function resolvePayoutAdapter(provider: PayoutProvider): PayoutInitiationAdapter {
  return provider === 'STRIPE_TREASURY'
    ? new StripeTreasuryAdapter()
    : new MockModernTreasuryAdapter();
}

export const paymentCoreRouter = router({
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

  create: tenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(paymentRunCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const cacheKey = input.idempotencyKey
        ? `payment-run:${ctx.organizationId}:${input.idempotencyKey}`
        : null;

      if (cacheKey) {
        const hit = await reserveIdempotency<PaymentRun[]>(cacheKey, IDEMPOTENCY_TTL_SECONDS);
        if (hit.kind === 'PENDING') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: E.PAYMENT_RUN_CREATION_IN_PROGRESS,
          });
        }
        if (hit.kind === 'HIT') {
          return hit.result;
        }
      }

      const eligibilityInvoices = await ctx.db.invoice.findMany({
        where: { id: { in: input.invoiceIds }, organizationId: ctx.organizationId },
        select: { contractorId: true },
      });
      const distinctContractorIds = Array.from(
        new Set(
          eligibilityInvoices.map(i => i.contractorId).filter((x): x is string => Boolean(x)),
        ),
      );
      await assertContractorPaymentEligibility(distinctContractorIds, {
        organizationId: ctx.organizationId,
      });

      let result: PaymentRun[];
      try {
        result = await ctx.db.$transaction(async tx => {
          const invoices = await loadEligibleInvoices(tx, ctx.organizationId, input.invoiceIds);
          validateInvoicesForRun(invoices, input.invoiceIds);

          const groups = groupInvoicesByCurrency(invoices, {
            groupByCurrency: input.groupByCurrency,
            currencyOverride: input.currency,
          });

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

          await writeAuditLogMany({
            tx,
            rows: runs.map(run => ({
              organizationId: ctx.organizationId,
              actorType: 'USER' as const,
              actorId: ctx.user.id,
              action: 'payment_run.create',
              resourceType: 'PAYMENT_RUN' as const,
              resourceId: run.id,
              resourceName: run.runNumber,
              newValues: {
                status: run.status,
                currency: run.currency,
                totalMinor: run.totalMinor,
                invoiceCount: run.invoiceCount,
              },
            })),
          });

          return runs;
        });

        if (cacheKey) {
          await completeIdempotency(cacheKey, result, IDEMPOTENCY_TTL_SECONDS);
        }

        return result;
      } catch (err) {
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
            message: E.PAYMENT_RUN_NUMBER_COLLISION,
          });
        }
        throw err;
      }
    }),

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

  activityDates: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .query(async ({ ctx }) => {
      const rows = await ctx.db.$queryRaw<Array<{ d: string }>>`
        SELECT DISTINCT TO_CHAR("createdAt", 'YYYY-MM-DD') AS d
        FROM "PaymentRun"
        WHERE "organizationId" = ${ctx.organizationId}
        ORDER BY d DESC
        LIMIT 180
      `;
      return rows.map(r => r.d);
    }),

  listByContractor: tenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(
      z.object({
        contractorId: z.cuid(),
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
        take: input.take + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > input.take;
      const trimmed = hasMore ? items.slice(0, input.take) : items;
      const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : undefined;

      return { items: trimmed, nextCursor };
    }),

  // Opt-in programmatic-ACH payout. File export (lockAndExport) remains the
  // always-available default; this originates payouts via the PayoutInitiationAdapter
  // (Modern Treasury mock by default; live is dark). Gated on the US-expansion
  // surface + the existing payments.ach-payouts flag, idempotent, and audited.
  initiatePayout: tenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(
      z
        .object({
          runId: z.cuid(),
          idempotencyKey: z.string().min(1).max(200),
          provider: z.enum(['MODERN_TREASURY', 'STRIPE_TREASURY']).default('MODERN_TREASURY'),
          // Per-run settlement-currency override (else the contractor's currency).
          settlementCurrency: z.string().length(3).optional(),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const flagRegion = ctx.region === 'ME' ? ('ME' as const) : ('EU' as const);
      const flag = evaluate('payments.ach-payouts', {
        organizationId: ctx.organizationId,
        region: flagRegion,
      });
      if (!flag.enabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: E.PAYMENT_ACH_PAYOUTS_DISABLED,
          cause: { flag: 'payments.ach-payouts', reason: flag.reason },
        });
      }

      return _initiatePayoutForRun(ctx.db, {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        runId: input.runId,
        idempotencyKey: input.idempotencyKey,
        provider: input.provider,
        settlementCurrency: input.settlementCurrency,
        adapter: resolvePayoutAdapter(input.provider),
      });
    }),

  // File-first GA return-code ingestion. When an RDFI cannot post a credit it
  // returns the entry in a NACHA return file the operator downloads from their
  // bank; uploading it here parses the file and applies the returns to the run,
  // flipping bounced credits (R01/R02/R03 …) to FAILED and recording NOC/COR
  // corrections as advisory. Same gate as initiatePayout so a non-US or
  // unpermissioned caller is rejected before any payment state is touched.
  //
  // The live Modern Treasury return-webhook is a deferred seam: once the
  // programmatic-ACH live path is enabled it would feed the same applyAchReturns
  // via PayoutInitiationAdapter.handleWebhook. It is intentionally not built here
  // because programmatic ACH stays dark/opt-in, so the file upload is the only
  // reachable return-ingestion path today.
  ingestAchReturnFile: tenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(
      z
        .object({
          runId: z.cuid(),
          returnFileText: z.string().min(1).max(5_000_000),
        })
        .strict(),
    )
    .mutation(async ({ ctx, input }) => {
      assertUsExpansionEnabled(ctx.organizationId, ctx.region);

      const entries = parseNachaReturnFile(input.returnFileText);

      // The parser is defensive and never throws — a benign empty / non-return
      // upload yields zero entries and a clean all-zeros result. But a file that
      // carries return addenda-99 records yet parses to nothing is structurally
      // broken (wrong layout / truncated); surface it rather than report a
      // zeros-everywhere no-op the operator cannot distinguish from "no bounces".
      if (entries.length === 0 && /^799/m.test(input.returnFileText)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: E.PAYMENT_ACH_RETURN_FILE_INVALID,
        });
      }

      const summary = await applyAchReturns(ctx.db, {
        organizationId: ctx.organizationId,
        paymentRunId: input.runId,
        actorId: ctx.user.id,
        entries,
      });

      // Ingestion-level masked audit, in addition to the per-item transition
      // audit applyAchReturns writes: records who ingested a return file against
      // which run and the resulting disposition counts. No bank data and no raw
      // file content — only sizes and the summary tallies.
      await writeAuditLog({
        tx: ctx.db,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user.id,
        action: 'payment_run.ach_return_ingested',
        resourceType: 'PAYMENT_RUN',
        resourceId: input.runId,
        metadata: {
          entryCount: entries.length,
          fileBytes: input.returnFileText.length,
          failed: summary.failed,
          advisory: summary.advisory,
          skipped: summary.skipped,
          unmatched: summary.unmatched,
        },
      });

      return summary;
    }),
});
