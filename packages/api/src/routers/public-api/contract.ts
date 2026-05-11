import type { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const listInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z
    .enum([
      'DRAFT',
      'PENDING_SIGNATURE',
      'ACTIVE',
      'EXPIRING',
      'EXPIRED',
      'TERMINATED',
      'SUPERSEDED',
      'ARCHIVED',
    ])
    .optional(),
  contractorId: z.string().optional(),
  sortBy: z.enum(['title', 'startDate', 'endDate', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ---------------------------------------------------------------------------
// Public API contract router
// ---------------------------------------------------------------------------

export const publicContractRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, status, contractorId, sortBy, sortOrder } = input;

      const where: Prisma.ContractWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (status) where.status = status;
      if (contractorId) where.contractorId = contractorId;

      const [items, total] = await Promise.all([
        ctx.db.contract.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            startDate: true,
            endDate: true,
            currency: true,
            billingModel: true,
            rateType: true,
            rateValueMinor: true,
            autoRenewal: true,
            contractorId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        ctx.db.contract.count({ where }),
      ]);

      return { items, total, page, pageSize };
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ contract: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contract = await ctx.db.contract.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          startDate: true,
          endDate: true,
          noticePeriodDays: true,
          autoRenewal: true,
          renewalTerms: true,
          currency: true,
          billingModel: true,
          rateType: true,
          rateValueMinor: true,
          retainerAmountMinor: true,
          expectedHoursPerPeriod: true,
          paymentTermsDays: true,
          invoiceCycle: true,
          notes: true,
          contractorId: true,
          createdAt: true,
          updatedAt: true,
          contractor: {
            select: { id: true, legalName: true, displayName: true },
          },
        },
      });

      if (!contract) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACT_NOT_FOUND,
        });
      }

      return contract;
    }),
});
