import type { Prisma } from '@contractor-ops/db';
import { publicApiAuditLogListInputSchema } from '@contractor-ops/validators/public-api';
import { router } from '../../init';
import { cursorClause, paginateByLastKeptUndefined } from '../../lib/pagination';
import { publicOrderBy } from '../../lib/public-cursor';
import { apiKeyTenantProcedure } from '../../middleware/api-key-auth';
import { requirePermission } from '../../middleware/rbac';

// Mirrors the internal core/audit.ts cursor read (total:null). PII-aware select:
// actor identity (actorId / actorName / ipAddress / userAgent) and the raw
// value/metadata JSON are intentionally NOT exposed — only the action shape.
const auditSelect = {
  id: true,
  actorType: true,
  action: true,
  resourceType: true,
  resourceId: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

export const publicAuditRouter = router({
  list: apiKeyTenantProcedure
    .use(requirePermission({ auditLog: ['read'] }))
    .input(publicApiAuditLogListInputSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.AuditLogWhereInput = { organizationId: ctx.organizationId };
      if (input.filter?.action) where.action = input.filter.action;
      if (input.filter?.resourceType)
        where.resourceType = input.filter.resourceType as Prisma.AuditLogWhereInput['resourceType'];

      const rows = await ctx.db.auditLog.findMany({
        where,
        orderBy: publicOrderBy(input.sort),
        select: auditSelect,
        ...cursorClause({ cursor: input.cursor, limit: input.limit }),
      });
      return paginateByLastKeptUndefined(rows, { cursor: input.cursor, limit: input.limit });
    }),
});
