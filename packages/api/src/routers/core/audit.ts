import type { Prisma } from '@contractor-ops/db';
import type { AuditLog, EntityType } from '@contractor-ops/db/generated/prisma/client';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { requireTier } from '../../middleware/tier';
import { generateAuditCsv } from '../../services/report-export';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const settingsRead = requirePermission({ settings: ['read'] });

/** Collect resource IDs that are missing a human-readable name. */
function collectMissingIds(items: AuditLog[], type: EntityType): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.resourceName && item.resourceType === type) ids.add(item.resourceId);
  }
  return [...ids];
}

/** Structural type for the Prisma client subset used by enrichment. */
interface EnrichmentDb {
  organization: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }) => Promise<{ id: string; name: string | null }[]>;
  };
  user: {
    findMany: (args: {
      where: { id: { in: string[] } };
      select: { id: true; name: true };
    }) => Promise<{ id: string; name: string | null }[]>;
  };
}

/**
 * Fill in `resourceName` for entries where it was not captured at write time.
 * Currently handles ORGANIZATION (look up org name) and USER (look up member
 * name) resource types. Runs a single query per entity type, not per row.
 */
async function enrichResourceNames<T extends AuditLog>(db: EnrichmentDb, items: T[]): Promise<T[]> {
  if (items.length === 0) return items;

  const orgIds = collectMissingIds(items, 'ORGANIZATION');
  const userIds = collectMissingIds(items, 'USER');

  const [orgs, users] = await Promise.all([
    orgIds.length > 0
      ? db.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [],
    userIds.length > 0
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [],
  ]);

  const nameMap = new Map<string, string>();
  for (const o of orgs) if (o.name) nameMap.set(o.id, o.name);
  for (const u of users) if (u.name) nameMap.set(u.id, u.name);

  return items.map(item => {
    if (item.resourceName) return item;
    const name = nameMap.get(item.resourceId);
    return name ? { ...item, resourceName: name } : item;
  });
}

// ---------------------------------------------------------------------------
// Shared filter schema
// ---------------------------------------------------------------------------

const auditFilterSchema = z.object({
  search: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Audit router
// ---------------------------------------------------------------------------

export const auditRouter = router({
  /**
   * List audit log entries with search, structured filters, and pagination.
   * Admin-only (settings:read permission per D-13).
   *
   * F-DB-11 — supports two modes:
   *   - cursor pagination (preferred for deep navigation; no totalCount)
   *   - legacy offset pagination via {page, pageSize} kept for back-compat;
   *     totalCount is bounded to avoid the full-scan-on-deep-page anti-pattern.
   */
  list: tenantProcedure
    .use(settingsRead)
    .input(
      z
        .object({
          // Legacy offset pagination (deprecated, kept for back-compat)
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(25),
          // F-DB-11 cursor pagination — preferred for write-heavy unbounded
          // tables. When `cursor` is supplied we ignore `page` and stream.
          cursor: z.string().optional(),
          sortOrder: z.enum(['asc', 'desc']).default('desc'),
        })
        .merge(auditFilterSchema),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.AuditLogWhereInput = {
        organizationId: ctx.organizationId,
      };

      // Search: OR across actorName, resourceName, action (case-insensitive)
      if (input.search) {
        where.OR = [
          { actorName: { contains: input.search, mode: 'insensitive' } },
          { resourceName: { contains: input.search, mode: 'insensitive' } },
          { action: { contains: input.search, mode: 'insensitive' } },
        ];
      }

      if (input.actorId) {
        where.actorId = input.actorId;
      }
      if (input.action) {
        where.action = input.action;
      }
      if (input.resourceType) {
        where.resourceType = input.resourceType as EntityType;
      }
      if (input.dateFrom || input.dateTo) {
        where.createdAt = {
          ...(input.dateFrom && { gte: new Date(input.dateFrom) }),
          ...(input.dateTo && { lte: new Date(input.dateTo) }),
        };
      }

      // F-DB-11: cursor mode — keyset on (id) ordered by createdAt.
      if (input.cursor) {
        const items = await ctx.db.auditLog.findMany({
          where,
          take: input.pageSize + 1,
          cursor: { id: input.cursor },
          skip: 1,
          orderBy: { createdAt: input.sortOrder },
        });
        const hasMore = items.length > input.pageSize;
        const trimmed = hasMore ? items.slice(0, input.pageSize) : items;
        return {
          items: await enrichResourceNames(ctx.db, trimmed),
          nextCursor: hasMore ? trimmed[trimmed.length - 1]?.id : undefined,
          // No totalCount in cursor mode — caller relies on nextCursor.
          totalCount: null,
          page: null,
          pageSize: input.pageSize,
        };
      }

      // Legacy offset path. Cap totalCount lookup to a sane upper bound to
      // avoid the full-scan anti-pattern on multi-million-row audit tables.
      const COUNT_CAP = 10_000;
      const [items, totalCount] = await Promise.all([
        ctx.db.auditLog.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: input.sortOrder },
        }),
        ctx.db.auditLog.count({ where, take: COUNT_CAP }),
      ]);

      return {
        items: await enrichResourceNames(ctx.db, items),
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
        nextCursor: undefined as string | undefined,
      };
    }),

  /**
   * Returns distinct actors for filter dropdown.
   *
   * F-DB-10 — without `take`, this `DISTINCT ON (actorId)` walks the full
   * audit log for the org (millions of rows in mature tenants). Cap the
   * result set at 100 actors which is well above any realistic dropdown
   * cardinality. Long-term fix is a denormalised `AuditActor` table.
   */
  actors: tenantProcedure.use(settingsRead).query(async ({ ctx }) => {
    const actors = await ctx.db.auditLog.findMany({
      where: { organizationId: ctx.organizationId },
      distinct: ['actorId'],
      select: { actorId: true, actorName: true },
      take: 100,
    });

    return actors
      .filter(a => a.actorId !== null)
      .map(a => ({
        id: a.actorId as string,
        name: a.actorName ?? (a.actorId as string),
      }));
  }),

  /**
   * Export audit log as CSV.
   * Same filter inputs as list but no pagination. Max 10000 rows.
   * Returns base64-encoded CSV.
   */
  export: tenantProcedure
    .use(settingsRead)
    .use(requireTier('ENTERPRISE'))
    .input(auditFilterSchema)
    .mutation(async ({ ctx, input }) => {
      const where: Prisma.AuditLogWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (input.search) {
        where.OR = [
          { actorName: { contains: input.search, mode: 'insensitive' } },
          { resourceName: { contains: input.search, mode: 'insensitive' } },
          { action: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      if (input.actorId) {
        where.actorId = input.actorId;
      }
      if (input.action) {
        where.action = input.action;
      }
      if (input.resourceType) {
        where.resourceType = input.resourceType as EntityType;
      }
      if (input.dateFrom || input.dateTo) {
        where.createdAt = {
          ...(input.dateFrom && { gte: new Date(input.dateFrom) }),
          ...(input.dateTo && { lte: new Date(input.dateTo) }),
        };
      }

      const items = await ctx.db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      const csv = await generateAuditCsv(items);
      const timestamp = new Date().toISOString().slice(0, 10);

      return {
        data: csv.data,
        filename: `audit-log-${timestamp}.csv`,
        mimeType: csv.mimeType,
      };
    }),
});
