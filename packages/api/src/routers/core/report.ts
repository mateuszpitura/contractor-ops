import { Prisma } from '@contractor-ops/db/generated/prisma/client';
import { z } from 'zod';
import { router } from '../../init.js';
import { requirePermission } from '../../middleware/rbac.js';
import { tenantProcedure } from '../../middleware/tenant.js';
import {
  generateComplianceCsv,
  generateContractsCsv,
  generateInvoicesCsv,
  generateSpendCsv,
} from '../../services/report-export.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const reportRead = requirePermission({ report: ['read'] });

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

// ---------------------------------------------------------------------------
// Report router
// ---------------------------------------------------------------------------

export const reportRouter = router({
  /**
   * Spend by contractor with pagination, sorting, and date range.
   * Uses raw SQL for grouping paid invoices by contractor.
   */
  spendByContractor: tenantProcedure
    .use(reportRead)
    .input(
      z.object({
        ...dateRangeInput,
        ...paginationInput,
        sortBy: z.enum(['totalSpend', 'invoiceCount', 'contractorName']).default('totalSpend'),
        contractorId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);
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
        totalCount: countResult[0]?.count ?? 0,
      };
    }),

  /**
   * Spend by team via Contractor.primaryTeamId -> Team.
   */
  spendByTeam: tenantProcedure
    .use(reportRead)
    .input(
      z.object({
        ...dateRangeInput,
        ...paginationInput,
        sortBy: z.enum(['totalSpend', 'invoiceCount', 'teamName']).default('totalSpend'),
      }),
    )
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);
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
        totalCount: countResult[0]?.count ?? 0,
      };
    }),

  /**
   * Expiring contracts within N days.
   */
  expiringContracts: tenantProcedure
    .use(reportRead)
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

      const [contracts, totalCount] = await Promise.all([
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
        totalCount,
      };
    }),

  /**
   * Overdue invoices (dueDate < now, not paid/cancelled).
   */
  overdueInvoices: tenantProcedure
    .use(reportRead)
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

      const [invoices, totalCount] = await Promise.all([
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
        totalCount,
      };
    }),

  /**
   * Compliance gaps: contractors with yellow/red health.
   */
  complianceGaps: tenantProcedure
    .use(reportRead)
    .input(
      z.object({
        ...paginationInput,
        sortBy: z.enum(['health', 'contractorName', 'missingDocs']).default('health'),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get contractors with compliance issues
      const contractors = await ctx.db.contractor.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: 'ACTIVE',
          deletedAt: null,
        },
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

      const totalCount = items.length;
      const offset = (input.page - 1) * input.pageSize;
      const paged = items.slice(offset, offset + input.pageSize);

      return { items: paged, totalCount };
    }),

  // =========================================================================
  // Chart endpoints (no pagination)
  // =========================================================================

  /**
   * Top 10 contractors by spend for bar chart.
   */
  spendByContractorChart: tenantProcedure
    .use(reportRead)
    .input(z.object({ ...dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);

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
  spendByTeamChart: tenantProcedure
    .use(reportRead)
    .input(z.object({ ...dateRangeInput }))
    .query(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);

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
  expiringContractsChart: tenantProcedure
    .use(reportRead)
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
  complianceGapsChart: tenantProcedure.use(reportRead).query(async ({ ctx }) => {
    const contractors = await ctx.db.contractor.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
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
  // Export mutations
  // =========================================================================

  /**
   * Export spend by contractor as CSV.
   */
  exportSpendByContractor: tenantProcedure
    .use(reportRead)
    .input(z.object({ ...dateRangeInput, contractorId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);

      const contractorFilter = input.contractorId
        ? Prisma.sql`AND i."contractorId" = ${input.contractorId}`
        : Prisma.empty;

      const items = await ctx.db.$queryRaw<
        Array<{
          contractorName: string;
          invoiceCount: number;
          totalMinor: number;
          avgMinor: number;
          lastPaidAt: Date | null;
        }>
      >`
        SELECT
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
        ORDER BY "totalMinor" DESC
      `;

      const csv = await generateSpendCsv(
        items.map(r => ({
          ...r,
          invoiceCount: Number(r.invoiceCount),
          totalMinor: Number(r.totalMinor),
          avgMinor: Number(r.avgMinor),
          lastPaidAt: r.lastPaidAt ? new Date(r.lastPaidAt).toISOString() : null,
        })),
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      return {
        data: csv.data,
        filename: `spend-by-contractor-${timestamp}.csv`,
        mimeType: csv.mimeType,
      };
    }),

  /**
   * Export spend by team as CSV.
   */
  exportSpendByTeam: tenantProcedure
    .use(reportRead)
    .input(z.object({ ...dateRangeInput }))
    .mutation(async ({ ctx, input }) => {
      const dateFrom = new Date(input.dateFrom);
      const dateTo = new Date(input.dateTo);

      const items = await ctx.db.$queryRaw<
        Array<{
          teamName: string | null;
          contractorCount: number;
          invoiceCount: number;
          totalMinor: number;
        }>
      >`
        SELECT
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
        ORDER BY "totalMinor" DESC
      `;

      // Reuse generateSpendCsv with adapted data
      const csv = await generateSpendCsv(
        items.map(r => ({
          contractorName: r.teamName ?? '',
          invoiceCount: Number(r.invoiceCount),
          totalMinor: Number(r.totalMinor),
          avgMinor: 0,
          lastPaidAt: null,
        })),
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      return {
        data: csv.data,
        filename: `spend-by-team-${timestamp}.csv`,
        mimeType: csv.mimeType,
      };
    }),

  /**
   * Export expiring contracts as CSV.
   */
  exportExpiringContracts: tenantProcedure
    .use(reportRead)
    .input(z.object({ days: z.enum(['30', '60', '90']).default('30') }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const daysNum = parseInt(input.days, 10);
      const futureDate = new Date(now.getTime() + daysNum * 24 * 60 * 60 * 1000);
      const msPerDay = 24 * 60 * 60 * 1000;

      const contracts = await ctx.db.contract.findMany({
        where: {
          organizationId: ctx.organizationId,
          status: { in: ['ACTIVE', 'EXPIRING'] as ('ACTIVE' | 'EXPIRING')[] },
          endDate: { gte: now, lte: futureDate },
          deletedAt: null,
        },
        include: {
          contractor: { select: { legalName: true } },
        },
        orderBy: { endDate: 'asc' },
      });

      const csv = await generateContractsCsv(
        contracts.map(c => ({
          contractTitle: c.title,
          contractorName: c.contractor.legalName,
          endDate: c.endDate?.toISOString().slice(0, 10) ?? '',
          daysRemaining: c.endDate
            ? Math.ceil((c.endDate.getTime() - now.getTime()) / msPerDay)
            : 0,
          status: c.status,
        })),
      );

      const timestamp = new Date().toISOString().slice(0, 10);
      return {
        data: csv.data,
        filename: `expiring-contracts-${timestamp}.csv`,
        mimeType: csv.mimeType,
      };
    }),

  /**
   * Export overdue invoices as CSV.
   */
  exportOverdueInvoices: tenantProcedure.use(reportRead).mutation(async ({ ctx }) => {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;

    const invoices = await ctx.db.invoice.findMany({
      where: {
        organizationId: ctx.organizationId,
        dueDate: { lt: now },
        paymentStatus: { notIn: ['PAID'] as 'PAID'[] },
        deletedAt: null,
      },
      include: {
        contractor: { select: { legalName: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const csv = await generateInvoicesCsv(
      invoices.map(inv => ({
        invoiceNumber: inv.invoiceNumber,
        contractorName: inv.contractor?.legalName ?? 'Unknown',
        amountMinor: inv.amountToPayMinor,
        currency: inv.currency,
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        daysOverdue: Math.ceil((now.getTime() - inv.dueDate.getTime()) / msPerDay),
        status: inv.paymentStatus,
      })),
    );

    const timestamp = new Date().toISOString().slice(0, 10);
    return {
      data: csv.data,
      filename: `overdue-invoices-${timestamp}.csv`,
      mimeType: csv.mimeType,
    };
  }),

  /**
   * Export compliance gaps as CSV.
   */
  exportComplianceGaps: tenantProcedure.use(reportRead).mutation(async ({ ctx }) => {
    const contractors = await ctx.db.contractor.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: {
        complianceItems: { select: { status: true } },
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

    type GapItem = {
      contractorName: string;
      missingDocuments: number;
      contractStatus: string;
      overdueTasks: number;
      health: string;
    };

    const items: GapItem[] = [];

    for (const c of contractors) {
      const missingOrExpired = c._count.complianceItems;
      const hasPending = c.complianceItems.some(ci => ci.status === 'PENDING');
      const hasActiveContract = c.contracts.some(con => con.status === 'ACTIVE');

      let health = 'green';
      if (missingOrExpired > 0 || !hasActiveContract) {
        health = 'red';
      } else if (hasPending) {
        health = 'yellow';
      }

      if (health !== 'green') {
        items.push({
          contractorName: c.legalName,
          missingDocuments: missingOrExpired,
          contractStatus: hasActiveContract ? 'ACTIVE' : 'NONE',
          overdueTasks: 0,
          health,
        });
      }
    }

    const csv = await generateComplianceCsv(items);
    const timestamp = new Date().toISOString().slice(0, 10);
    return {
      data: csv.data,
      filename: `compliance-gaps-${timestamp}.csv`,
      mimeType: csv.mimeType,
    };
  }),
});
