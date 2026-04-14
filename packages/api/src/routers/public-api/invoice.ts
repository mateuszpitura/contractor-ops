import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth.js';
import { requirePermission } from '../../middleware/rbac.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum([
      'RECEIVED',
      'UNDER_REVIEW',
      'APPROVAL_PENDING',
      'APPROVED',
      'REJECTED',
      'READY_FOR_PAYMENT',
      'PARTIALLY_PAID',
      'PAID',
      'VOID',
    ])
    .optional(),
  contractorId: z.string().optional(),
  sortBy: z.enum(['issueDate', 'dueDate', 'createdAt', 'totalMinor']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ---------------------------------------------------------------------------
// Public API invoice router
// ---------------------------------------------------------------------------

export const publicInvoiceRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, status, contractorId, sortBy, sortOrder } = input;

      const where: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (status) where.status = status;
      if (contractorId) where.contractorId = contractorId;

      const [items, total] = await Promise.all([
        ctx.db.invoice.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
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
        }),
        ctx.db.invoice.count({ where }),
      ]);

      return { items, total, page, pageSize };
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ invoice: ['read'] }))
    .input(z.object({ id: z.string() }))
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
});
