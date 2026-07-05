import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiWorkflowListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

const workflowSelect = {
  id: true,
  contractorId: true,
  contractId: true,
  status: true,
  startedAt: true,
  dueAt: true,
  completedAt: true,
  progressPercent: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkflowRunSelect;

export const publicWorkflowRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(publicApiWorkflowListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.WorkflowRunWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.status)
        where.status = input.filter.status as Prisma.WorkflowRunWhereInput['status'];
      if (input.filter?.contractorId) where.contractorId = input.filter.contractorId;

      const rows = await ctx.db.workflowRun.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: workflowSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),

  getById: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(entityIdSchema)
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.workflowRun.findFirst({
        where: { id: input.id, organizationId: ctx.organizationId },
        select: workflowSelect,
      });
      if (!run) throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKFLOW_RUN_NOT_FOUND });
      return run;
    }),
});
