// ---------------------------------------------------------------------------
// Phase 60 · CLASS-08 — reassessmentTrigger tRPC router.
// ---------------------------------------------------------------------------
//
// Surface over ReassessmentTrigger rows (written by the daily cron). Reads
// gate on contractor:read; acknowledge/dismiss gate on contractor:update.
// Tenant extension auto-scopes all reads/writes by organizationId.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { classificationProcedure } from '../../middleware/require-classification-flag.js';

const cuid = z.string().min(1);

const contractorReadProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['read'] }),
);
const contractorUpdateProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['update'] }),
);

const listInput = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED']).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: cuid.optional(),
});

const listByEngagementInput = z.object({
  contractorAssignmentId: cuid,
});

const acknowledgeInput = z.object({
  id: cuid,
});

const dismissInput = z.object({
  id: cuid,
  reason: z.string().min(10).max(1000),
});

export const reassessmentTriggerRouter = router({
  list: contractorReadProcedure.input(listInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db.reassessmentTrigger.findMany({
      where: input.status ? { status: input.status } : undefined,
      orderBy: [{ triggeredAt: 'desc' }, { id: 'asc' }],
      take: input.limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : 0,
      include: {
        contractorAssignment: {
          select: {
            id: true,
            contractorId: true,
            contractor: { select: { id: true, displayName: true, countryCode: true } },
          },
        },
      },
    });

    let nextCursor: string | null = null;
    if (rows.length > input.limit) {
      const next = rows.pop();
      nextCursor = next?.id ?? null;
    }
    return { items: rows, nextCursor };
  }),

  listByEngagement: contractorReadProcedure
    .input(listByEngagementInput)
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.reassessmentTrigger.findMany({
        where: { contractorAssignmentId: input.contractorAssignmentId },
        orderBy: { triggeredAt: 'desc' },
      });
      return rows;
    }),

  acknowledge: contractorUpdateProcedure
    .input(acknowledgeInput)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.reassessmentTrigger.findFirst({ where: { id: input.id } });
      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Reassessment trigger not found.' });
      }
      if (row.status !== 'OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only OPEN triggers can be acknowledged.',
        });
      }
      return ctx.db.reassessmentTrigger.update({
        where: { id: input.id },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedByUserId: ctx.user?.id,
          acknowledgedAt: new Date(),
        },
      });
    }),

  dismiss: contractorUpdateProcedure.input(dismissInput).mutation(async ({ ctx, input }) => {
    const row = await ctx.db.reassessmentTrigger.findFirst({ where: { id: input.id } });
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Reassessment trigger not found.' });
    }
    if (row.status === 'RESOLVED' || row.status === 'DISMISSED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Only OPEN or ACKNOWLEDGED triggers can be dismissed.',
      });
    }
    return ctx.db.reassessmentTrigger.update({
      where: { id: input.id },
      data: {
        status: 'DISMISSED',
        dismissedByUserId: ctx.user?.id,
        dismissedAt: new Date(),
        dismissedReason: input.reason,
      },
    });
  }),
});
