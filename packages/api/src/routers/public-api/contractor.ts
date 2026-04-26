import type { Prisma } from '@contractor-ops/db';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors.js';
import { router } from '../../init.js';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth.js';
import { requirePermission } from '../../middleware/rbac.js';

// ---------------------------------------------------------------------------
// Input schemas (simplified for public API)
// ---------------------------------------------------------------------------

const listInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  lifecycleStage: z.enum(['DRAFT', 'ONBOARDING', 'ACTIVE', 'OFFBOARDING', 'ENDED']).optional(),
  sortBy: z.enum(['legalName', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ---------------------------------------------------------------------------
// Public API contractor router
// ---------------------------------------------------------------------------

export const publicContractorRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(listInput)
    .query(async ({ ctx, input }) => {
      const { page, pageSize, status, lifecycleStage, sortBy, sortOrder } = input;

      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (status) where.status = status;
      if (lifecycleStage) where.lifecycleStage = lifecycleStage;

      const [items, total] = await Promise.all([
        ctx.db.contractor.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          select: {
            id: true,
            legalName: true,
            displayName: true,
            type: true,
            taxId: true,
            vatId: true,
            email: true,
            phone: true,
            countryCode: true,
            currency: true,
            status: true,
            lifecycleStage: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        ctx.db.contractor.count({ where }),
      ]);

      return { items, total, page, pageSize };
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const contractor = await ctx.db.contractor.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          id: true,
          legalName: true,
          displayName: true,
          type: true,
          taxId: true,
          vatId: true,
          registrationNumber: true,
          email: true,
          phone: true,
          countryCode: true,
          currency: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postalCode: true,
          status: true,
          lifecycleStage: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: E.CONTRACTOR_NOT_FOUND,
        });
      }

      return contractor;
    }),
});
