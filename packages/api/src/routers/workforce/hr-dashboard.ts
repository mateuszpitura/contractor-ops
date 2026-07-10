// Staff HR command dashboard — read-only aggregation over the shipped Theme B
// employee data (registry, personnel file, leave) plus the v6.0 F1 compliance
// expiry math and F3 Gulf nationalisation service.
//
// Every procedure runs through `hrDashboardProcedure`: tenant scope +
// `employee:read` RBAC (which resolves to the four HR roles ONLY — owner is
// excluded because `allPermissions` omits `employee`, the BFLA fence, and no
// other role holds the grant) + a per-request `module.hr-dashboard`
// re-assert + the per-org report rate-limit. Every `where` restates
// `organizationId`; no client-supplied id is ever trusted; inputs are `.strict()`.

import { daysUntilExpiryInTz } from '@contractor-ops/compliance-policy';
import { z } from 'zod';
import { router } from '../../init';
import { requirePermission } from '../../middleware/rbac';
import { reportRateLimitMiddleware } from '../../middleware/report-rate-limit';
import { assertHrDashboardEnabled } from '../../middleware/require-hr-dashboard-flag';
import { tenantProcedure } from '../../middleware/tenant';
import type { EmployeeDocExpiryInput } from '../../services/hr-dashboard-doc-expiry';
import { deriveEmployeeDocExpiry, tzForCountry } from '../../services/hr-dashboard-doc-expiry';
import type { ProbationRow } from '../../services/hr-dashboard-probation';
import { deriveProbationWatchlist } from '../../services/hr-dashboard-probation';
import type { LeaveBalanceRow } from '../../services/hr-dashboard-utilization';
import { deriveVacationUtilization } from '../../services/hr-dashboard-utilization';
import type { NationalisationDashboardResult } from '../../services/saudization-dashboard';
import { computeNationalisationDashboard } from '../../services/saudization-dashboard';
import { hasSectionPermission } from '../core/personnel-file/section-access';

const hrDashboardProcedure = tenantProcedure
  .use(requirePermission({ employee: ['read'] }))
  .use(assertHrDashboardEnabled)
  .use(reportRateLimitMiddleware);

const emptyInput = z.object({}).strict();

const UNSPECIFIED = 'unspecified';
const PROBATION_WINDOW_DAYS = 14;
const CONTRACT_END_SOON_DAYS = 30;
const CONTRACT_END_NEAR_DAYS = 90;

type CountBucket = { key: string; count: number };

/** groupBy result → sorted {key,count} buckets, null grouping key → 'unspecified'. */
function toBuckets(rows: readonly { _count: { _all: number } }[], column: string): CountBucket[] {
  return rows
    .map(row => ({
      key: ((row as Record<string, unknown>)[column] as string | null) ?? UNSPECIFIED,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count);
}

export const hrDashboardRouter = router({
  /** Headcount total + breakdowns (all over the active workforce). */
  getHeadcount: hrDashboardProcedure.input(emptyInput).query(async ({ ctx }) => {
    const activeWhere = {
      organizationId: ctx.organizationId,
      OR: [{ employmentStatus: null }, { employmentStatus: { not: 'TERMINATED' as const } }],
      worker: { deletedAt: null, workerType: 'EMPLOYEE' as const },
    };

    const [total, byDepartmentRows, byJurisdictionRows, byEmploymentTypeRows, contractEndRows] =
      await Promise.all([
        ctx.db.employeeProfile.count({ where: activeWhere }),
        ctx.db.employeeProfile.groupBy({
          by: ['department'],
          where: activeWhere,
          _count: { _all: true },
        }),
        ctx.db.employeeProfile.groupBy({
          by: ['countryCode'],
          where: activeWhere,
          _count: { _all: true },
        }),
        ctx.db.employeeProfile.groupBy({
          by: ['employmentType'],
          where: activeWhere,
          _count: { _all: true },
        }),
        ctx.db.employeeProfile.findMany({
          where: activeWhere,
          select: { contractEndDate: true, countryCode: true },
        }),
      ]);

    const now = new Date();
    const contractEndBuckets = { expiredOrPast: 0, soon30: 0, soon90: 0, later: 0, none: 0 };
    for (const row of contractEndRows) {
      if (!row.contractEndDate) {
        contractEndBuckets.none += 1;
        continue;
      }
      const days = daysUntilExpiryInTz(row.contractEndDate, tzForCountry(row.countryCode), now);
      if (days < 0) contractEndBuckets.expiredOrPast += 1;
      else if (days <= CONTRACT_END_SOON_DAYS) contractEndBuckets.soon30 += 1;
      else if (days <= CONTRACT_END_NEAR_DAYS) contractEndBuckets.soon90 += 1;
      else contractEndBuckets.later += 1;
    }

    return {
      total,
      byDepartment: toBuckets(byDepartmentRows, 'department'),
      byJurisdiction: toBuckets(byJurisdictionRows, 'countryCode'),
      byEmploymentType: toBuckets(byEmploymentTypeRows, 'employmentType'),
      byContractEndBucket: contractEndBuckets,
    };
  }),

  /** Vacation utilization from the LeaveBalance cache (no ledger re-sum). */
  getVacationUtilization: hrDashboardProcedure
    .input(z.object({ year: z.number().int().optional() }).strict())
    .query(async ({ ctx, input }) => {
      const balances = await ctx.db.leaveBalance.findMany({
        where: {
          organizationId: ctx.organizationId,
          leaveType: { kind: 'ANNUAL' },
          ...(input.year === undefined ? {} : { year: input.year }),
        },
        select: {
          workerId: true,
          year: true,
          entitledMinutes: true,
          usedMinutes: true,
          carryoverMinutes: true,
        },
      });
      return deriveVacationUtilization(balances satisfies LeaveBalanceRow[], new Date());
    }),

  /** Document expiry via the shared compliance-policy expiry math, section-filtered. */
  getDocumentExpiry: hrDashboardProcedure.input(emptyInput).query(async ({ ctx }) => {
    const rows = await ctx.db.personnelFileDocument.findMany({
      where: {
        organizationId: ctx.organizationId,
        expiresAt: { not: null },
        deletedAt: null,
      },
      select: {
        documentId: true,
        expiresAt: true,
        docCategory: true,
        section: true,
        personnelFile: {
          select: { countryCode: true, workerId: true, worker: { select: { displayName: true } } },
        },
      },
    });

    // Section grain: drop any document whose section the caller cannot read.
    // A null section (unclassified) is only visible to callers who can read
    // every section (i.e. no section is out of reach) — otherwise it is withheld.
    const visible: EmployeeDocExpiryInput[] = [];
    for (const row of rows) {
      if (row.section && !hasSectionPermission(ctx, row.section)) continue;
      if (!(row.section || canReadAllSections(ctx))) continue;
      visible.push({
        documentId: row.documentId,
        expiresAt: row.expiresAt,
        docCategory: row.docCategory,
        section: row.section,
        countryCode: row.personnelFile.countryCode,
        workerId: row.personnelFile.workerId,
        workerDisplayName: row.personnelFile.worker.displayName,
      });
    }

    return deriveEmployeeDocExpiry(visible, new Date());
  }),

  /** Probation watchlist over the indexed probationEndsAt window. */
  getProbationWatchlist: hrDashboardProcedure.input(emptyInput).query(async ({ ctx }) => {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const windowEnd = new Date(
      startOfToday.getTime() + PROBATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const rows = await ctx.db.employeeProfile.findMany({
      where: {
        organizationId: ctx.organizationId,
        OR: [{ employmentStatus: null }, { employmentStatus: { not: 'TERMINATED' } }],
        worker: { deletedAt: null, workerType: 'EMPLOYEE' },
        probationEndsAt: { gte: startOfToday, lte: windowEnd },
      },
      select: {
        workerId: true,
        probationEndsAt: true,
        countryCode: true,
        worker: { select: { displayName: true } },
      },
    });

    const probationRows: ProbationRow[] = rows
      .filter((r): r is typeof r & { probationEndsAt: Date } => r.probationEndsAt !== null)
      .map(r => ({
        workerId: r.workerId,
        probationEndsAt: r.probationEndsAt,
        displayName: r.worker.displayName,
        countryCode: r.countryCode,
      }));

    return deriveProbationWatchlist(probationRows, now);
  }),

  /** Per-country nationalisation rollup (KSA Saudization + UAE Emiratisation). */
  getNationalisationRollup: hrDashboardProcedure.input(emptyInput).query(async ({ ctx }) => {
    const [headcount, config] = await Promise.all([
      ctx.db.saudiHeadcount.findFirst({
        where: { organizationId: ctx.organizationId },
        orderBy: { recordedAt: 'desc' },
        select: { totalHeadcount: true, saudiHeadcount: true },
      }),
      ctx.db.saudizationConfig.findUnique({
        where: { organizationId: ctx.organizationId },
        select: { band: true, industrySegment: true, bandLastUpdatedAt: true },
      }),
    ]);

    // KSA rate + band from the manual headcount ONLY (never an EmployeeProfile
    // groupBy — the structural anti-feature). Absent when no headcount recorded.
    let ksa: NationalisationDashboardResult | undefined;
    if (headcount) {
      ksa = computeNationalisationDashboard('KSA', {
        headcount,
        config: {
          band: config?.band ?? null,
          industrySegment: config?.industrySegment ?? null,
          bandLastUpdatedAt: config?.bandLastUpdatedAt ?? null,
        },
        platformContractors: [],
        iqamaItems: [],
      });
    }

    // UAE Emiratisation shares the identical manual-input + read-through-band
    // posture; it surfaces once a manual UAE headcount is recorded (there is no
    // UAE headcount store at HEAD, so the UI shows the "record manual headcount"
    // prompt). A platform-derived Emiratisation rate is never computed.
    const uae: NationalisationDashboardResult | undefined = undefined;

    return { ksa, uae };
  }),

  /** Composite KPI header — the headline counts in one rate-limit-friendly call. */
  getSummary: hrDashboardProcedure.input(emptyInput).query(async ({ ctx }) => {
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const windowEnd = new Date(
      startOfToday.getTime() + PROBATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );

    const [
      totalHeadcount,
      balances,
      probationDueCount,
      expiringDocCount,
      degradedEntitlementCount,
    ] = await Promise.all([
      ctx.db.employeeProfile.count({
        where: {
          organizationId: ctx.organizationId,
          OR: [{ employmentStatus: null }, { employmentStatus: { not: 'TERMINATED' } }],
          worker: { deletedAt: null, workerType: 'EMPLOYEE' },
        },
      }),
      ctx.db.leaveBalance.findMany({
        where: {
          organizationId: ctx.organizationId,
          leaveType: { kind: 'ANNUAL' },
        },
        select: {
          workerId: true,
          year: true,
          entitledMinutes: true,
          usedMinutes: true,
          carryoverMinutes: true,
        },
      }),
      ctx.db.employeeProfile.count({
        where: {
          organizationId: ctx.organizationId,
          OR: [{ employmentStatus: null }, { employmentStatus: { not: 'TERMINATED' } }],
          worker: { deletedAt: null, workerType: 'EMPLOYEE' },
          probationEndsAt: { gte: startOfToday, lte: windowEnd },
        },
      }),
      ctx.db.personnelFileDocument.count({
        where: {
          organizationId: ctx.organizationId,
          deletedAt: null,
          expiresAt: {
            not: null,
            lte: new Date(startOfToday.getTime() + 90 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      ctx.db.employeeProfile.count({
        where: {
          organizationId: ctx.organizationId,
          OR: [{ employmentStatus: null }, { employmentStatus: { not: 'TERMINATED' } }],
          worker: {
            deletedAt: null,
            workerType: 'EMPLOYEE',
            OR: [{ personnelFile: null }, { personnelFile: { hireDate: null } }],
          },
        },
      }),
    ]);

    const { underUtilizedCount } = deriveVacationUtilization(
      balances satisfies LeaveBalanceRow[],
      now,
    );

    return {
      totalHeadcount,
      underUtilizedCount,
      probationDueCount,
      expiringDocCount,
      degradedEntitlementCount,
    };
  }),
});

/** Whether the caller can read ALL four personnel-file sections. */
function canReadAllSections(ctx: Parameters<typeof hasSectionPermission>[0]): boolean {
  return (['SECTION_A', 'SECTION_B', 'SECTION_C', 'SECTION_D'] as const).every(s =>
    hasSectionPermission(ctx, s),
  );
}
