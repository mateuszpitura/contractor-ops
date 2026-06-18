import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { createLogger } from '@contractor-ops/logger';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { EXPORT_ENQUEUE_FAILED } from '../../errors';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { reportRateLimitMiddleware } from '../../middleware/report-rate-limit';
import { tenantProcedure } from '../../middleware/tenant';
import { requestExport } from '../../services/exports/index';

const log = createLogger({ service: 'api', component: 'report' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const reportRead = requirePermission({ report: ['read'] });

/**
 * Base procedure for the expensive report reads + exports: tenant scope +
 * `report:read` RBAC + per-org cost cap. The rate-limit middleware bounds how
 * often one tenant can run these multi-table aggregates / async-export
 * enqueues, which the per-IP global bucket does not.
 */
const rateLimitedReportProcedure = tenantProcedure.use(reportRead).use(reportRateLimitMiddleware);

/**
 * Hard server-side ceiling on the number of active contractors the
 * compliance-gap procedures will materialize into JS in a single request.
 *
 * `complianceGaps` / `complianceGapsChart` compute health in application code
 * (filter on `complianceItems` / `contracts` relations that cannot be
 * expressed as a single SQL predicate), so they must fetch rows before
 * filtering. Without a cap a tenant with a very large active-contractor table
 * could force the whole table — plus its nested relations — into one request's
 * heap. This ceiling bounds the worst case; orgs below it are unaffected and
 * keep their exact output shape + ordering. Truncation is surfaced honestly
 * (a `truncated` flag for the paginated procedure, a logged warning for the
 * chart) rather than silently dropping rows.
 */
const COMPLIANCE_GAP_SCAN_CAP = 1000;

// ---------------------------------------------------------------------------
// Shared input schemas
// ---------------------------------------------------------------------------

const paginationInput = {
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
};

const dateRangeInput = {
  dateFrom: z.string(),
  dateTo: z.string(),
};

/** Parse the shared `dateFrom` / `dateTo` ISO strings into Date instances. */
function parseDateRange(input: { dateFrom: string; dateTo: string }): {
  dateFrom: Date;
  dateTo: Date;
} {
  return {
    dateFrom: new Date(input.dateFrom),
    dateTo: new Date(input.dateTo),
  };
}

/**
 * Helper to enqueue an async export and surface a normalised
 * `{ exportId, status: 'PENDING' }` envelope to the client.
 *
 * The client poll-and-redirect flow is:
 *   1. Mutation returns `{ exportId, status: 'PENDING' }` immediately.
 *   2. Client either polls `export.status(exportId)` (future) or waits for
 *      the "your export is ready" email (current — link in email points
 *      at `/exports/:exportId/download`).
 *   3. Email + dashboard download link redirect to a freshly-signed R2
 *      URL each time so the original link survives the 7-day retention.
 *
 * Throws TRPCError on enqueue failure so the UI surfaces a toast.
 */
async function enqueueExport(args: {
  organizationId: string;
  userId: string | undefined;
  type: Parameters<typeof requestExport>[0]['type'];
  params: unknown;
}): Promise<{ exportId: string; status: 'PENDING' }> {
  try {
    const result = await requestExport({
      organizationId: args.organizationId,
      requestedByUserId: args.userId ?? null,
      type: args.type,
      params: args.params,
    });
    return result;
  } catch (err) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: EXPORT_ENQUEUE_FAILED,
      cause: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Report router
// ---------------------------------------------------------------------------

export const reportRouter = router({
  /**
   * Spend by contractor with pagination, sorting, and date range.
   * Uses raw SQL for grouping paid invoices by contractor.
   */
  spendByContractor: rateLimitedReportProcedure
    .input(
      z.object({
        ...dateRangeInput,
        ...paginationInput,
        sortBy: z.enum(['totalSpend', 'invoiceCount', 'contractorName']).default('totalSpend'),
        contractorId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = parseDateRange(input);
      const offset = (input.page - 1) * input.pageSize;

      // Raw SQL: map API sort field (camelCase) to SELECT aliases for ORDER BY
      const sortMap: Record<string, string> = {
        totalSpend: '"totalMinor"',
        invoiceCount: '"invoiceCount"',
        contractorName: '"contractorName"',
      };
      const orderCol = sortMap[input.sortBy] ?? '"totalMinor"';
      const orderDir = input.sortOrder === 'asc' ? 'ASC' : 'DESC';

      // Build optional contractor filter
      const contractorFilter = input.contractorId
        ? Prisma.sql`AND i."contractorId" = ${input.contractorId}`
        : Prisma.empty;

      const items = await ctx.db.$queryRaw<
        Array<{
          contractorId: string;
          contractorName: string;
          invoiceCount: number;
          totalMinor: number;
          avgMinor: number;
          lastPaidAt: Date | null;
        }>
      >`
        SELECT
          c.id AS "contractorId",
          c."legalName" AS "contractorName",
          COUNT(i.id)::int AS "invoiceCount",
          COALESCE(SUM(i."amountToPayMinor")::int, 0) AS "totalMinor",
          COALESCE(AVG(i."amountToPayMinor")::int, 0) AS "avgMinor",
          MAX(i."paidAt") AS "lastPaidAt"
        FROM "Invoice" i
        JOIN "Contractor" c ON c.id = i."contractorId"
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
          ${contractorFilter}
        GROUP BY c.id, c."legalName"
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(orderDir)}
        LIMIT ${input.pageSize}
        OFFSET ${offset}
      `;

      const countResult = await ctx.db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT i."contractorId")::int AS count
        FROM "Invoice" i
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
          ${contractorFilter}
      `;

      return {
        items: items.map(r => ({
          ...r,
          invoiceCount: Number(r.invoiceCount),
          totalMinor: Number(r.totalMinor),
          avgMinor: Number(r.avgMinor),
          lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt).toISOString() : null,
        })),
        total: countResult[0]?.count ?? 0,
      };
    }),

  /**
   * Spend by team via Contractor.primaryTeamId -> Team.
   */
  spendByTeam: rateLimitedReportProcedure
    .input(
      z.object({
        ...dateRangeInput,
        ...paginationInput,
        sortBy: z.enum(['totalSpend', 'invoiceCount', 'teamName']).default('totalSpend'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = parseDateRange(input);
      const offset = (input.page - 1) * input.pageSize;

      // Raw SQL: camelCase sort keys -> quoted SELECT aliases
      const sortMap: Record<string, string> = {
        totalSpend: '"totalMinor"',
        invoiceCount: '"invoiceCount"',
        teamName: '"teamName"',
      };
      const orderCol = sortMap[input.sortBy] ?? '"totalMinor"';
      const orderDir = input.sortOrder === 'asc' ? 'ASC' : 'DESC';

      const items = await ctx.db.$queryRaw<
        Array<{
          teamId: string | null;
          teamName: string | null;
          contractorCount: number;
          invoiceCount: number;
          totalMinor: number;
        }>
      >`
        SELECT
          t.id AS "teamId",
          t.name AS "teamName",
          COUNT(DISTINCT c.id)::int AS "contractorCount",
          COUNT(i.id)::int AS "invoiceCount",
          COALESCE(SUM(i."amountToPayMinor")::int, 0) AS "totalMinor"
        FROM "Invoice" i
        JOIN "Contractor" c ON c.id = i."contractorId"
        LEFT JOIN "Team" t ON t.id = c."primaryTeamId"
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
        GROUP BY t.id, t.name
        ORDER BY ${Prisma.raw(orderCol)} ${Prisma.raw(orderDir)}
        LIMIT ${input.pageSize}
        OFFSET ${offset}
      `;

      const countResult = await ctx.db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(DISTINCT COALESCE(c."primaryTeamId", 'unassigned'))::int AS count
        FROM "Invoice" i
        JOIN "Contractor" c ON c.id = i."contractorId"
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
      `;

      return {
        items: items.map(r => ({
          teamId: r.teamId,
          teamName: r.teamName,
          contractorCount: Number(r.contractorCount),
          invoiceCount: Number(r.invoiceCount),
          totalMinor: Number(r.totalMinor),
        })),
        total: countResult[0]?.count ?? 0,
      };
    }),

  /**
   * Expiring contracts within N days.
   */
  expiringContracts: rateLimitedReportProcedure
    .input(
      z.object({
        days: z.enum(['30', '60', '90']).default('30'),
        ...paginationInput,
        sortBy: z.enum(['endDate', 'contractorName', 'title']).default('endDate'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const daysNum = parseInt(input.days, 10);
      const futureDate = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);

      const orderBy: Prisma.ContractOrderByWithRelationInput =
        input.sortBy === 'contractorName'
          ? { contractor: { legalName: input.sortOrder } }
          : { [input.sortBy]: input.sortOrder };

      const where = {
        organizationId: ctx.organizationId,
        status: { in: ['ACTIVE', 'EXPIRING'] as ('ACTIVE' | 'EXPIRING')[] },
        endDate: { gte: now, lte: futureDate },
        deletedAt: null,
      };

      const [contracts, total] = await Promise.all([
        ctx.db.contract.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy,
          include: {
            contractor: {
              select: { id: true, legalName: true },
            },
          },
        }),
        ctx.db.contract.count({ where }),
      ]);

      const msPerDay = 24 * 60 * 60 * 1000;

      return {
        items: contracts.map(c => ({
          contractId: c.id,
          contractTitle: c.title,
          contractorId: c.contractor.id,
          contractorName: c.contractor.legalName,
          endDate: c.endDate?.toISOString() ?? null,
          daysRemaining: c.endDate
            ? Math.ceil((c.endDate.getTime() - now.getTime()) / msPerDay)
            : 0,
          status: c.status,
        })),
        total,
      };
    }),

  /**
   * Overdue invoices (dueDate < now, not paid/cancelled).
   */
  overdueInvoices: rateLimitedReportProcedure
    .input(
      z.object({
        ...paginationInput,
        sortBy: z.enum(['dueDate', 'amount', 'contractorName']).default('dueDate'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const orderBy: Prisma.InvoiceOrderByWithRelationInput =
        input.sortBy === 'contractorName'
          ? { contractor: { legalName: input.sortOrder } }
          : input.sortBy === 'amount'
            ? { amountToPayMinor: input.sortOrder }
            : { dueDate: input.sortOrder };

      const where = {
        organizationId: ctx.organizationId,
        dueDate: { lt: now },
        paymentStatus: { notIn: ['PAID'] as 'PAID'[] },
        deletedAt: null,
      };

      const [invoices, total] = await Promise.all([
        ctx.db.invoice.findMany({
          where,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          orderBy,
          include: {
            contractor: {
              select: { id: true, legalName: true },
            },
          },
        }),
        ctx.db.invoice.count({ where }),
      ]);

      const msPerDay = 24 * 60 * 60 * 1000;

      return {
        items: invoices.map(inv => ({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          contractorId: inv.contractor?.id ?? null,
          contractorName: inv.contractor?.legalName ?? 'Unknown',
          amountMinor: inv.amountToPayMinor,
          currency: inv.currency,
          dueDate: inv.dueDate.toISOString(),
          daysOverdue: Math.ceil((now.getTime() - inv.dueDate.getTime()) / msPerDay),
          status: inv.paymentStatus,
        })),
        total,
      };
    }),

  /**
   * Compliance gaps: contractors with yellow/red health.
   */
  complianceGaps: rateLimitedReportProcedure
    .input(
      z.object({
        ...paginationInput,
        sortBy: z.enum(['health', 'contractorName', 'missingDocs']).default('health'),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get contractors with compliance issues. Bounded by COMPLIANCE_GAP_SCAN_CAP
      // BEFORE the in-JS slice so one request can never materialize the whole
      // active-contractor table (+ nested relations) into the heap.
      const contractors = await ctx.db.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
        take: COMPLIANCE_GAP_SCAN_CAP,
        include: {
          complianceItems: {
            select: { status: true },
          },
          contracts: {
            where: { deletedAt: null },
            select: { status: true },
          },
          _count: {
            select: {
              complianceItems: {
                where: { status: { in: ['MISSING', 'EXPIRED'] } },
              },
            },
          },
        },
      });

      const truncated = contractors.length >= COMPLIANCE_GAP_SCAN_CAP;
      if (truncated) {
        log.warn(
          { organizationId: ctx.organizationId, cap: COMPLIANCE_GAP_SCAN_CAP },
          'complianceGaps scan hit the contractor ceiling — result is truncated; org should use the async export for the full set',
        );
      }

      // Compute health for each contractor
      type GapItem = {
        contractorId: string;
        contractorName: string;
        missingDocuments: number;
        contractStatus: string;
        overdueTasks: number;
        health: 'red' | 'yellow' | 'green';
      };

      const items: GapItem[] = [];

      for (const c of contractors) {
        const missingOrExpired = c._count.complianceItems;
        const hasPending = c.complianceItems.some(ci => ci.status === 'PENDING');
        const hasActiveContract = c.contracts.some(con => con.status === 'ACTIVE');

        let health: 'red' | 'yellow' | 'green' = 'green';
        if (missingOrExpired > 0 || !hasActiveContract) {
          health = 'red';
        } else if (hasPending) {
          health = 'yellow';
        }

        // Only include non-green
        if (health !== 'green') {
          items.push({
            contractorId: c.id,
            contractorName: c.legalName,
            missingDocuments: missingOrExpired,
            contractStatus: hasActiveContract ? 'ACTIVE' : 'NONE',
            overdueTasks: 0,
            health,
          });
        }
      }

      // Sort
      const sortFn = (a: GapItem, b: GapItem) => {
        if (input.sortBy === 'health') {
          const order = { red: 0, yellow: 1, green: 2 };
          const diff = order[a.health] - order[b.health];
          return input.sortOrder === 'asc' ? diff : -diff;
        }
        if (input.sortBy === 'contractorName') {
          const cmp = a.contractorName.localeCompare(b.contractorName);
          return input.sortOrder === 'asc' ? cmp : -cmp;
        }
        // missingDocs
        const diff = a.missingDocuments - b.missingDocuments;
        return input.sortOrder === 'asc' ? diff : -diff;
      };

      items.sort(sortFn);

      const total = items.length;
      const offset = (input.page - 1) * input.pageSize;
      const paged = items.slice(offset, offset + input.pageSize);

      return { items: paged, total, truncated };
    }),

  // =========================================================================
  // Chart endpoints (no pagination)
  // =========================================================================

  /**
   * Top 10 contractors by spend for bar chart.
   */
  spendByContractorChart: rateLimitedReportProcedure
    .input(z.object({ ...dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = parseDateRange(input);

      const items = await ctx.db.$queryRaw<
        Array<{
          contractorId: string;
          contractorName: string;
          totalMinor: number;
        }>
      >`
        SELECT
          c.id AS "contractorId",
          c."legalName" AS "contractorName",
          COALESCE(SUM(i."amountToPayMinor")::int, 0) AS "totalMinor"
        FROM "Invoice" i
        JOIN "Contractor" c ON c.id = i."contractorId"
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
        GROUP BY c.id, c."legalName"
        ORDER BY "totalMinor" DESC
        LIMIT 10
      `;

      return items.map(r => ({
        contractorId: r.contractorId,
        contractorName: r.contractorName,
        totalMinor: Number(r.totalMinor),
      }));
    }),

  /**
   * All teams with spend for bar chart.
   */
  spendByTeamChart: rateLimitedReportProcedure
    .input(z.object({ ...dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = parseDateRange(input);

      const items = await ctx.db.$queryRaw<
        Array<{
          teamId: string | null;
          teamName: string | null;
          totalMinor: number;
        }>
      >`
        SELECT
          t.id AS "teamId",
          t.name AS "teamName",
          COALESCE(SUM(i."amountToPayMinor")::int, 0) AS "totalMinor"
        FROM "Invoice" i
        JOIN "Contractor" c ON c.id = i."contractorId"
        LEFT JOIN "Team" t ON t.id = c."primaryTeamId"
        WHERE i."organizationId" = ${ctx.organizationId}
          AND i."paymentStatus" = 'PAID'
          AND i."paidAt" >= ${dateFrom}
          AND i."paidAt" <= ${dateTo}
          AND i."deletedAt" IS NULL
        GROUP BY t.id, t.name
        ORDER BY "totalMinor" DESC
      `;

      return items.map(r => ({
        teamId: r.teamId,
        teamName: r.teamName,
        totalMinor: Number(r.totalMinor),
      }));
    }),

  /**
   * Expiring contracts grouped by 30-day buckets for chart.
   */
  expiringContractsChart: rateLimitedReportProcedure
    .input(z.object({ days: z.enum(['30', '60', '90']).default('30') }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const daysNum = parseInt(input.days, 10);
      const bucketCount = daysNum / 30;
      const msPerDay = 24 * 60 * 60 * 1000;

      const contracts = await ctx.db.contract.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] },
          endDate: {
            gte: now,
            lte: new Date(now.getTime() + daysNum * msPerDay),
          },
          deletedAt: null,
        },
        select: { endDate: true },
      });

      const buckets: Array<{ bucket: string; count: number }> = [];

      for (let i = 0; i < bucketCount; i++) {
        const from = new Date(now.getTime() + i * 30 * msPerDay);
        const to = new Date(now.getTime() + (i + 1) * 30 * msPerDay);
        const label = `${i * 30 + 1}-${(i + 1) * 30} days`;

        const count = contracts.filter(c => {
          if (!c.endDate) return false;
          return c.endDate >= from && c.endDate < to;
        }).length;

        buckets.push({ bucket: label, count });
      }

      return buckets;
    }),

  /**
   * Compliance gaps summary for pie chart.
   */
  complianceGapsChart: rateLimitedReportProcedure.query(async ({ ctx }) => {
    // Same COMPLIANCE_GAP_SCAN_CAP ceiling as `complianceGaps` — this
    // procedure takes no input, so the cap is purely internal. Bounds the
    // worst-case heap usage; for orgs under the cap the counts are exact.
    const contractors = await ctx.db.contractor.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      take: COMPLIANCE_GAP_SCAN_CAP,
      include: {
        complianceItems: {
          select: { status: true },
        },
        contracts: {
          where: { deletedAt: null },
          select: { status: true },
        },
        _count: {
          select: {
            complianceItems: {
              where: { status: { in: ['MISSING', 'EXPIRED'] } },
            },
          },
        },
      },
    });

    if (contractors.length >= COMPLIANCE_GAP_SCAN_CAP) {
      log.warn(
        { organizationId: ctx.organizationId, cap: COMPLIANCE_GAP_SCAN_CAP },
        'complianceGapsChart scan hit the contractor ceiling — counts are computed over a truncated set',
      );
    }

    let critical = 0;
    let warning = 0;
    let ok = 0;

    for (const c of contractors) {
      const missingOrExpired = c._count.complianceItems;
      const hasPending = c.complianceItems.some(ci => ci.status === 'PENDING');
      const hasActiveContract = c.contracts.some(con => con.status === 'ACTIVE');

      if (missingOrExpired > 0 || !hasActiveContract) {
        critical++;
      } else if (hasPending) {
        warning++;
      } else {
        ok++;
      }
    }

    return { critical, warning, ok };
  }),

  // =========================================================================
  // Export mutations — all 5 enqueue async jobs.
  //
  // Each mutation:
  //   - validates input via Zod (per-export schema lives in the
  //     `exports/registry.ts` module so the consumer revalidates before
  //     dispatch),
  //   - enqueues an `Export` row (PENDING) + QStash message,
  //   - returns `{ exportId, status: 'PENDING' }` immediately so the
  //     request handler is bounded.
  //
  // The client polls `/exports/:exportId/download` (or waits for the
  // "your export is ready" email) — the previous synchronous CSV path
  // would OOM the request pod for orgs with >50k invoices.
  // =========================================================================

  /**
   * Enqueue: spend by contractor (date range + optional contractor filter).
   */
  exportSpendByContractor: rateLimitedReportProcedure
    .input(z.object({ ...dateRangeInput, contractorId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return enqueueExport({
        organizationId: ctx.organizationId,
        userId: ctx.session?.user?.id,
        type: 'spend-by-contractor',
        params: input,
      });
    }),

  /**
   * Enqueue: spend by team (date range).
   */
  exportSpendByTeam: rateLimitedReportProcedure
    .input(z.object({ ...dateRangeInput }))
    .mutation(async ({ ctx, input }) => {
      return enqueueExport({
        organizationId: ctx.organizationId,
        userId: ctx.session?.user?.id,
        type: 'spend-by-team',
        params: input,
      });
    }),

  /**
   * Enqueue: expiring contracts within the given window.
   */
  exportExpiringContracts: rateLimitedReportProcedure
    .input(z.object({ days: z.enum(['30', '60', '90']).default('30') }))
    .mutation(async ({ ctx, input }) => {
      return enqueueExport({
        organizationId: ctx.organizationId,
        userId: ctx.session?.user?.id,
        type: 'expiring-contracts',
        params: input,
      });
    }),

  /**
   * Enqueue: overdue invoices (no input — server uses now()).
   */
  exportOverdueInvoices: rateLimitedReportProcedure.mutation(async ({ ctx }) => {
    return enqueueExport({
      organizationId: ctx.organizationId,
      userId: ctx.session?.user?.id,
      type: 'overdue-invoices',
      params: {},
    });
  }),

  /**
   * Enqueue: compliance gaps (no input).
   */
  exportComplianceGaps: rateLimitedReportProcedure.mutation(async ({ ctx }) => {
    return enqueueExport({
      organizationId: ctx.organizationId,
      userId: ctx.session?.user?.id,
      type: 'compliance-gaps',
      params: {},
    });
  }),
});
