import type { Prisma } from '@contractor-ops/db';
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
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import {
  _buildExportItems,
  _generateExportFileForFormat,
  _resolveOrgBankInfo,
  allocateRunNumber,
  autoCompleteRunIfTerminal,
  groupInvoicesByCurrency,
  loadEligibleInvoices,
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
      // The non-null PaymentRun.createdByUserId FK is filled from the key's
      // attribution actor (guaranteed non-null by the actor model).
      const createdByUserId = ctx.apiKeyActingUserId;
      if (!createdByUserId) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: E.INVALID_ACTING_USER });
      }

      return ctx.db.$transaction(async tx => {
        const invoices = await loadEligibleInvoices(tx, ctx.organizationId, input.invoiceIds);
        validateInvoicesForRun(invoices, input.invoiceIds);

        const groups = groupInvoicesByCurrency(invoices, {
          groupByCurrency: input.groupByCurrency ?? true,
          currencyOverride: input.currency,
        });

        const runs: Prisma.PaymentRunGetPayload<{ select: typeof paymentRunSelect }>[] = [];
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

          runs.push(run);
        }

        return runs;
      });
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
          const invoiceIds = run.items.map(item => item.invoiceId);
          await tx.paymentRunItem.updateMany({
            where: { paymentRunId: run.id, status: { in: ['PENDING', 'EXPORTED'] } },
            data: { status: 'PAID', markedPaidAt: now },
          });
          await tx.invoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { paymentStatus: 'PAID', paidAt: now },
          });
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
      const run = await ctx.db.paymentRun.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
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
              contractor: { select: { legalName: true, taxId: true, currency: true } },
              billingProfile: {
                select: {
                  bankAccountMasked: true,
                  swiftBic: true,
                  bankName: true,
                  usRoutingNumberEncrypted: true,
                  usAccountNumberEncrypted: true,
                },
              },
            },
          },
        },
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.PAYMENT_RUN_NOT_FOUND });
      if (!VALID_TRANSITIONS[run.status]?.includes('EXPORTED')) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_RUN_INVALID_STATUS });
      }

      const { orgBank, transferTitleTemplate } = await ctx.db.$transaction(tx =>
        _resolveOrgBankInfo(tx, ctx.organizationId),
      );
      const exportItems = await _buildExportItems(ctx.db, run.items, transferTitleTemplate, {
        paymentDate: new Date(),
      });
      const { fileBuffer, ext } = await _generateExportFileForFormat(
        input.format,
        exportItems,
        orgBank,
        run.runNumber ?? run.id,
      );

      const now = new Date();
      const updated = await ctx.db.$transaction(async tx => {
        await tx.paymentRunItem.updateMany({
          where: { paymentRunId: run.id, status: 'PENDING' },
          data: { status: 'EXPORTED' },
        });
        const result = await tx.paymentRun.update({
          where: { id: run.id },
          data: { status: 'EXPORTED', exportFormat: input.format, exportedAt: now },
          select: paymentRunSelect,
        });
        await writePublicApiAudit({
          tx,
          ctx,
          action: 'payment_run.export',
          resourceType: 'PAYMENT_RUN',
          resourceId: run.id,
          resourceName: run.runNumber,
          oldValues: { status: run.status },
          newValues: { status: 'EXPORTED', exportFormat: input.format },
        });
        return result;
      });

      return {
        run: updated,
        fileBase64: fileBuffer.toString('base64'),
        fileName: `${run.runNumber ?? run.id}.${ext}`,
      };
    }),
});
