import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiWorkflowTaskListInputSchema,
  publicApiWorkflowTaskTransitionInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import { unblockDependentsAndRecomputeRun, validateTransition } from '../workflow/workflow-shared';
import { writePublicApiAudit } from './write-shared';

const workflowTaskSelect = {
  id: true,
  workflowRunId: true,
  description: true,
  status: true,
  assigneeRole: true,
  dueAt: true,
  startedAt: true,
  completedAt: true,
  dependsOnTaskRunId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkflowTaskRunSelect;

export const publicWorkflowTaskRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(publicApiWorkflowTaskListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.WorkflowTaskRunWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.WorkflowTaskRunWhereInput['status'];
      if (input.filter?.workflowRunId) where.workflowRunId = input.filter.workflowRunId;

      const rows = await ctx.db.workflowTaskRun.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: workflowTaskSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.workflowTaskRun.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: workflowTaskSelect,
      });
      if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKFLOW_TASK_NOT_FOUND });
      return task;
    }),

  transition: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(publicApiWorkflowTaskTransitionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async tx => {
        const task = await findOrThrow(
          () =>
            tx.workflowTaskRun.findFirst({
              where: { id: input.taskRunId, organizationId: ctx.organizationId },
              include: { workflowRun: { select: { id: true, status: true } } },
            }),
          E.WORKFLOW_TASK_NOT_FOUND,
        );

        if (task.workflowRun.status !== 'IN_PROGRESS') {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.WORKFLOW_TASK_INVALID_STATUS });
        }
        if (!validateTransition(task.status, input.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.WORKFLOW_TASK_INVALID_STATUS });
        }

        const now = new Date();
        const data: Prisma.WorkflowTaskRunUpdateInput =
          input.status === 'DONE'
            ? {
                status: 'DONE',
                completedAt: now,
                startedAt: task.startedAt ?? now,
                ...(ctx.apiKeyActingUserId && {
                  completedBy: { connect: { id: ctx.apiKeyActingUserId } },
                }),
              }
            : { status: 'SKIPPED', resultJson: { skipReason: input.reason ?? null } };

        const updated = await tx.workflowTaskRun.update({
          where: { id: task.id },
          data,
          select: workflowTaskSelect,
        });

        await unblockDependentsAndRecomputeRun(tx, task, now, {
          organizationId: ctx.organizationId,
        });

        await writePublicApiAudit({
          tx,
          ctx,
          action: 'workflow_task.transition',
          resourceType: 'WORKFLOW_TASK_RUN',
          resourceId: task.id,
          oldValues: { status: task.status },
          newValues: { status: input.status, workflowRunId: task.workflowRun.id },
        });

        return updated;
      });
    }),
});
