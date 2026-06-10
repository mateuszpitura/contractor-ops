import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';

export const contractorEngagementsRouter = router({
  listEngagements: tenantProcedure
    .use(requirePermission({ contractor: ['read'] }))
    .input(z.object({ contractorId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.contractorAssignment.findMany({
        where: {
          contractorId: input.contractorId,
          organizationId: ctx.organizationId,
        },
        orderBy: [{ activeTo: 'asc' }, { activeFrom: 'desc' }],
        select: {
          id: true,
          contractorId: true,
          activeFrom: true,
          activeTo: true,
          status: true,
          contractor: { select: { id: true, displayName: true, countryCode: true } },
          project: { select: { id: true, name: true } },
        },
      });
      return rows;
    }),
});
