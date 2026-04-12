import type { Prisma } from '@contractor-ops/db';
import {
  approveTimesheetSchema,
  bulkApproveTimesheetsSchema,
  bulkRejectTimesheetsSchema,
  listTimesheetsSchema,
  rejectTimesheetSchema,
  timeReconciliationSchema,
} from '@contractor-ops/validators';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import {
  approveTimesheet,
  bulkApproveTimesheets,
  bulkRejectTimesheets,
  rejectTimesheet,
} from '../services/time-entry.js';
import { computeTimeReconciliation } from '../services/time-reconciliation.js';

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
  listPending: tenantProcedure.use(requirePermission({ time: ['read'] })).query(async ({ ctx }) => {
    const timesheets = await ctx.db.timesheet.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'SUBMITTED',
      },
      orderBy: { submittedAt: 'asc' },
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
    .use(requirePermission({ time: ['read'] }))
    .input(listTimesheetsSchema)
    .query(async ({ ctx, input }) => {
      const where: Prisma.TimesheetWhereInput = {
        organizationId: ctx.organizationId,
      };

      if (input.status) where.status = input.status;
      if (input.contractorId) where.contractorId = input.contractorId;
      if (input.from || input.to) {
        where.weekStartDate = {};
        if (input.from) where.weekStartDate.gte = new Date(input.from);
        if (input.to) where.weekStartDate.lte = new Date(input.to);
      }

      const timesheets = await ctx.db.timesheet.findMany({
        where,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { weekStartDate: 'desc' },
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
    .use(requirePermission({ time: ['read'] }))
    .input(z.object({ timesheetId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const timesheet = await ctx.db.timesheet.findFirst({
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
            orderBy: { entryDate: 'asc' },
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
          code: 'NOT_FOUND',
          message: 'Timesheet not found',
        });
      }

      return plain(timesheet);
    }),

  /**
   * List contractors who have at least one timesheet, with summary stats.
   * Used for the admin time overview.
   */
  listContractors: tenantProcedure
    .use(requirePermission({ time: ['read'] }))
    .query(async ({ ctx }) => {
      // Get contractors with timesheets via a grouped query
      // Get all contractors in the org
      const contractors = await ctx.db.contractor.findMany({
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
      const pendingCounts = await ctx.db.timesheet.groupBy({
        by: ['contractorId'],
        where: {
          organizationId: ctx.organizationId,
          status: 'SUBMITTED',
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
      const contractorWithTimesheets = await ctx.db.timesheet.groupBy({
        by: ['contractorId'],
        where: {
          organizationId: ctx.organizationId,
        },
      });

      const hasTimesheetSet = new Set(
        contractorWithTimesheets.map((t: { contractorId: string }) => t.contractorId),
      );

      // Calculate total approved hours this month per contractor
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

      const monthlyStats = await ctx.db.timesheet.groupBy({
        by: ['contractorId'],
        where: {
          organizationId: ctx.organizationId,
          status: 'APPROVED',
          weekStartDate: { gte: monthStart },
        },
        _sum: { totalMinutes: true },
      });

      const monthlyMap = new Map(
        monthlyStats.map((s: { contractorId: string; _sum: { totalMinutes: number | null } }) => [
          s.contractorId,
          s._sum.totalMinutes ?? 0,
        ]),
      );

      const result = contractors
        .filter(c => hasTimesheetSet.has(c.id))
        .map(c => ({
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
    .use(requirePermission({ time: ['approve'] }))
    .input(approveTimesheetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await approveTimesheet(
        prisma,
        ctx.organizationId,
        input.timesheetId,
        ctx.user?.id,
      );
      return plain(result);
    }),

  /**
   * Reject a single timesheet with required reason. D-07.
   */
  reject: tenantProcedure
    .use(requirePermission({ time: ['approve'] }))
    .input(rejectTimesheetSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await rejectTimesheet(
        prisma,
        ctx.organizationId,
        input.timesheetId,
        ctx.user?.id,
        input.reason,
      );
      return plain(result);
    }),

  /**
   * Bulk approve multiple timesheets.
   */
  bulkApprove: tenantProcedure
    .use(requirePermission({ time: ['approve'] }))
    .input(bulkApproveTimesheetsSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkApproveTimesheets(
        prisma,
        ctx.organizationId,
        input.timesheetIds,
        ctx.user?.id,
      );
      return { count: result.count };
    }),

  /**
   * Bulk reject multiple timesheets with shared reason.
   */
  bulkReject: tenantProcedure
    .use(requirePermission({ time: ['approve'] }))
    .input(bulkRejectTimesheetsSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await bulkRejectTimesheets(
        prisma,
        ctx.organizationId,
        input.timesheetIds,
        ctx.user?.id,
        input.reason,
      );
      return { count: result.count };
    }),

  // =========================================================================
  // Reconciliation queries (Phase 18, Plan 05)
  // =========================================================================

  /**
   * Get reconciliation data for a specific contract and period.
   * Returns null for non-hourly/daily contracts or when no approved time exists.
   */
  getReconciliation: tenantProcedure
    .use(requirePermission({ time: ['read'] }))
    .input(timeReconciliationSchema)
    .query(async ({ ctx, input }) => {
      const result = await computeTimeReconciliation(
        prisma,
        ctx.organizationId,
        input.contractId,
        new Date(input.periodStart),
        new Date(input.periodEnd),
        input.invoicedAmountMinor,
      );
      return plain(result);
    }),

  /**
   * Get reconciliation data for a specific invoice.
   * Looks up the invoice's matched contract, determines period from
   * servicePeriodStart/End or issueDate, and computes reconciliation.
   */
  getInvoiceReconciliation: tenantProcedure
    .use(requirePermission({ time: ['read'] }))
    .input(z.object({ invoiceId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.invoiceId,
          organizationId: ctx.organizationId,
          deletedAt: null,
        },
        select: {
          contractId: true,
          totalMinor: true,
          servicePeriodStart: true,
          servicePeriodEnd: true,
          issueDate: true,
        },
      });

      if (!invoice?.contractId) return null;

      // Determine period from service period or fall back to month of issue date
      const issueDate = invoice.issueDate;
      const periodStart =
        invoice.servicePeriodStart ??
        new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
      const periodEnd =
        invoice.servicePeriodEnd ??
        new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0));

      const result = await computeTimeReconciliation(
        prisma,
        ctx.organizationId,
        invoice.contractId,
        periodStart,
        periodEnd,
        invoice.totalMinor,
      );

      return plain(result);
    }),

  /**
   * List invoices with time reconciliation data for admin overview.
   * Only includes invoices with matched PER_HOUR or PER_DAY contracts.
   * Sorted by deviation percentage descending (highest first per UI-SPEC).
   */
  listReconciliations: tenantProcedure
    .use(requirePermission({ time: ['read'] }))
    .input(
      z.object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const invoiceWhere: Prisma.InvoiceWhereInput = {
        organizationId: ctx.organizationId,
        deletedAt: null,
        contractId: { not: null },
        contract: {
          rateType: { in: ['PER_HOUR', 'PER_DAY'] },
        },
      };

      if (input.from || input.to) {
        invoiceWhere.issueDate = {};
        if (input.from) invoiceWhere.issueDate.gte = new Date(input.from);
        if (input.to) invoiceWhere.issueDate.lte = new Date(input.to);
      }

      const invoices = await ctx.db.invoice.findMany({
        where: invoiceWhere,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        orderBy: { issueDate: 'desc' },
        include: {
          contractor: {
            select: { id: true, legalName: true },
          },
          contract: {
            select: {
              id: true,
              title: true,
              rateType: true,
              rateValueMinor: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (invoices.length > input.limit) {
        const extra = invoices.pop();
        nextCursor = extra?.id;
      }

      // Compute reconciliation for each invoice
      const items = await Promise.all(
        invoices.map(async inv => {
          if (!inv.contractId) return null;

          const issueDate = inv.issueDate;
          const periodStart =
            inv.servicePeriodStart ??
            new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth(), 1));
          const periodEnd =
            inv.servicePeriodEnd ??
            new Date(Date.UTC(issueDate.getUTCFullYear(), issueDate.getUTCMonth() + 1, 0));

          const reconciliation = await computeTimeReconciliation(
            prisma,
            ctx.organizationId,
            inv.contractId,
            periodStart,
            periodEnd,
            inv.totalMinor,
          );

          if (!reconciliation) return null;

          return {
            invoice: {
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              issueDate: inv.issueDate,
              totalMinor: inv.totalMinor,
              currency: inv.currency,
              servicePeriodStart: inv.servicePeriodStart,
              servicePeriodEnd: inv.servicePeriodEnd,
            },
            contractor: inv.contractor,
            reconciliation,
          };
        }),
      );

      // Filter out nulls and sort by deviation percent descending
      const filtered = items
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => b.reconciliation.deviationPercent - a.reconciliation.deviationPercent);

      return plain({ items: filtered, nextCursor });
    }),
});
