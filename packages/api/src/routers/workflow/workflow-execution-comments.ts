/**
 * Workflow run comment procedures.
 */

import { addCommentSchema } from '@contractor-ops/validators';
import { z } from 'zod';
import * as E from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

export const workflowExecutionCommentsRouter = router({
  /**
   * Add a comment to a workflow run or task.
   */
  addComment: tenantProcedure
    .use(requirePermission({ workflow: ['update'] }))
    .input(addCommentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify run belongs to org
      await findOrThrow(
        () =>
          ctx.db.workflowRun.findFirst({
            where: {
              id: input.workflowRunId,
              organizationId: ctx.organizationId,
            },
          }),
        E.WORKFLOW_RUN_NOT_FOUND,
      );

      if (input.workflowTaskRunId) {
        await findOrThrow(
          () =>
            ctx.db.workflowTaskRun.findFirst({
              where: {
                id: input.workflowTaskRunId,
                workflowRunId: input.workflowRunId,
                organizationId: ctx.organizationId,
              },
            }),
          E.WORKFLOW_TASK_NOT_FOUND,
        );
      }

      const comment = await ctx.db.workflowComment.create({
        data: {
          organizationId: ctx.organizationId,
          workflowRunId: input.workflowRunId,
          workflowTaskRunId: input.workflowTaskRunId ?? null,
          authorUserId: ctx.user.id,
          body: input.body,
        },
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
      });

      return comment;
    }),

  /**
   * List comments for a workflow run, optionally filtered by task.
   */
  listComments: tenantProcedure
    .use(requirePermission({ workflow: ['read'] }))
    .input(
      z.object({
        workflowRunId: z.string().min(1),
        workflowTaskRunId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {
        organizationId: ctx.organizationId,
        workflowRunId: input.workflowRunId,
      };

      if (input.workflowTaskRunId) {
        where.workflowTaskRunId = input.workflowTaskRunId;
      }

      const comments = await ctx.db.workflowComment.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      return comments;
    }),

  // =========================================================================
  // Overdue count (sidebar badge)
  // =========================================================================
});
