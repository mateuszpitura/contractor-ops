import { z } from "zod";
import { prisma } from "@contractor-ops/db";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import { generateAuditCsv } from "../services/report-export.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

const settingsRead = requirePermission({ settings: ["read"] });

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
   */
  list: tenantProcedure
    .use(settingsRead)
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(25),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
      }).merge(auditFilterSchema),
    )
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      // Search: OR across actorName, resourceName, action (case-insensitive)
      if (input.search) {
        where.OR = [
          { actorName: { contains: input.search, mode: "insensitive" } },
          { resourceName: { contains: input.search, mode: "insensitive" } },
          { action: { contains: input.search, mode: "insensitive" } },
        ];
      }

      if (input.actorId) {
        where.actorId = input.actorId;
      }
      if (input.action) {
        where.action = input.action;
      }
      if (input.resourceType) {
        where.resourceType = input.resourceType;
      }
      if (input.dateFrom) {
        where.createdAt = { ...where.createdAt, gte: new Date(input.dateFrom) };
      }
      if (input.dateTo) {
        where.createdAt = { ...where.createdAt, lte: new Date(input.dateTo) };
      }

      const [items, totalCount] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy: { createdAt: input.sortOrder },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        items: plain(items),
        totalCount,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  /**
   * Returns distinct actors for filter dropdown.
   */
  actors: tenantProcedure
    .use(settingsRead)
    .query(async ({ ctx }) => {
      const actors = await prisma.auditLog.findMany({
        where: { organizationId: ctx.organizationId },
        distinct: ["actorId"],
        select: { actorId: true, actorName: true },
      });

      return actors
        .filter((a) => a.actorId !== null)
        .map((a) => ({
          id: a.actorId!,
          name: a.actorName ?? a.actorId!,
        }));
    }),

  /**
   * Export audit log as CSV.
   * Same filter inputs as list but no pagination. Max 10000 rows.
   * Returns base64-encoded CSV.
   */
  export: tenantProcedure
    .use(settingsRead)
    .input(auditFilterSchema)
    .mutation(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (input.search) {
        where.OR = [
          { actorName: { contains: input.search, mode: "insensitive" } },
          { resourceName: { contains: input.search, mode: "insensitive" } },
          { action: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.actorId) {
        where.actorId = input.actorId;
      }
      if (input.action) {
        where.action = input.action;
      }
      if (input.resourceType) {
        where.resourceType = input.resourceType;
      }
      if (input.dateFrom) {
        where.createdAt = { ...where.createdAt, gte: new Date(input.dateFrom) };
      }
      if (input.dateTo) {
        where.createdAt = { ...where.createdAt, lte: new Date(input.dateTo) };
      }

      const items = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
