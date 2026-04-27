// ---------------------------------------------------------------------------
// Phase 60 · CLASS-07 — economicDependencyAlert tRPC router.
// ---------------------------------------------------------------------------
//
// Read-only surface over EconomicDependencyAlertState (the state row is
// mutated exclusively by the daily scan — see economic-dependency-scan.ts).
// Inbox/dismiss handling lives in the notification domain; this router
// surfaces the per-assignment CURRENT band for the engagement page + tile.
//
// Security contract:
//   - Both procedures chain through `tenantProcedure` so the tenant Prisma
//     extension auto-scopes all reads.
//   - `requirePermission({ contractor: ['read'] })` gate (T-60-05).

import { z } from 'zod';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { classificationProcedure } from '../../middleware/require-classification-flag.js';

const cuid = z.string().min(1);

const contractorReadProcedure = classificationProcedure.use(
  requirePermission({ contractor: ['read'] }),
);

const listInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: cuid.optional(),
});

const listByEngagementInput = z.object({
  contractorAssignmentId: cuid,
});

export const economicDependencyAlertRouter = router({
  list: contractorReadProcedure.input(listInput).query(async ({ ctx, input }) => {
    const rows = await ctx.db.economicDependencyAlertState.findMany({
      where: { currentBand: { in: ['warning', 'critical'] } },
      orderBy: [{ lastScannedAt: 'desc' }, { id: 'asc' }],
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
      const row = await ctx.db.economicDependencyAlertState.findFirst({
        where: { contractorAssignmentId: input.contractorAssignmentId },
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
      return row;
    }),
});
