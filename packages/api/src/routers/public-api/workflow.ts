import type { Prisma } from '@contractor-ops/db';
import {
  entityIdSchema,
  publicApiWorkflowCreateInputSchema,
  publicApiWorkflowExecuteInputSchema,
  publicApiWorkflowListInputSchema,
} from '@contractor-ops/validators/public-api';
import { TRPCError } from '@trpc/server';
import * as E from '../../errors';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';
import type { TxClient } from '../workflow/workflow-execution-shared';
import { computeMaxDueDate, instantiateTaskRuns } from '../workflow/workflow-execution-shared';
import { calculateProgress } from '../workflow/workflow-shared';
import type { PublicWriteCtx } from './write-shared';
import { writePublicApiAudit } from './write-shared';

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

  create: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['create'] }))
    .input(publicApiWorkflowCreateInputSchema)
    .mutation(({ ctx, input }) => startWorkflowRun(ctx, input, 'workflow.create')),

  execute: apiKeyTenantProcedure
    .use(requirePermission({ workflow: ['execute'] }))
    .input(publicApiWorkflowExecuteInputSchema)
    .mutation(({ ctx, input }) => startWorkflowRun(ctx, input, 'workflow.execute')),
});

interface StartWorkflowRunCtx extends PublicWriteCtx {
  db: {
    $transaction: <T>(fn: (tx: TxClient) => Promise<T>) => Promise<T>;
  };
}

/**
 * Start a workflow run from a template for a contractor, reusing the internal
 * task-instantiation + progress invariants. The non-null
 * `WorkflowRun.startedByUserId` FK is filled from the key's attribution actor.
 */
async function startWorkflowRun(
  ctx: StartWorkflowRunCtx,
  input: { templateId: string; contractorId: string; contractId?: string },
  auditAction: string,
) {
  const startedByUserId = ctx.apiKeyActingUserId;
  if (!startedByUserId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: E.INVALID_ACTING_USER });
  }

  return ctx.db.$transaction(async tx => {
    const template = await tx.workflowTemplate.findFirst({
      where: { id: input.templateId, organizationId: ctx.organizationId, status: 'ACTIVE' },
      include: { tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.WORKFLOW_TEMPLATE_NOT_FOUND });
    }

    const contractor = await tx.contractor.findFirst({
      where: { id: input.contractorId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!contractor) {
      throw new TRPCError({ code: 'NOT_FOUND', message: E.CONTRACTOR_NOT_FOUND });
    }

    const contract = input.contractId
      ? await tx.contract.findFirst({
          where: { id: input.contractId, organizationId: ctx.organizationId, deletedAt: null },
        })
      : null;

    const now = new Date();
    const workflowRun = await tx.workflowRun.create({
      data: {
        organizationId: ctx.organizationId,
        workflowTemplateId: template.id,
        entityType: 'CONTRACTOR',
        entityId: contractor.id,
        contractorId: contractor.id,
        contractId: contract?.id ?? null,
        status: 'IN_PROGRESS',
        startedByUserId,
        startedAt: now,
        dueAt: computeMaxDueDate(template.tasks, now),
      },
    });

    await instantiateTaskRuns(
      tx,
      ctx.organizationId,
      workflowRun.id,
      template.tasks,
      contractor,
      contract,
      now,
    );

    const allTasks = await tx.workflowTaskRun.findMany({
      where: { workflowRunId: workflowRun.id },
    });
    const progress = calculateProgress(allTasks);

    const fullRun = await tx.workflowRun.update({
      where: { id: workflowRun.id },
      data: { progressPercent: progress.percent },
      select: workflowSelect,
    });

    await writePublicApiAudit({
      tx,
      ctx,
      action: auditAction,
      resourceType: 'WORKFLOW_RUN',
      resourceId: fullRun.id,
      newValues: { status: fullRun.status, templateId: template.id, contractorId: contractor.id },
    });

    return fullRun;
  });
}
