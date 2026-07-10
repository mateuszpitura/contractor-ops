import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { writeAuditLog } from '../../services/audit-writer';
import { syncSeatCountForOrg } from '../../services/billing-service';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';

export const contractorBulkRouter = router({
  bulkArchive: tenantProcedure
    .use(requirePermission({ contractor: ['delete'] }))
    .input(z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const inRunByContractor = await ctx.db.invoice.groupBy({
        by: ['contractorId'],
        where: {
          contractorId: { in: input.ids },
          organizationId: ctx.organizationId,
          paymentStatus: 'IN_RUN',
          deletedAt: null,
        },
      });

      const blockedByInRun = new Set(inRunByContractor.map(i => i.contractorId).filter(Boolean));

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
      const blockedIds = new Set([...blockedByInRun, ...blockedByContracts]);
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

      let count = 0;
      for (const contractorId of archivableIds) {
        await ctx.db.$transaction(async tx => {
          const contractor = await tx.contractor.findFirst({
            where: { id: contractorId, organizationId: ctx.organizationId },
            select: { id: true, displayName: true, status: true, lifecycleStage: true },
          });
          if (!contractor) return;

          const openInvoices = await tx.invoice.findMany({
            where: {
              contractorId,
              organizationId: ctx.organizationId,
              deletedAt: null,
              status: { not: 'VOID' },
              paymentStatus: { notIn: ['PAID'] },
            },
            select: { id: true, invoiceNumber: true, status: true, paymentStatus: true },
          });
          const openInvoiceIds = openInvoices.map(row => row.id);
          const voidedReadyInvoices = openInvoices.filter(row => row.paymentStatus === 'READY');

          if (openInvoiceIds.length > 0) {
            await tx.approvalFlow.updateMany({
              where: {
                organizationId: ctx.organizationId,
                resourceType: 'INVOICE',
                resourceId: { in: openInvoiceIds },
                status: 'PENDING',
              },
              data: { status: 'CANCELLED', completedAt: new Date() },
            });

            await tx.invoice.updateMany({
              where: { id: { in: openInvoiceIds }, organizationId: ctx.organizationId },
              data: { status: 'VOID', paymentStatus: 'NOT_READY', approvalStatus: 'NOT_STARTED' },
            });
          }

          await tx.workflowRun.updateMany({
            where: {
              contractorId,
              organizationId: ctx.organizationId,
              status: { in: ['IN_PROGRESS', 'BLOCKED'] },
            },
            data: { status: 'CANCELLED' },
          });

          await tx.contractorChangeRequest.updateMany({
            where: {
              contractorId,
              organizationId: ctx.organizationId,
              status: 'PENDING',
            },
            data: {
              status: 'REJECTED',
              reviewComment: 'Auto-rejected: contractor archived',
            },
          });

          await tx.contractor.update({
            where: { id: contractorId },
            data: {
              status: 'ARCHIVED',
              lifecycleStage: 'ENDED',
              archivedAt: new Date(),
            },
          });

          await writeAuditLog({
            organizationId: ctx.organizationId,
            actorType: 'USER',
            actorId: ctx.user?.id,
            action: 'DELETE',
            resourceType: 'CONTRACTOR',
            resourceId: contractorId,
            resourceName: contractor.displayName,
            oldValues: {
              status: contractor.status,
              lifecycleStage: contractor.lifecycleStage,
            },
            newValues: {
              status: 'ARCHIVED',
              lifecycleStage: 'ENDED',
            },
            metadata: {
              bulk: true,
              voidedInvoiceCount: openInvoiceIds.length,
              voidedReadyInvoiceIds: voidedReadyInvoices.map(row => row.id),
              voidedReadyInvoiceNumbers: voidedReadyInvoices.map(
                row => row.invoiceNumber ?? row.id,
              ),
            },
            tx,
          });
        });
        count += 1;
      }

      if (count > 0) {
        void syncSeatCountForOrg(ctx.organizationId);
        void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));
      }

      return { count };
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
