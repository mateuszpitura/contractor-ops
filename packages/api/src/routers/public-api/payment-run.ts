import type { Prisma } from '@contractor-ops/db';
import type { PaymentRun } from '@contractor-ops/db/generated/prisma/client';
import {
  entityIdSchema,
  publicApiPaymentRunCreateInputSchema,
  publicApiPaymentRunExportInputSchema,
  publicApiPaymentRunListInputSchema,
  publicApiPaymentRunTransitionInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { acquireXactLock } from '../../lib/advisory-lock';
import {
  clear as clearIdempotency,
  complete as completeIdempotency,
  reserve as reserveIdempotency,
} from '../../lib/idempotency';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { assertContractorPaymentEligibility } from '../../services/compliance-payment-gate';
import {
  _buildExportItems,
  _generateExportFileForFormat,
  _resolveOrgBankInfo,
  allocateRunNumber,
  applyInvoicePaymentOutcome,
  assertExportItemsMatchRequestedFormat,
  assertRunItemCurrenciesMatchRun,
  groupInvoicesByCurrency,
  IDEMPOTENCY_TTL_SECONDS,
  loadEligibleInvoices,
  persistExportSettlements,
  seedRunItems,
  VALID_TRANSITIONS,
  validateInvoicesForRun,
} from '../finance/payment-shared';
import { writePublicApiAudit } from './write-shared';

const paymentRunSelect = {
  id: true,
  runNumber: true,
  name: true,
  status: true,
  currency: true,
  totalMinor: true,
  invoiceCount: true,
  exportFormat: true,
  exportedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PaymentRunSelect;

const exportItemInclude = {
  invoice: {
    select: {
      invoiceNumber: true,
      dueDate: true,
      servicePeriodStart: true,
      servicePeriodEnd: true,
    },
  },
  contractor: { select: { legalName: true, taxId: true, currency: true } },
  billingProfile: {
    select: {
      bankAccountMasked: true,
      bankAccountEncrypted: true,
      swiftBic: true,
      bankName: true,
      usRoutingNumberEncrypted: true,
      usAccountNumberEncrypted: true,
    },
  },
} as const;

export const publicPaymentRunRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(publicApiPaymentRunListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.PaymentRunWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.PaymentRunWhereInput['status'];

      const rows = await ctx.db.paymentRun.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: paymentRunSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.paymentRun.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: paymentRunSelect,
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
      return run;
    }),

  create: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['create'] }))
    .input(publicApiPaymentRunCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const createdByUserId = ctx.apiKeyActingUserId;
      if (!createdByUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: E.INVALID_ACTING_USER });
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

      let runs: Prisma.PaymentRunGetPayload<{ select: typeof paymentRunSelect }>[];
      try {
        runs = await ctx.db.$transaction(async tx => {
          const invoices = await loadEligibleInvoices(tx, ctx.organizationId, input.invoiceIds);
          validateInvoicesForRun(invoices, input.invoiceIds);

          const groups = groupInvoicesByCurrency(invoices, {
            groupByCurrency: input.groupByCurrency ?? true,
            currencyOverride: input.currency,
          });

          await acquireXactLock(
            tx as unknown as Parameters<typeof acquireXactLock>[0],
            'payment',
            ctx.organizationId,
          );

          const created: Prisma.PaymentRunGetPayload<{ select: typeof paymentRunSelect }>[] = [];
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
                createdByUserId,
                totalMinor,
                invoiceCount: groupInvoices.length,
                notes: input.notes ?? null,
              },
              select: paymentRunSelect,
            });

            await seedRunItems(tx, {
              organizationId: ctx.organizationId,
              runId: run.id,
              invoices: groupInvoices,
            });

            await writePublicApiAudit({
              tx,
              ctx,
              action: 'payment_run.create',
              resourceType: 'PAYMENT_RUN',
              resourceId: run.id,
              resourceName: run.runNumber,
              newValues: {
                status: run.status,
                currency: run.currency,
                totalMinor: run.totalMinor,
                invoiceCount: run.invoiceCount,
              },
            });

            created.push(run);
          }

          return created;
        });

        if (cacheKey) {
          await completeIdempotency(cacheKey, runs, IDEMPOTENCY_TTL_SECONDS);
        }
      } catch (err) {
        if (cacheKey) {
          await clearIdempotency(cacheKey);
        }
        throw err;
      }

      return runs;
    }),

  transition: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['update'] }))
    .input(publicApiPaymentRunTransitionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: { items: true },
        });
        if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });

        if (!VALID_TRANSITIONS[run.status]?.includes(input.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
        }

        const now = new Date();
        if (input.status === 'CANCELLED') {
          const unpaidInvoiceIds = run.items
            .filter(item => item.status !== 'PAID')
            .map(item => item.invoiceId);
          if (unpaidInvoiceIds.length > 0) {
            await tx.invoice.updateMany({
              where: { id: { in: unpaidInvoiceIds } },
              data: { paymentStatus: 'READY' },
            });
          }
        } else {
          const payableItems = run.items.filter(item =>
            ['PENDING', 'EXPORTED'].includes(item.status),
          );
          if (payableItems.length > 0) {
            const payableItemIds = payableItems.map(item => item.id);
            await tx.paymentRunItem.updateMany({
              where: { id: { in: payableItemIds } },
              data: { status: 'PAID', markedPaidAt: now },
            });

            for (const item of payableItems) {
              await applyInvoicePaymentOutcome(tx, {
                organizationId: ctx.organizationId,
                invoiceId: item.invoiceId,
                amountMinor: item.amountMinor,
                paidAt: now,
                sourceKind: 'PAYMENT_RUN',
                sourcePaymentRunItemId: item.id,
                createdByUserId: ctx.apiKeyActingUserId ?? undefined,
              });
            }
          }
        }

        const updated = await tx.paymentRun.update({
          where: { id: run.id },
          data: {
            status: input.status,
            ...(input.status === 'COMPLETED' && { completedAt: now }),
          },
          select: paymentRunSelect,
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'payment_run.transition',
          resourceType: 'PAYMENT_RUN',
          resourceId: run.id,
          resourceName: run.runNumber,
          oldValues: { status: run.status },
          newValues: { status: input.status },
        });

        return updated;
      });
    }),

  export: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['export'] }))
    .input(publicApiPaymentRunExportInputSchema)
    .mutation(async ({ ctx, input }) => {
      const prepared = await ctx.db.$transaction(async tx => {
        const run = await tx.paymentRun.findFirst({
          where: { id: input.id, organizationId: ctx.organizationId },
          include: { items: { include: exportItemInclude } },
        });
        if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });

        if (run.status === 'EXPORTED') {
          // `run` above is include-loaded with billing-profile ciphertext
          // (bankAccountEncrypted/us*Encrypted) + contractor.taxId for the file
          // builder; none of it may reach an external API consumer. Re-select the
          // public-safe shape for the idempotent replay.
          const safeRun = await tx.paymentRun.findFirstOrThrow({
            where: { id: input.id, organizationId: ctx.organizationId },
            select: paymentRunSelect,
          });
          return { run: safeRun, idempotent: true as const };
        }

        if (
          !(
            VALID_TRANSITIONS[run.status]?.includes('LOCKED') ||
            VALID_TRANSITIONS[run.status]?.includes('EXPORTED')
          )
        ) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
        }

        const itemCurrencies = await tx.paymentRunItem.findMany({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          select: { currency: true },
          distinct: ['currency'],
        });
        if (!run.currency) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
        }
        assertRunItemCurrenciesMatchRun(run.currency, itemCurrencies);

        const distinctContractorIds = Array.from(
          new Set(run.items.map(i => i.contractorId).filter((x): x is string => Boolean(x))),
        );
        await assertContractorPaymentEligibility(distinctContractorIds, {
          tx,
          organizationId: ctx.organizationId,
        });

        const itemsAgg = await tx.paymentRunItem.aggregate({
          where: { paymentRunId: run.id, status: { not: 'SKIPPED' } },
          _sum: { amountMinor: true },
          _count: true,
        });

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

      const { items: exportItems, settlements } = await _buildExportItems(
        ctx.db,
        prepared.run.items,
        prepared.transferTitleTemplate,
        { paymentDate: new Date() },
      );
      assertExportItemsMatchRequestedFormat(input.format, exportItems);

      const { fileBuffer, ext } = await _generateExportFileForFormat(
        input.format,
        exportItems,
        prepared.orgBank,
        prepared.run.runNumber ?? prepared.run.id,
      );

      const now = new Date();
      const updated = await ctx.db.$transaction(async tx => {
        const transition = await tx.paymentRun.updateMany({
          where: {
            id: prepared.run.id,
            organizationId: ctx.organizationId,
            status: { in: ['DRAFT', 'LOCKED'] },
          },
          data: {
            status: 'EXPORTED',
            exportFormat: input.format,
            exportedAt: now,
            totalMinor: prepared.freshTotalMinor,
            invoiceCount: prepared.freshInvoiceCount,
          },
        });

        if (transition.count !== 1) {
          const current = await tx.paymentRun.findFirst({
            where: { id: prepared.run.id, organizationId: ctx.organizationId },
            select: paymentRunSelect,
          });
          if (!current) {
            throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
          }
          return { run: current, exported: false as const };
        }

        await tx.paymentRunItem.updateMany({
          where: { paymentRunId: prepared.run.id, status: 'PENDING' },
          data: { status: 'EXPORTED' },
        });

        const result = await tx.paymentRun.findFirstOrThrow({
          where: { id: prepared.run.id, organizationId: ctx.organizationId },
          select: paymentRunSelect,
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'payment_run.export',
          resourceType: 'PAYMENT_RUN',
          resourceId: prepared.run.id,
          resourceName: prepared.run.runNumber,
          oldValues: { status: prepared.run.status },
          newValues: { status: 'EXPORTED', exportFormat: input.format },
        });

        return { run: result, exported: true as const };
      });

      if (!updated.exported) {
        return {
          run: updated.run,
          fileBase64: null,
          fileName: null,
          idempotent: true,
        };
      }

      await persistExportSettlements(ctx.db, settlements);

      return {
        run: updated.run,
        fileBase64: fileBuffer.toString('base64'),
        fileName: `${prepared.run.runNumber ?? prepared.run.id}.${ext}`,
      };
    }),
});
