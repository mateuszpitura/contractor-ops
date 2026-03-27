import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { prisma } from "@contractor-ops/db";
import {
  approveTimesheetSchema,
  rejectTimesheetSchema,
  bulkApproveTimesheetsSchema,
  bulkRejectTimesheetsSchema,
  listTimesheetsSchema,
} from "@contractor-ops/validators";
import { router } from "../init.js";
import { tenantProcedure } from "../middleware/tenant.js";
import { requirePermission } from "../middleware/rbac.js";
import {
  approveTimesheet,
  rejectTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
} from "../services/time-entry.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips Prisma class prototype from query results, producing plain
 * JSON-serializable objects so that inferred tRPC router types do NOT
 * reference the generated Prisma client module (avoids TS2742).
 */
function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

// ---------------------------------------------------------------------------
// Admin time management router
// ---------------------------------------------------------------------------

/**
 * Manager-facing time management router.
 * Provides timesheet review, approve/reject, bulk operations,
 * and per-contractor drill-in queries.
 */
export const timeRouter = router({
  // =========================================================================
  // Queries
  // =========================================================================

  /**
   * List pending (SUBMITTED) timesheets for manager review.
   * Ordered by submittedAt ASC (oldest first).
   */
  listPending: tenantProcedure
    .use(requirePermission({ time: ["read"] }))
    .query(async ({ ctx }) => {
      const timesheets = await prisma.timesheet.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: "SUBMITTED",
        },
        orderBy: { submittedAt: "asc" },
        include: {
          contractor: {
            select: {
              id: true,
              legalName: true,
              email: true,
            },
          },
          _count: {
            select: { entries: true },
          },
        },
      });

      return plain(timesheets);
    }),

  /**
   * List all timesheets with optional filters (status, contractor, date range).
   * Cursor-based pagination, ordered by weekStartDate DESC.
   */
  listAll: tenantProcedure
    .use(requirePermission({ time: ["read"] }))
    .input(listTimesheetsSchema)
    .query(async ({ ctx, input }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: Record<string, any> = {
        organizationId: ctx.organizationId,
      };

      if (input.status) where.status = input.status;
      if (input.contractorId) where.contractorId = input.contractorId;
      if (input.from || input.to) {
        where.weekStartDate = {};
        if (input.from) where.weekStartDate.gte = new Date(input.from);
        if (input.to) where.weekStartDate.lte = new Date(input.to);
      }

      const timesheets = await prisma.timesheet.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { weekStartDate: "desc" },
        include: {
          contractor: {
            select: {
              id: true,
              legalName: true,
              email: true,
            },
          },
          _count: {
            select: { entries: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (timesheets.length > input.limit) {
        const extra = timesheets.pop();
        nextCursor = extra?.id;
      }

      return plain({ items: timesheets, nextCursor });
    }),

  /**
   * Get a single timesheet with all entries and contractor info.
   * Used for the per-contractor review detail view.
   */
  getTimesheet: tenantProcedure
    .use(requirePermission({ time: ["read"] }))
    .input(z.object({ timesheetId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const timesheet = await prisma.timesheet.findFirst({
        where: {
          id: input.timesheetId,
          organizationId: ctx.organizationId,
        },
        include: {
          contractor: {
            select: {
              id: true,
              legalName: true,
              email: true,
            },
          },
          entries: {
            orderBy: { entryDate: "asc" },
            include: {
              contract: {
                select: { id: true, title: true },
              },
            },
          },
        },
      });

      if (!timesheet) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Timesheet not found",
        });
      }

      return plain(timesheet);
    }),

  /**
   * List contractors who have at least one timesheet, with summary stats.
   * Used for the admin time overview.
   */
  listContractors: tenantProcedure
    .use(requirePermission({ time: ["read"] }))
    .query(async ({ ctx }) => {
      // Get contractors with timesheets via a grouped query
      // Get all contractors in the org
      const contractors = await prisma.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
        },
        select: {
          id: true,
          legalName: true,
          email: true,
        },
      });

      // Get pending counts per contractor
      const pendingCounts = await prisma.timesheet.groupBy({
        by: ["contractorId"],
        where: {
          organizationId: ctx.organizationId,
          status: "SUBMITTED",
        },
        _count: true,
      });

      const pendingMap = new Map(
        pendingCounts.map((p: { contractorId: string; _count: number }) => [
          p.contractorId,
          p._count,
        ]),
      );

      // Get contractors who have at least one timesheet
      const contractorWithTimesheets = await prisma.timesheet.groupBy({
        by: ["contractorId"],
        where: {
          organizationId: ctx.organizationId,
        },
      });

      const hasTimesheetSet = new Set(
        contractorWithTimesheets.map(
          (t: { contractorId: string }) => t.contractorId,
        ),
      );

      // Calculate total approved hours this month per contractor
      const now = new Date();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );

      const monthlyStats = await prisma.timesheet.groupBy({
        by: ["contractorId"],
        where: {
          organizationId: ctx.organizationId,
          status: "APPROVED",
          weekStartDate: { gte: monthStart },
        },
        _sum: { totalMinutes: true },
      });

      const monthlyMap = new Map(
        monthlyStats.map(
          (s: { contractorId: string; _sum: { totalMinutes: number | null } }) => [
            s.contractorId,
            s._sum.totalMinutes ?? 0,
          ],
        ),
      );

      const result = contractors
        .filter((c) => hasTimesheetSet.has(c.id))
        .map((c) => ({
          id: c.id,
          legalName: c.legalName,
          email: c.email,
          pendingCount: pendingMap.get(c.id) ?? 0,
          approvedMinutesThisMonth: monthlyMap.get(c.id) ?? 0,
        }));

      return plain(result);
    }),

  // =========================================================================
  // Mutations — Approve / Reject
  // =========================================================================

  /**
   * Approve a single timesheet. D-08: standalone approval.
   */
  approve: tenantProcedure
    .use(requirePermission({ time: ["approve"] }))
    .input(approveTimesheetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await approveTimesheet(
        prisma,
        ctx.organizationId,
        input.timesheetId,
        ctx.user!.id,
      );
      return plain(result);
    }),

  /**
   * Reject a single timesheet with required reason. D-07.
   */
  reject: tenantProcedure
    .use(requirePermission({ time: ["approve"] }))
    .input(rejectTimesheetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await rejectTimesheet(
        prisma,
        ctx.organizationId,
        input.timesheetId,
        ctx.user!.id,
        input.reason,
      );
      return plain(result);
    }),

  /**
   * Bulk approve multiple timesheets.
   */
  bulkApprove: tenantProcedure
    .use(requirePermission({ time: ["approve"] }))
    .input(bulkApproveTimesheetsSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkApproveTimesheets(
        prisma,
        ctx.organizationId,
        input.timesheetIds,
        ctx.user!.id,
      );
      return { count: result.count };
    }),

  /**
   * Bulk reject multiple timesheets with shared reason.
   */
  bulkReject: tenantProcedure
    .use(requirePermission({ time: ["approve"] }))
    .input(bulkRejectTimesheetsSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkRejectTimesheets(
        prisma,
        ctx.organizationId,
        input.timesheetIds,
        ctx.user!.id,
        input.reason,
      );
      return { count: result.count };
    }),
});
