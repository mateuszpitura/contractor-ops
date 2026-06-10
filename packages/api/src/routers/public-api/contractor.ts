import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiContractorListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// ---------------------------------------------------------------------------
// Input schemas (simplified for public API)
// ---------------------------------------------------------------------------

const listInput = publicApiContractorListInputSchema;

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
    .input(entityIdSchema)
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
