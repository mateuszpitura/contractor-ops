import { authApi } from '@contractor-ops/auth';
import type { Prisma } from '@contractor-ops/db';
import { Prisma as PrismaClient } from '@contractor-ops/db/generated/prisma/client';
import {
  approvalQueueSchema,
  approveStepSchema,
  bulkApproveSchema,
  bulkRejectSchema,
  delegateStepSchema,
  rejectStepSchema,
  requestClarificationSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import type { TxClient } from '../../services/approval-engine';
import { advanceFlow, computeSlaStatus } from '../../services/approval-engine';
import { approvalStatusToPrismaWhere } from '../../services/approval-filters.js';
import { writeAuditLog } from '../../services/audit-writer';
import { CacheKeys, invalidateByPrefix } from '../../services/cache';
import { syncPaymentDueDeadline } from '../../services/calendar-deadline-sync';
import {
  approvalQueueSqlConditions,
  dispatchDecisionNotification,
  dispatchNextApproverNotification,
  finalizeApprovedInvoice,
  plain,
  processBulkApprovalSteps,
  validateStepForAction,
} from './approval-shared';
import type { ApprovalQueueStepRow } from './approval-types';
import { approvalStepQueueInclude } from './approval-types';

export const approvalQueueRouter = router({
  listPending: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(approvalQueueSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.ApprovalStepWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (input.tab === 'my') {
        where.approverUserId = ctx.user?.id;
      }

      const statusWhere = approvalStatusToPrismaWhere(input.status);
      Object.assign(where, statusWhere);

      let steps: ApprovalQueueStepRow[];
      let total: number;

      if (input.sortBy === 'amount') {
        const sqlConditions = approvalQueueSqlConditions(ctx.organizationId, ctx.user?.id, input);
        const whereSql = PrismaClient.sql`WHERE ${PrismaClient.join(sqlConditions, ' AND ')}`;
        const orderDirSql =
          input.sortOrder === 'asc' ? PrismaClient.sql`ASC` : PrismaClient.sql`DESC`;
        const skip = (input.page - 1) * input.pageSize;

        const [idRows, totalCount] = await Promise.all([
          ctx.db.$queryRaw<Array<{ id: string }>>`
            SELECT s.id
            FROM "ApprovalStep" s
            INNER JOIN "ApprovalFlow" f ON f.id = s."approvalFlowId"
            LEFT JOIN "Invoice" i ON i.id = f."resourceId" AND f."resourceType" = 'INVOICE'::"EntityType"
            ${whereSql}
            ORDER BY COALESCE(i."amountToPayMinor", 0) ${orderDirSql}
            LIMIT ${input.pageSize} OFFSET ${skip}
          `,
          ctx.db.approvalStep.count({ where }),
        ]);

        total = totalCount;
        const ids = idRows.map(r => r.id);

        if (ids.length === 0) {
          return {
            items: [],
            total,
            page: input.page,
            pageSize: input.pageSize,
          };
        }

        const unordered = await ctx.db.approvalStep.findMany({
          where: { id: { in: ids } },
          include: approvalStepQueueInclude,
        });
        const order = new Map(ids.map((id, idx) => [id, idx]));
        steps = [...unordered].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      } else {
        const orderBy: Prisma.ApprovalStepOrderByWithRelationInput =
          input.sortBy === 'submitted'
            ? { approvalFlow: { startedAt: input.sortOrder } }
            : { slaDeadline: input.sortOrder };

        [steps, total] = await Promise.all([
          ctx.db.approvalStep.findMany({
            where,
            skip: (input.page - 1) * input.pageSize,
            take: input.pageSize,
            orderBy,
            include: approvalStepQueueInclude,
          }),
          ctx.db.approvalStep.count({ where }),
        ]);
      }

      const invoiceIds = [...new Set(steps.map(s => s.approvalFlow.resourceId))];

      const invoices = await ctx.db.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          invoiceNumber: true,
          sellerName: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
          contractor: {
            select: { id: true, legalName: true },
          },
        },
      });

      const invoiceMap = new Map(invoices.map(inv => [inv.id, inv]));

      const chainConfigIds = [
        ...new Set(steps.map(s => s.approvalFlow.chainConfigId).filter(Boolean) as string[]),
      ];

      const chainConfigs =
        chainConfigIds.length > 0
          ? await ctx.db.approvalChainConfig.findMany({
              where: { id: { in: chainConfigIds } },
              select: { id: true, stepsJson: true },
            })
          : [];

      const chainConfigMap = new Map(chainConfigs.map(c => [c.id, c.stepsJson]));

      const enrichedSteps = steps.map(step => {
        const invoice = invoiceMap.get(step.approvalFlow.resourceId);
        const chainSteps = step.approvalFlow.chainConfigId
          ? (chainConfigMap.get(step.approvalFlow.chainConfigId) as
              | Array<{ slaHours?: number }>
              | undefined)
          : undefined;
        const stepConfig = chainSteps?.[step.stepOrder - 1];
        const slaHours = stepConfig?.slaHours;

        return {
          ...step,
          invoice: invoice ?? null,
          slaStatus: computeSlaStatus(step.slaDeadline, step.status, slaHours),
        };
      });

      return {
        items: plain(enrichedSteps),
        total,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  actionableCount: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .query(async ({ ctx }) => {
      const userId = ctx.user?.id;
      if (!userId) return { count: 0 };

      const countPromises: Promise<number>[] = [
        ctx.db.approvalStep.count({
          where: {
            organizationId: ctx.organizationId,
            approverUserId: userId,
            status: 'PENDING',
          },
        }),
      ];

      if (ctx.authMode !== 'apiKey') {
        const settingsPerm = await authApi.hasPermission({
          headers: ctx.headers,
          body: { permissions: { settings: ['read'] } },
        });
        if (settingsPerm?.success) {
          countPromises.push(
            ctx.db.contractorChangeRequest.count({
              where: {
                organizationId: ctx.organizationId,
                status: 'PENDING',
              },
            }),
          );
        }
      }

      const parts = await Promise.all(countPromises);
      return { count: parts.reduce((sum, n) => sum + n, 0) };
    }),

  approve: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(approveStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
          include: { approvalFlow: true },
        });
        validateStepForAction(step, ctx.user?.id);

        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'APPROVE',
            comment: input.comment ?? null,
          },
        });

        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'APPROVED',
            actedAt: new Date(),
            decision: 'APPROVE',
            comment: input.comment ?? null,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'approval.approve',
          resourceType: step.approvalFlow.resourceType,
          resourceId: step.approvalFlow.resourceId,
          oldValues: { status: step.status },
          newValues: { status: 'APPROVED' },
          metadata: {
            stepId: step.id,
            approvalFlowId: step.approvalFlowId,
            comment: input.comment ?? null,
          },
        });

        const advanceResult = await advanceFlow(tx as TxClient, step.approvalFlowId);

        if (advanceResult.completed) {
          await tx.invoice.update({
            where: { id: step.approvalFlow.resourceId },
            data: {
              status: 'APPROVED',
              paymentStatus: 'READY',
              readyForPaymentAt: new Date(),
            },
          });
        }

        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: {
            id: true,
            invoiceNumber: true,
            totalMinor: true,
            currency: true,
            contractorId: true,
            dueDate: true,
          },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { id: true, createdByUserId: true, steps: { orderBy: { stepOrder: 'asc' } } },
        });

        return { updatedStep, advanceResult, invoice, flow };
      });

      dispatchDecisionNotification(
        ctx.organizationId,
        'approved',
        result.invoice,
        result.flow?.createdByUserId,
        ctx.user?.name ?? 'approver',
      );

      if (
        !result.advanceResult.completed &&
        result.advanceResult.nextStepOrder &&
        result.flow &&
        result.invoice
      ) {
        const nextStep = result.flow.steps.find(
          s => s.stepOrder === result.advanceResult.nextStepOrder,
        );
        if (nextStep) {
          void dispatchNextApproverNotification(
            ctx.db,
            ctx.organizationId,
            result.invoice,
            result.flow.id,
            nextStep,
          );
        }
      }

      if (result.advanceResult.completed && result.invoice?.dueDate) {
        const contractor = result.invoice.contractorId
          ? await ctx.db.contractor.findUnique({
              where: { id: result.invoice.contractorId },
              select: { displayName: true },
            })
          : null;
        void syncPaymentDueDeadline(ctx.db, {
          organizationId: ctx.organizationId,
          invoiceId: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber ?? `INV-${result.invoice.id.slice(-6)}`,
          contractorName: contractor?.displayName ?? 'Unknown',
          dueDate: new Date(result.invoice.dueDate),
          userId: ctx.user?.id,
        }).catch(_err => {
          /* fire-and-forget */
        });
      }

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result.updatedStep);
    }),

  reject: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(rejectStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
          include: { approvalFlow: true },
        });
        validateStepForAction(step, ctx.user?.id);

        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'REJECTED',
            actedAt: new Date(),
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'approval.reject',
          resourceType: step.approvalFlow.resourceType,
          resourceId: step.approvalFlow.resourceId,
          oldValues: { status: step.status },
          newValues: { status: 'REJECTED' },
          metadata: {
            stepId: step.id,
            approvalFlowId: step.approvalFlowId,
            comment: input.comment,
          },
        });

        await tx.approvalFlow.update({
          where: { id: step.approvalFlowId },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: step.approvalFlow.resourceId },
          data: { status: 'REJECTED' },
        });

        const invoice = await tx.invoice.findUnique({
          where: { id: step.approvalFlow.resourceId },
          select: { id: true, invoiceNumber: true },
        });

        const flow = await tx.approvalFlow.findUnique({
          where: { id: step.approvalFlowId },
          select: { createdByUserId: true },
        });

        return { updatedStep, invoice, flow };
      });

      dispatchDecisionNotification(
        ctx.organizationId,
        'rejected',
        result.invoice,
        result.flow?.createdByUserId,
        ctx.user?.name ?? 'approver',
        input.comment,
      );

      return plain(result.updatedStep);
    }),

  delegate: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(delegateStepSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
        });
        validateStepForAction(step, ctx.user?.id);

        const delegateMember = await tx.member.findFirst({
          where: {
            organizationId: ctx.organizationId,
            userId: input.delegateToUserId,
          },
        });

        if (!delegateMember) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: E.APPROVAL_DELEGATE_NOT_MEMBER,
          });
        }

        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'DELEGATE',
            comment: input.comment ?? null,
          },
        });

        const updatedStep = await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            approverUserId: input.delegateToUserId,
          },
        });

        return updatedStep;
      });

      void invalidateByPrefix(CacheKeys.dashboardPrefix(ctx.organizationId));

      return plain(result);
    }),

  requestClarification: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(requestClarificationSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.$transaction(async tx => {
        const step = await tx.approvalStep.findFirst({
          where: { id: input.stepId, organizationId: ctx.organizationId },
        });
        validateStepForAction(step, ctx.user?.id);

        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REQUEST_CHANGES',
            comment: input.comment,
          },
        });

        return step;
      });

      return plain(result);
    }),

  bulkApprove: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(bulkApproveSchema)
    .mutation(({ ctx, input }) =>
      processBulkApprovalSteps(ctx, input.stepIds, async (tx, step) => {
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'APPROVE',
          },
        });

        await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'APPROVED',
            actedAt: new Date(),
            decision: 'APPROVE',
          },
        });

        const advanceResult = await advanceFlow(tx, step.approvalFlowId);

        if (advanceResult.completed) {
          await finalizeApprovedInvoice(tx, {
            resourceId: step.approvalFlow.resourceId,
            organizationId: ctx.organizationId,
            db: ctx.db,
            userId: ctx.user?.id,
          });
        }
      }),
    ),

  bulkReject: tenantProcedure
    .use(requirePermission({ invoice: ['approve'] }))
    .input(bulkRejectSchema)
    .mutation(({ ctx, input }) =>
      processBulkApprovalSteps(ctx, input.stepIds, async (tx, step) => {
        await tx.approvalDecision.create({
          data: {
            organizationId: ctx.organizationId,
            approvalStepId: step.id,
            actorUserId: ctx.user?.id,
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        await tx.approvalStep.update({
          where: { id: step.id },
          data: {
            status: 'REJECTED',
            actedAt: new Date(),
            decision: 'REJECT',
            comment: input.comment,
          },
        });

        await tx.approvalFlow.update({
          where: { id: step.approvalFlowId },
          data: {
            status: 'REJECTED',
            completedAt: new Date(),
          },
        });

        await tx.invoice.update({
          where: { id: step.approvalFlow.resourceId },
          data: { status: 'REJECTED' },
        });
      }),
    ),
});
