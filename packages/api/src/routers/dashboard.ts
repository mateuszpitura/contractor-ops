import { z } from 'zod';
import { router } from '../init.js';
import type { TenantScopedDb } from '../lib/tenant-db.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { CacheKeys, CacheTTL, cached } from '../services/cache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function plain<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}

const reportRead = requirePermission({ report: ['read'] });

// ---------------------------------------------------------------------------
// Data fetchers (extracted for caching)
// ---------------------------------------------------------------------------

async function fetchKpis(organizationId: string, db: TenantScopedDb) {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    activeContractors,
    prevActiveContractors,
    pendingApprovals,
    prevPendingApprovals,
    readyToPayAgg,
    prevReadyToPayAgg,
    expiringContracts,
    openTasks,
  ] = await Promise.all([
    db.contractor.count({
      where: { organizationId, status: 'ACTIVE', deletedAt: null },
    }),
    db.contractor.count({
      where: {
        organizationId,
        status: 'ACTIVE',
        deletedAt: null,
        createdAt: { lt: startOfCurrentMonth },
      },
    }),
    db.approvalStep.count({
      where: { organizationId, status: 'PENDING' },
    }),
    db.approvalStep.count({
      where: {
        organizationId,
        status: 'PENDING',
        createdAt: { lt: startOfCurrentMonth },
      },
    }),
    db.invoice.aggregate({
      _sum: { amountToPayMinor: true },
      where: { organizationId, paymentStatus: 'READY', deletedAt: null },
    }),
    db.invoice.aggregate({
      _sum: { amountToPayMinor: true },
      where: {
        organizationId,
        paymentStatus: 'READY',
        deletedAt: null,
        readyForPaymentAt: {
          gte: startOfPreviousMonth,
          lt: startOfCurrentMonth,
        },
      },
    }),
    db.contract.count({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'EXPIRING'] },
        endDate: { gte: now, lte: thirtyDaysFromNow },
        deletedAt: null,
      },
    }),
    db.workflowTaskRun.count({
      where: {
        organizationId,
        status: { in: ['TODO', 'IN_PROGRESS'] },
      },
    }),
  ]);

  return plain({
    activeContractors: {
      value: activeContractors,
      prevValue: prevActiveContractors,
    },
    pendingApprovals: {
      value: pendingApprovals,
      prevValue: prevPendingApprovals,
    },
    readyToPayTotal: {
      valueMinor: readyToPayAgg._sum.amountToPayMinor ?? 0,
      prevValueMinor: prevReadyToPayAgg._sum.amountToPayMinor ?? 0,
    },
    expiringContracts: {
      value: expiringContracts,
    },
    openTasks: {
      value: openTasks,
    },
  });
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
      COALESCE(SUM("amountToPayMinor")::int, 0) AS "totalMinor"
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

  return plain(result);
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

  return plain({ items });
}

// ---------------------------------------------------------------------------
// Dashboard router
// ---------------------------------------------------------------------------

export const dashboardRouter = router({
  /**
   * Returns 5 KPI values with trend data (current vs previous month).
   * Cached for 5 minutes per organization.
   */
  kpis: tenantProcedure.use(reportRead).query(async ({ ctx }) => {
    return cached(CacheKeys.dashboardKpis(ctx.organizationId), CacheTTL.DASHBOARD_KPIS, () =>
      fetchKpis(ctx.organizationId, ctx.db),
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
});
