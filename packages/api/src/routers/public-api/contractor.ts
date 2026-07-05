import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiContractorListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
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
      const where: Prisma.ContractorWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
      };

      if (input.filter?.status) where.status = input.filter.status;
      if (input.filter?.lifecycleStage) where.lifecycleStage = input.filter.lifecycleStage;

      const rows = await ctx.db.contractor.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
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
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });

      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
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
