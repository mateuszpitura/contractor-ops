import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiInvoiceCreateInputSchema,
  publicApiInvoiceListInputSchema,
  publicApiInvoiceVoidInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { computeDuplicateCheckHash } from '../../services/invoice-matching';
import { writePublicApiAudit } from './write-shared';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listInput = publicApiInvoiceListInputSchema;

// ---------------------------------------------------------------------------
// Public API invoice router
// ---------------------------------------------------------------------------

export const publicInvoiceRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const where: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (input.filter?.status) where.status = input.filter.status;
      if (input.filter?.contractorId) where.contractorId = input.filter.contractorId;

      const rows = await ctx.db.invoice.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          currency: true,
          subtotalMinor: true,
          vatAmountMinor: true,
          totalMinor: true,
          amountToPayMinor: true,
          sellerTaxId: true,
          sellerName: true,
          status: true,
          matchStatus: true,
          source: true,
          contractorId: true,
          contractId: true,
          isReverseCharge: true,
          createdAt: true,
          updatedAt: true,
        },
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });

      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          dueDate: true,
          servicePeriodStart: true,
          servicePeriodEnd: true,
          currency: true,
          subtotalMinor: true,
          vatRate: true,
          vatAmountMinor: true,
          totalMinor: true,
          withholdingMinor: true,
          amountToPayMinor: true,
          sellerTaxId: true,
          sellerName: true,
          sellerBankAccount: true,
          status: true,
          matchStatus: true,
          source: true,
          isReverseCharge: true,
          contractorId: true,
          contractId: true,
          createdAt: true,
          updatedAt: true,
          contractor: {
            select: { id: true, legalName: true, taxId: true },
          },
          contract: {
            select: { id: true, title: true, type: true, status: true },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.INVOICE_NOT_FOUND,
        });
      }

      return invoice;
    }),

  create: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['create'] }))
    .input(publicApiInvoiceCreateInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { issueDate, dueDate } = input;

      const contractor = await ctx.db.contractor.findFirst({
        where: { id: input.contractorId, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true },
      });
      if (!contractor) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
      }

      const vatAmountMinor = input.vatMinor ?? 0;
      const duplicateCheckHash =
        input.sellerTaxId && input.invoiceNumber
          ? computeDuplicateCheckHash(input.invoiceNumber, input.sellerTaxId, input.totalMinor)
          : null;

      if (duplicateCheckHash) {
        const existing = await ctx.db.invoice.findFirst({
          where: { organizationId: ctx.organizationId, duplicateCheckHash },
          select: { id: true },
        });
        if (existing) {
          throw new TRPCError({ code: 'CONFLICT', message: E.INVOICE_DUPLICATE });
        }
      }

      return ctx.db.$transaction(async tx => {
        const created = await tx.invoice.create({
          data: {
            organizationId: ctx.organizationId,
            contractorId: contractor.id,
            invoiceNumber: input.invoiceNumber,
            source: 'API',
            issueDate,
            dueDate,
            currency: input.currency,
            subtotalMinor: input.subtotalMinor,
            vatAmountMinor,
            totalMinor: input.totalMinor,
            amountToPayMinor: input.totalMinor,
            sellerTaxId: input.sellerTaxId ?? null,
            notes: input.description ?? null,
            duplicateCheckHash,
          },
          select: {
            id: true,
            invoiceNumber: true,
            currency: true,
            totalMinor: true,
            status: true,
            createdAt: true,
          },
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'invoice.create',
          resourceType: 'INVOICE',
          resourceId: created.id,
          resourceName: created.invoiceNumber,
          newValues: { totalMinor: created.totalMinor, currency: created.currency },
        });

        return created;
      });
    }),

  void: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['update'] }))
    .input(publicApiInvoiceVoidInputSchema)
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId, deletedAt: null },
        select: { id: true, invoiceNumber: true, status: true, paymentStatus: true },
      });
      if (!invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: E.INVOICE_NOT_FOUND });
      }
      if (invoice.paymentStatus === 'PAID' || invoice.paymentStatus === 'IN_RUN') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: E.INVOICE_VOID_NOT_ALLOWED });
      }

      return ctx.db.$transaction(async tx => {
        const result = await tx.invoice.updateMany({
          where: {
            id: input.id,
            organizationId: ctx.organizationId,
            deletedAt: null,
            status: { not: 'VOID' },
            paymentStatus: { notIn: ['PAID', 'IN_RUN'] },
          },
          data: {
            status: 'VOID',
            paymentStatus: 'NOT_READY',
            approvalStatus: 'CANCELLED',
            paidAt: null,
            readyForPaymentAt: null,
            approvedAt: null,
          },
        });
        if (result.count === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.INVOICE_VOID_NOT_ALLOWED });
        }

        await tx.approvalStep.updateMany({
          where: {
            organizationId: ctx.organizationId,
            status: { in: ['NOT_STARTED', 'PENDING'] },
            approvalFlow: { resourceType: 'INVOICE', resourceId: input.id },
          },
          data: { status: 'CANCELLED', actedAt: new Date() },
        });
        await tx.approvalFlow.updateMany({
          where: {
            organizationId: ctx.organizationId,
            resourceType: 'INVOICE',
            resourceId: input.id,
            status: { in: ['NOT_STARTED', 'PENDING'] },
          },
          data: { status: 'CANCELLED', completedAt: new Date(), cancelledAt: new Date() },
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'invoice.void',
          resourceType: 'INVOICE',
          resourceId: invoice.id,
          resourceName: invoice.invoiceNumber,
          oldValues: { status: invoice.status },
          newValues: { status: 'VOID' },
        });

        return { id: invoice.id, status: 'VOID' as const };
      });
    }),
});
