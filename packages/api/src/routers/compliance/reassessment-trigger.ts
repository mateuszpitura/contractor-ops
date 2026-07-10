// ---------------------------------------------------------------------------
// reassessmentTrigger tRPC router.
// ---------------------------------------------------------------------------
//
// Surface over ReassessmentTrigger rows (written by the daily cron). Reads
// gate on contractor:read; acknowledge/dismiss gate on contractor:update.
// Tenant extension auto-scopes all reads/writes by organizationId.

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { TRIGGER_NOT_ACKNOWLEDGEABLE, TRIGGER_NOT_DISMISSIBLE } from '../../errors';
import { router } from '../../init';
import { findOrThrow } from '../../lib/find-or-throw';
import { cursorClause, paginateByLastKept } from '../../lib/pagination';
import { requirePermission } from '../../middleware/rbac';
import { classificationProcedure } from '../../middleware/require-classification-flag';
import { writeAuditLog } from '../../services/audit-writer';

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
      include: {
        contractorAssignment: {
          select: {
            id: true,
            contractorId: true,
            contractor: { select: { id: true, displayName: true, countryCode: true } },
          },
        },
      },
      ...cursorClause(input, 50),
    });

    return paginateByLastKept(rows, input, 50);
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
      const row = await findOrThrow(
        () =>
          ctx.db.reassessmentTrigger.findFirst({
            where: { id: input.id },
            include: { contractorAssignment: { select: { contractorId: true } } },
          }),
        'Reassessment trigger not found.',
      );
      if (row.status !== 'OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: TRIGGER_NOT_ACKNOWLEDGEABLE,
        });
      }
      return ctx.db.$transaction(async tx => {
        const updated = await tx.reassessmentTrigger.updateMany({
          where: { id: input.id, status: 'OPEN' },
          data: {
            status: 'ACKNOWLEDGED',
            acknowledgedByUserId: ctx.user?.id,
            acknowledgedAt: new Date(),
          },
        });

        if (updated.count !== 1) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: TRIGGER_NOT_ACKNOWLEDGEABLE,
          });
        }

        const acknowledged = await tx.reassessmentTrigger.findFirstOrThrow({
          where: { id: input.id },
        });

        await writeAuditLog({
          tx,
          organizationId: ctx.organizationId,
          actorType: 'USER',
          actorId: ctx.user?.id,
          actorName: ctx.user?.name,
          action: 'reassessment.acknowledge',
          resourceType: 'CONTRACTOR',
          resourceId: row.contractorAssignment.contractorId,
          oldValues: { status: row.status },
          newValues: { status: 'ACKNOWLEDGED' },
          metadata: {
            triggerId: input.id,
            contractorAssignmentId: row.contractorAssignmentId,
          },
        });

        return acknowledged;
      });
    }),

  dismiss: contractorUpdateProcedure.input(dismissInput).mutation(async ({ ctx, input }) => {
    const row = await findOrThrow(
      () =>
        ctx.db.reassessmentTrigger.findFirst({
          where: { id: input.id },
          include: { contractorAssignment: { select: { contractorId: true } } },
        }),
      'Reassessment trigger not found.',
    );
    if (row.status === 'RESOLVED' || row.status === 'DISMISSED') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: TRIGGER_NOT_DISMISSIBLE,
      });
    }
    return ctx.db.$transaction(async tx => {
      const updated = await tx.reassessmentTrigger.updateMany({
        where: {
          id: input.id,
          status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        },
        data: {
          status: 'DISMISSED',
          dismissedByUserId: ctx.user?.id,
          dismissedAt: new Date(),
          dismissedReason: input.reason,
        },
      });

      if (updated.count !== 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: TRIGGER_NOT_DISMISSIBLE,
        });
      }

      const dismissed = await tx.reassessmentTrigger.findFirstOrThrow({
        where: { id: input.id },
      });

      await writeAuditLog({
        tx,
        organizationId: ctx.organizationId,
        actorType: 'USER',
        actorId: ctx.user?.id,
        actorName: ctx.user?.name,
        action: 'reassessment.dismiss',
        resourceType: 'CONTRACTOR',
        resourceId: row.contractorAssignment.contractorId,
        oldValues: { status: row.status },
        newValues: { status: 'DISMISSED' },
        metadata: {
          triggerId: input.id,
          contractorAssignmentId: row.contractorAssignmentId,
          reason: input.reason,
        },
      });

      return dismissed;
    });
  }),
});
