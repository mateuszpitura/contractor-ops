import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { syncSeatCountForOrg } from '../../services/billing-service';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';

export const contractorBulkRouter = router({
  bulkArchive: tenantProcedure
    .use(requirePermission({ contractor: ['delete'] }))
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const contractorsWithUnpaid = await ctx.db.invoice.groupBy({
        by: ['contractorId'],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          paymentStatus: { notIn: ['PAID', 'NOT_READY'] },
        },
      });

      const blockedByUnpaid = new Set(
        contractorsWithUnpaid.map(i => i.contractorId).filter(Boolean),
      );

      const contractorsWithActiveContracts = await ctx.db.contract.groupBy({
        by: ['contractorId'],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          deletedAt: null,
        },
      });

      const blockedByContracts = new Set(
        contractorsWithActiveContracts.map(c => c.contractorId).filter(Boolean),
      );
      const blockedIds = new Set([...blockedByUnpaid, ...blockedByContracts]);
      const archivableIds = input.ids.filter(id => !blockedIds.has(id));

      if (archivableIds.length === 0 && blockedIds.size > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            blockedByContracts.size > 0
              ? E.CONTRACTOR_HAS_ACTIVE_CONTRACTS
              : E.CONTRACTOR_HAS_UNPAID_INVOICES,
        });
      }

      const result = await ctx.db.contractor.updateMany({
        where: {
          id: { in: archivableIds },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: {
          status: 'ARCHIVED',
          lifecycleStage: 'ENDED',
          archivedAt: new Date(),
        },
      });

      if (result.count > 0) {
        void syncSeatCountForOrg(ctx.organizationId);
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { count: result.count };
    }),

  bulkAssignOwner: tenantProcedure
    .use(requirePermission({ contractor: ['update'] }))
    .input(
      z.object({
        ids: z.array(z.string().min(1)).min(1).max(100),
        ownerUserId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.contractor.updateMany({
        where: {
          id: { in: input.ids },
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        data: { ownerUserId: input.ownerUserId },
      });

      return { count: result.count };
    }),
});
