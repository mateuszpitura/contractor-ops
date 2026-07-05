import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiWorkflowTaskListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

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
});
