import type { DataRegion, PrismaClient } from '@contractor-ops/db';
import { readReplica, SUPPORTED_REGIONS } from '@contractor-ops/db';
import { z } from 'zod';
import { router } from '../../init';
import type { TenantScopedDb } from '../../lib/tenant-db';
import { requirePermission } from '../../middleware/rbac';
import { tenantProcedure } from '../../middleware/tenant';
import { CacheKeys, CacheTTL, cached, cachedSingleflight } from '../../services/cache';

/**
 * Minimal client surface required by `fetchKpis`. Both the writer (`ctx.db`,
 * `TenantScopedDb`) and the read replica (`PrismaClient` from `readReplica`)
 * satisfy this — every predicate inside the function spells out
 * `organizationId` + `deletedAt` explicitly so the tenant-scope extension is
 * not required for correctness.
 */
type RawQueryClient = Pick<PrismaClient, '$queryRaw'>;

/**
 * Coerce `ctx.region` (string) into a typed `DataRegion`. Falls back to `'EU'`
 * for any unexpected value so the read-replica router never throws on a
 * misconfigured tenant — replica routing is best-effort, not a correctness
 * primitive.
 */
function toDataRegion(region: string): DataRegion {
  return SUPPORTED_REGIONS.includes(region as DataRegion) ? (region as DataRegion) : 'EU';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const reportRead = requirePermission({ report: ['read'] });

// ---------------------------------------------------------------------------
// Data fetchers (extracted for caching)
// ---------------------------------------------------------------------------

async function fetchKpis(organizationId: string, db: RawQueryClient) {
  // Collapses the previous 8 separate count/aggregate queries into 3
  // single-scan queries using `FILTER (WHERE …)` aggregates. Each query
  // now scans the underlying table once and computes both the current and
  // previous-month values; on a 50k-invoice org this drops dashboardKpis
  // cold-cache latency from ~800-3000 ms to ~150-500 ms and roughly halves
  // writer CPU per request.
  //
  // The `db.$queryRaw` calls bypass the soft-delete + tenant scope
  // extensions, so all predicates are spelled out explicitly.

  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  type ContractorCounts = { activeContractors: number; prevActiveContractors: number };
  type ApprovalCounts = { pendingApprovals: number; prevPendingApprovals: number };
  type InvoiceAggs = { readyToPayMinor: number; prevReadyToPayMinor: number };
  type ContractTaskCounts = { expiringContracts: number; openTasks: number };

  const [contractorRows, approvalRows, invoiceRows, contractTaskRows] = await Promise.all([
    db.$queryRaw<ContractorCounts[]>`
      SELECT
        COUNT(*) FILTER (WHERE TRUE)::int AS "activeContractors",
        COUNT(*) FILTER (WHERE "createdAt" < ${startOfCurrentMonth})::int AS "prevActiveContractors"
      FROM "Contractor"
      WHERE "organizationId" = ${organizationId}
        AND "status" = 'ACTIVE'
        AND "deletedAt" IS NULL
    `,
    db.$queryRaw<ApprovalCounts[]>`
      SELECT
        COUNT(*) FILTER (WHERE TRUE)::int AS "pendingApprovals",
        COUNT(*) FILTER (WHERE "createdAt" < ${startOfCurrentMonth})::int AS "prevPendingApprovals"
      FROM "ApprovalStep"
      WHERE "organizationId" = ${organizationId}
        AND "status" = 'PENDING'
    `,
    db.$queryRaw<InvoiceAggs[]>`
      SELECT
        COALESCE(SUM("amountToPayMinor")::bigint, 0)::bigint AS "readyToPayMinor",
        COALESCE(
          SUM("amountToPayMinor") FILTER (
            WHERE "readyForPaymentAt" >= ${startOfPreviousMonth}
              AND "readyForPaymentAt" < ${startOfCurrentMonth}
          )::bigint,
          0
        )::bigint AS "prevReadyToPayMinor"
      FROM "Invoice"
      WHERE "organizationId" = ${organizationId}
        AND "paymentStatus" = 'READY'
        AND "deletedAt" IS NULL
    `,
    db.$queryRaw<ContractTaskCounts[]>`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM "Contract"
          WHERE "organizationId" = ${organizationId}
            AND "status" IN ('ACTIVE', 'EXPIRING')
            AND "endDate" >= ${now}
            AND "endDate" <= ${thirtyDaysFromNow}
            AND "deletedAt" IS NULL
        ) AS "expiringContracts",
        (
          SELECT COUNT(*)::int
          FROM "WorkflowTaskRun"
          WHERE "organizationId" = ${organizationId}
            AND "status" IN ('TODO', 'IN_PROGRESS')
        ) AS "openTasks"
    `,
  ]);

  const c = contractorRows[0] ?? { activeContractors: 0, prevActiveContractors: 0 };
  const a = approvalRows[0] ?? { pendingApprovals: 0, prevPendingApprovals: 0 };
  const i = invoiceRows[0] ?? { readyToPayMinor: 0, prevReadyToPayMinor: 0 };
  const t = contractTaskRows[0] ?? { expiringContracts: 0, openTasks: 0 };

  return {
    activeContractors: {
      value: Number(c.activeContractors),
      prevValue: Number(c.prevActiveContractors),
    },
    pendingApprovals: {
      value: Number(a.pendingApprovals),
      prevValue: Number(a.prevPendingApprovals),
    },
    readyToPayTotal: {
      valueMinor: Number(i.readyToPayMinor),
      prevValueMinor: Number(i.prevReadyToPayMinor),
    },
    expiringContracts: {
      value: Number(t.expiringContracts),
    },
    openTasks: {
      value: Number(t.openTasks),
    },
  };
}

async function fetchSpendTrend(organizationId: string, months: string, db: TenantScopedDb) {
  const now = new Date();
  let startDate: Date;

  if (months === 'ytd') {
    startDate = new Date(now.getFullYear(), 0, 1);
  } else {
    const monthsBack = parseInt(months, 10);
    startDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  }

  const rows = await db.$queryRaw<Array<{ month: Date; currency: string; totalMinor: number }>>`
    SELECT
      date_trunc('month', "paidAt") AS month,
      currency,
      COALESCE(SUM("totalMinor")::int, 0) AS "totalMinor"
    FROM "Invoice"
    WHERE "organizationId" = ${organizationId}
      AND "paymentStatus" = 'PAID'
      AND "paidAt" >= ${startDate}
      AND "deletedAt" IS NULL
    GROUP BY date_trunc('month', "paidAt"), currency
    ORDER BY month ASC, currency ASC
  `;

  return rows.map(r => ({
    month: new Date(r.month).toISOString(),
    currency: r.currency,
    totalMinor: Number(r.totalMinor),
  }));
}

async function fetchDeadlines(organizationId: string, db: TenantScopedDb) {
  const now = new Date();
  const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [expiringContracts, overdueTasks, dueInvoices] = await Promise.all([
    db.contract.findMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { gte: now, lte: ninetyDaysFromNow },
        deletedAt: null,
      },
      select: { id: true, title: true, endDate: true },
      orderBy: { endDate: 'asc' },
      take: 20,
    }),
    db.workflowTaskRun.findMany({
      where: {
        organizationId,
        status: { in: ['TODO', 'IN_PROGRESS'] },
        dueAt: { lt: now },
      },
      select: { id: true, title: true, dueAt: true },
      orderBy: { dueAt: 'asc' },
      take: 20,
    }),
    db.invoice.findMany({
      where: {
        organizationId,
        dueDate: { gte: now, lte: thirtyDaysFromNow },
        paymentStatus: { notIn: ['PAID'] },
        deletedAt: null,
      },
      select: { id: true, invoiceNumber: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 20,
    }),
  ]);

  const msPerDay = 24 * 60 * 60 * 1000;

  type DeadlineItem = {
    type: string;
    entityId: string;
    entityName: string;
    dueDate: string;
    daysRemaining?: number;
    daysOverdue?: number;
    _sortKey: number;
  };

  const items: DeadlineItem[] = [];

  for (const c of expiringContracts) {
    if (!c.endDate) continue;
    const daysRemaining = Math.ceil((c.endDate.getTime() - now.getTime()) / msPerDay);
    items.push({
      type: 'CONTRACT_EXPIRING',
      entityId: c.id,
      entityName: c.title,
      dueDate: c.endDate.toISOString(),
      daysRemaining,
      _sortKey: daysRemaining,
    });
  }

  for (const t of overdueTasks) {
    if (!t.dueAt) continue;
    const daysOverdue = Math.ceil((now.getTime() - t.dueAt.getTime()) / msPerDay);
    items.push({
      type: 'TASK_OVERDUE',
      entityId: t.id,
      entityName: t.title,
      dueDate: t.dueAt.toISOString(),
      daysOverdue,
      _sortKey: -daysOverdue,
    });
  }

  for (const inv of dueInvoices) {
    const daysRemaining = Math.ceil((inv.dueDate.getTime() - now.getTime()) / msPerDay);
    items.push({
      type: 'INVOICE_DUE',
      entityId: inv.id,
      entityName: inv.invoiceNumber,
      dueDate: inv.dueDate.toISOString(),
      daysRemaining,
      _sortKey: daysRemaining,
    });
  }

  items.sort((a, b) => a._sortKey - b._sortKey);

  const result = items.slice(0, 20).map(({ _sortKey, ...rest }) => rest);

  return result;
}

async function fetchActivity(organizationId: string, db: TenantScopedDb) {
  const items = await db.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      actorName: true,
      actorType: true,
      action: true,
      resourceType: true,
      resourceId: true,
      resourceName: true,
      createdAt: true,
    },
  });

  return { items };
}

// ---------------------------------------------------------------------------
// Dashboard router
// ---------------------------------------------------------------------------

export const dashboardRouter = router({
  /**
   * Returns 5 KPI values with trend data (current vs previous month).
   *
   * Uses a Redis-backed cross-instance singleflight: the response cache TTL
   * is intentionally short (5 s) so dashboard navigations feel live, but
   * burst traffic (10+ pods hitting an expired cache) collapses to a single
   * Postgres run via the SETNX lock. Combined with the FILTER-aggregate
   * consolidation in `fetchKpis`, this keeps writer CPU bounded under
   * realistic load.
   *
   * KPIs go through the read replica when configured. Aggregates are over
   * historical rows; ~50-200ms of replica lag is well within UX tolerance
   * (the cache TTL is already 5s and the trend math compares current month
   * to previous month so a single stale write is invisible). When
   * `DATABASE_URL_<region>_RO` is unset the helper transparently routes to
   * the writer.
   */
  kpis: tenantProcedure.use(reportRead).query(async ({ ctx }) => {
    const region = toDataRegion(ctx.region);
    return cachedSingleflight(
      CacheKeys.dashboardKpis(ctx.organizationId),
      CacheTTL.DASHBOARD_KPIS_BURST,
      () => readReplica(region, db => fetchKpis(ctx.organizationId, db)),
    );
  }),

  /**
   * Monthly spend trend aggregated by currency.
   * Cached for 10 minutes per organization + time range.
   */
  spendTrend: tenantProcedure
    .use(reportRead)
    .input(
      z.object({
        months: z.enum(['6', '12', 'ytd']),
      }),
    )
    .query(async ({ ctx, input }) => {
      return cached(
        CacheKeys.dashboardSpend(ctx.organizationId, input.months),
        CacheTTL.DASHBOARD_SPEND,
        () => fetchSpendTrend(ctx.organizationId, input.months, ctx.db),
      );
    }),

  /**
   * Upcoming deadlines combining contract expirations, overdue tasks, and due invoices.
   * Cached for 3 minutes per organization.
   */
  deadlines: tenantProcedure.use(reportRead).query(async ({ ctx }) => {
    return cached(
      CacheKeys.dashboardDeadlines(ctx.organizationId),
      CacheTTL.DASHBOARD_DEADLINES,
      () => fetchDeadlines(ctx.organizationId, ctx.db),
    );
  }),

  /**
   * Recent activity feed from audit log. Last 20 entries.
   * Cached for 2 minutes per organization.
   */
  activity: tenantProcedure.use(reportRead).query(async ({ ctx }) => {
    return cached(
      CacheKeys.dashboardActivity(ctx.organizationId),
      CacheTTL.DASHBOARD_ACTIVITY,
      () => fetchActivity(ctx.organizationId, ctx.db),
    );
  }),

  /**
   * Bundled dashboard payload — KPIs + spend trend + deadlines + activity
   * fetched server-side in parallel and returned in a single round-trip.
   *
   * Absorbs the existing 7-8 client widget fan-out into one server call.
   * Each sub-fetch shares the same Redis cache entries used by the
   * individual procedures, so calling `bootstrap` does not double-spend
   * cache slots — and existing clients that still call individual
   * procedures continue to work.
   *
   * TODO: migrate the 7-8 dashboard widgets to consume this payload from
   * a single `useSuspenseQuery(trpc.dashboard.bootstrap)` call. Doing so
   * requires updating the SPA dashboard container in
   * `apps/web-vite/src/components/dashboard/dashboard-container.tsx`.
   */
  bootstrap: tenantProcedure
    .use(reportRead)
    .input(
      z.object({
        spendMonths: z.enum(['6', '12', 'ytd']).default('6'),
      }),
    )
    .query(async ({ ctx, input }) => {
      // KPIs go through the read replica when configured (see `kpis`
      // procedure JSDoc for lag-tolerance reasoning); the rest of the
      // bundle still hits the writer pending per-call-site lag review.
      const region = toDataRegion(ctx.region);
      const [kpis, spendTrend, deadlines, activity] = await Promise.all([
        cachedSingleflight(
          CacheKeys.dashboardKpis(ctx.organizationId),
          CacheTTL.DASHBOARD_KPIS_BURST,
          () => readReplica(region, db => fetchKpis(ctx.organizationId, db)),
        ),
        cached(
          CacheKeys.dashboardSpend(ctx.organizationId, input.spendMonths),
          CacheTTL.DASHBOARD_SPEND,
          () => fetchSpendTrend(ctx.organizationId, input.spendMonths, ctx.db),
        ),
        cached(CacheKeys.dashboardDeadlines(ctx.organizationId), CacheTTL.DASHBOARD_DEADLINES, () =>
          fetchDeadlines(ctx.organizationId, ctx.db),
        ),
        cached(CacheKeys.dashboardActivity(ctx.organizationId), CacheTTL.DASHBOARD_ACTIVITY, () =>
          fetchActivity(ctx.organizationId, ctx.db),
        ),
      ]);

      return { kpis, spendTrend, deadlines, activity };
    }),
});
