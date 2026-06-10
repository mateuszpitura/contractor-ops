import type { Prisma } from '@contractor-ops/db';
import type { PaymentRun } from '@contractor-ops/db/generated/prisma/client';
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
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLogMany } from '../../services/audit-writer';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import {
  allocateRunNumber,
  groupInvoicesByCurrency,
  IDEMPOTENCY_TTL_SECONDS,
  loadEligibleInvoices,
  seedRunItems,
  validateInvoicesForRun,
} from './payment-shared';

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
});
