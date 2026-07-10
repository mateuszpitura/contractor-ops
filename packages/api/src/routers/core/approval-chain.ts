import {
  approvalChainCreateSchema,
  approvalChainListSchema,
  approvalChainUpdateSchema,
  entityIdSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, CacheTTL, cached, invalidate } from '../../services/cache';
import { plain } from './approval-shared';

export const approvalChainRouter = router({
  listChains: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .input(approvalChainListSchema.optional())
    .query(async ({ ctx, input }) => {
      const resourceType = input?.resourceType;
      return cached(
        CacheKeys.approvalChains(ctx.organizationId, resourceType),
        CacheTTL.APPROVAL_CHAINS,
        async () => {
          const chains = await ctx.db.approvalChainConfig.findMany({
            where: {
              organizationId: ctx.organizationId,
              ...(resourceType ? { resourceType } : {}),
            },
            orderBy: { createdAt: 'asc' },
          });

          return plain(chains);
        },
      );
    }),

  getChain: tenantProcedure
    .use(requirePermission({ settings: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const chain = await findOrThrow(
        () =>
          ctx.db.approvalChainConfig.findFirst({
            where: {
              id: input.id,
              organizationId: ctx.organizationId,
            },
          }),
        E.APPROVAL_CHAIN_NOT_FOUND,
      );

      return plain(chain);
    }),

  createChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(approvalChainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const chain = await ctx.db.$transaction(async tx => {
        if (input.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: input.resourceType,
              isDefault: true,
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.create({
          data: {
            organizationId: ctx.organizationId,
            resourceType: input.resourceType,
            name: input.name,
            isDefault: input.isDefault,
            conditionsJson: input.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(input.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_CREATE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: chain.id,
        resourceName: chain.name,
        newValues: {
          name: chain.name,
          isDefault: chain.isDefault,
          resourceType: chain.resourceType,
        },
      });

      return plain(chain);
    }),

  updateChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(approvalChainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const updated = await ctx.db.$transaction(async tx => {
        const existing = await findOrThrow(
          () =>
            tx.approvalChainConfig.findFirst({
              where: { id, organizationId: ctx.organizationId },
            }),
          E.APPROVAL_CHAIN_NOT_FOUND,
        );

        if (data.isDefault) {
          await tx.approvalChainConfig.updateMany({
            where: {
              organizationId: ctx.organizationId,
              resourceType: existing.resourceType,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }

        return tx.approvalChainConfig.update({
          where: { id },
          data: {
            name: data.name,
            isDefault: data.isDefault,
            isActive: data.isActive,
            conditionsJson: data.conditionsJson ?? undefined,
            stepsJson: JSON.parse(JSON.stringify(data.stepsJson)),
          },
        });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_UPDATE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: updated.id,
        resourceName: updated.name,
        newValues: {
          name: updated.name,
          isDefault: updated.isDefault,
          isActive: updated.isActive,
        },
      });

      return plain(updated);
    }),

  deleteChain: tenantProcedure
    .use(requirePermission({ settings: ['update'] }))
    .input(entityIdSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db.$transaction(async tx => {
        await findOrThrow(
          () =>
            tx.approvalChainConfig.findFirst({
              where: { id: input.id, organizationId: ctx.organizationId },
            }),
          E.APPROVAL_CHAIN_NOT_FOUND,
        );

        const activeFlow = await tx.approvalFlow.findFirst({
          where: {
            chainConfigId: input.id,
            status: 'PENDING',
          },
        });

        if (activeFlow) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.APPROVAL_CHAIN_HAS_ACTIVE_FLOWS,
          });
        }

        await tx.approvalChainConfig.delete({ where: { id: input.id } });
      });

      void invalidate(CacheKeys.approvalChains(ctx.organizationId));

      await writeAuditLog({
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id ?? null,
        action: 'APPROVAL_CHAIN_DELETE',
        resourceType: 'APPROVAL_FLOW',
        resourceId: input.id,
        metadata: { chainId: input.id },
      });

      return { success: true };
    }),
});
