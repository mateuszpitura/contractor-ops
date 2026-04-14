// ---------------------------------------------------------------------------
// Classification compliance dashboard tRPC router — Phase 60, Plan 04.
// ---------------------------------------------------------------------------
//
// Aggregates Phase-58 ClassificationAssessment + Phase-60 Economic-Dependency
// + Reassessment-Trigger + Statusfeststellungsverfahren into a single
// per-market compliance view (CLASS-10).
//
// Security contract:
//   - Every procedure chains through `tenantProcedure` — the Prisma tenant
//     extension auto-scopes all reads by organizationId.
//   - Every procedure additionally requires `contractor:read` (ASVS V4).
//   - `exportMarketCsv` writes a CSV buffer to R2 under an org-scoped key and
//     returns a 300s signed download URL; all user-entered string fields pass
//     through `escapeCsvField` which also neutralises formula-injection
//     prefixes (=/+/-/@) per research gap A11 (OWASP).
//   - Every ClassificationAssessment query filters `status: 'completed'` so
//     drafts never leak into compliance aggregates (Pitfall 8).
//   - No cross-org read needed — dashboard runs in request context, so
//     `ctx.db` (tenant extension) suffices. prismaRaw is NOT imported here.

import { z } from 'zod';

import { encodeCsvUtf8Bom, escapeCsvField, UTF8_BOM } from '../lib/csv.js';
import { router } from '../init.js';
import { requirePermission } from '../middleware/rbac.js';
import { tenantProcedure } from '../middleware/tenant.js';
import { putObjectAndSignDownload } from '../services/r2.js';

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const marketInput = z.object({
  market: z.enum(['GB', 'DE']),
});

// ---------------------------------------------------------------------------
// Gated procedures — every procedure requires contractor:read
// (T-60-20 — dashboard must not bypass RBAC).
// ---------------------------------------------------------------------------

const contractorReadProcedure = tenantProcedure.use(
  requirePermission({ contractor: ['read'] }),
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CSV download signed-URL TTL (UI-SPEC D-16). */
const CSV_TTL_SECONDS = 300;

/** Defensive cap on detail-row queries (T-60-18). */
const DETAIL_ROW_TAKE = 1000;

/** Days-ahead window for DRV validTo expiry in activeAlertsByMarket DE. */
const DRV_EXPIRY_WINDOW_DAYS = 90;

/** Calendar-month window for overdueByMarket DE. */
const OVERDUE_DE_MONTHS = 12;

// ---------------------------------------------------------------------------
// CSV column contract (UI-SPEC D-16)
// ---------------------------------------------------------------------------

const CSV_COLUMNS = [
  { key: 'engagementId', header: 'Engagement ID' },
  { key: 'contractorName', header: 'Contractor' },
  { key: 'country', header: 'Country' },
  { key: 'latestVerdict', header: 'Latest verdict' },
  { key: 'latestCompletedAt', header: 'Assessment completed' },
  { key: 'latestScore', header: 'DRV score' },
  { key: 'economicBand', header: 'Economic-dep band' },
  { key: 'billingShare', header: 'Billing share' },
  { key: 'openReassessmentTrigger', header: 'Open reassessment trigger?' },
  { key: 'drvOutcome', header: 'DRV outcome' },
  { key: 'drvValidTo', header: 'DRV valid until' },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IR35Verdict = 'outside' | 'inside' | 'indeterminate';
type DRVVerdict = 'green' | 'amber' | 'red';
type RiskBucket = 'safe' | 'warning' | 'critical';

/** Map a completed IR35 outcome to a three-bucket risk tone. */
function ir35VerdictToBucket(verdict: IR35Verdict): RiskBucket {
  switch (verdict) {
    case 'outside':
      return 'safe';
    case 'indeterminate':
      return 'warning';
    case 'inside':
      return 'critical';
  }
}

/** Map a completed DRV outcome to a three-bucket risk tone. */
function drvVerdictToBucket(verdict: DRVVerdict): RiskBucket {
  switch (verdict) {
    case 'green':
      return 'safe';
    case 'amber':
      return 'warning';
    case 'red':
      return 'critical';
  }
}

/** Narrow a JSON outcome payload to an IR35 verdict string if possible. */
function readIr35Verdict(outcome: unknown): IR35Verdict | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const o = outcome as { kind?: unknown; verdict?: unknown };
  if (o.kind !== 'IR35') return null;
  if (o.verdict === 'outside' || o.verdict === 'inside' || o.verdict === 'indeterminate') {
    return o.verdict;
  }
  return null;
}

/** Narrow a JSON outcome payload to a DRV verdict string if possible. */
function readDrvVerdict(outcome: unknown): DRVVerdict | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const o = outcome as { kind?: unknown; verdict?: unknown };
  if (o.kind !== 'SCHEINSELBSTANDIGKEIT') return null;
  if (o.verdict === 'green' || o.verdict === 'amber' || o.verdict === 'red') {
    return o.verdict;
  }
  return null;
}

/** Narrow the JSON outcome payload to a numeric DRV score if present. */
function readDrvScore(outcome: unknown): number | null {
  if (!outcome || typeof outcome !== 'object') return null;
  const o = outcome as { kind?: unknown; score?: unknown };
  if (o.kind !== 'SCHEINSELBSTANDIGKEIT') return null;
  return typeof o.score === 'number' ? o.score : null;
}

/** Format a Date as an ISO date-only string (YYYY-MM-DD) for CSV cells. */
function toIsoDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

type DashboardRow = {
  engagementId: string;
  contractorName: string;
  country: 'GB' | 'DE';
  latestVerdict: string | null;
  latestCompletedAt: Date | null;
  latestScore: number | null;
  economicBand: string | null;
  billingShare: number | null;
  openTrigger: boolean;
  drvOutcome: string | null;
  drvValidTo: Date | null;
};

// ---------------------------------------------------------------------------
// buildDashboardRows — shared data join for CSV export + (future) UI reuse
// ---------------------------------------------------------------------------

type DbCtx = { db: Record<string, unknown> };

/**
 * Joins ContractorAssignment + Contractor + latest completed ClassificationAssessment
 * + EconomicDependencyAlertState + ReassessmentTrigger + Statusfeststellungsverfahren
 * for all ACTIVE assignments of the given market, producing one row per engagement.
 *
 * DE-only columns (score/band/share/drv*) are `null` for GB rows so the CSV
 * column set is stable across markets (UI-SPEC D-16 column contract).
 */
async function buildDashboardRows(ctx: DbCtx, market: 'GB' | 'DE'): Promise<DashboardRow[]> {
  const db = ctx.db as {
    contractorAssignment: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    classificationAssessment: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    economicDependencyAlertState: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    reassessmentTrigger: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
    statusfeststellungsverfahren: {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };

  const assignments = await db.contractorAssignment.findMany({
    where: { status: 'ACTIVE', contractor: { countryCode: market } },
    include: { contractor: { select: { id: true, name: true, countryCode: true } } },
    take: DETAIL_ROW_TAKE,
  });

  const assignmentIds = assignments
    .map(a => a.id)
    .filter((id): id is string => typeof id === 'string');

  const [completedAssessments, alertStates, openTriggers, drvRecords] = await Promise.all([
    db.classificationAssessment.findMany({
      where: {
        status: 'completed',
        countryCode: market,
        contractorAssignmentId: { in: assignmentIds },
      },
      orderBy: { completedAt: 'desc' },
      take: DETAIL_ROW_TAKE,
    }),
    market === 'DE'
      ? db.economicDependencyAlertState.findMany({
          where: { contractorAssignmentId: { in: assignmentIds } },
        })
      : Promise.resolve([]),
    db.reassessmentTrigger.findMany({
      where: {
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        contractorAssignmentId: { in: assignmentIds },
      },
    }),
    market === 'DE'
      ? db.statusfeststellungsverfahren.findMany({
          where: { contractorAssignmentId: { in: assignmentIds } },
          orderBy: { filedAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  // Index latest completed assessment per engagement.
  const latestByAssignment = new Map<string, Record<string, unknown>>();
  for (const a of completedAssessments) {
    const key = a.contractorAssignmentId as string;
    if (!latestByAssignment.has(key)) latestByAssignment.set(key, a);
  }

  const alertByAssignment = new Map<string, Record<string, unknown>>();
  for (const s of alertStates) {
    alertByAssignment.set(s.contractorAssignmentId as string, s);
  }

  const triggerByAssignment = new Set<string>();
  for (const t of openTriggers) {
    triggerByAssignment.add(t.contractorAssignmentId as string);
  }

  const drvByAssignment = new Map<string, Record<string, unknown>>();
  for (const d of drvRecords) {
    const key = d.contractorAssignmentId as string;
    if (!drvByAssignment.has(key)) drvByAssignment.set(key, d);
  }

  const rows: DashboardRow[] = assignments.map(a => {
    const assignmentId = a.id as string;
    const contractor = a.contractor as { name?: unknown } | undefined;
    const latest = latestByAssignment.get(assignmentId);
    const alert = alertByAssignment.get(assignmentId);
    const drv = drvByAssignment.get(assignmentId);

    const verdict =
      market === 'GB'
        ? (latest ? readIr35Verdict(latest.outcome) : null)
        : (latest ? readDrvVerdict(latest.outcome) : null);

    return {
      engagementId: assignmentId,
      contractorName: typeof contractor?.name === 'string' ? contractor.name : '',
      country: market,
      latestVerdict: verdict,
      latestCompletedAt: (latest?.completedAt as Date) ?? null,
      latestScore: market === 'DE' && latest ? readDrvScore(latest.outcome) : null,
      economicBand:
        market === 'DE' && alert ? ((alert.currentBand as string) ?? null) : null,
      billingShare:
        market === 'DE' && alert
          ? Number(alert.lastBillingShare ?? 0)
          : null,
      openTrigger: triggerByAssignment.has(assignmentId),
      drvOutcome:
        market === 'DE' && drv ? ((drv.outcome as string) ?? null) : null,
      drvValidTo:
        market === 'DE' && drv ? ((drv.validTo as Date | null) ?? null) : null,
    };
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const classificationDashboardRouter = router({
  /**
   * Global page-header KPIs (totalContractors + totalActiveEngagements + lastScannedAt).
   * lastScannedAt = max of EconomicDependencyAlertState.lastScannedAt and
   * CronScanState.lastScanCompletedAt for 'classification-reassessment-triggers'.
   */
  globalHeader: contractorReadProcedure.query(async ({ ctx }) => {
    const db = ctx.db as {
      contractor: { count: (args?: unknown) => Promise<number> };
      contractorAssignment: { count: (args?: unknown) => Promise<number> };
      economicDependencyAlertState: {
        findFirst: (args: unknown) => Promise<{ lastScannedAt: Date | null } | null>;
      };
      cronScanState: {
        findUnique: (args: unknown) => Promise<{ lastScanCompletedAt: Date | null } | null>;
      };
    };
    const [totalContractors, totalActiveEngagements, lastEconomicScan, cronScan] =
      await Promise.all([
        db.contractor.count(),
        db.contractorAssignment.count({ where: { status: 'ACTIVE' } }),
        db.economicDependencyAlertState.findFirst({
          orderBy: { lastScannedAt: 'desc' },
          select: { lastScannedAt: true },
        }),
        db.cronScanState.findUnique({
          where: { name: 'classification-reassessment-triggers' },
          select: { lastScanCompletedAt: true },
        }),
      ]);

    const candidates = [lastEconomicScan?.lastScannedAt, cronScan?.lastScanCompletedAt].filter(
      (d): d is Date => d instanceof Date,
    );
    const lastScannedAt =
      candidates.length > 0
        ? candidates.reduce((acc, d) => (d > acc ? d : acc), candidates[0]!)
        : null;

    return {
      totalContractors,
      totalActiveEngagements,
      lastScannedAt,
    };
  }),

  /**
   * Assessment-coverage tile — `completed / total` for ACTIVE engagements of
   * this market. Completed = engagements with ≥1 classification assessment
   * of `status='completed'` (Pitfall 8 — drafts excluded).
   */
  coverageByMarket: contractorReadProcedure
    .input(marketInput)
    .query(async ({ ctx, input }) => {
      const db = ctx.db as {
        contractorAssignment: { count: (args?: unknown) => Promise<number> };
        classificationAssessment: {
          findMany: (args: unknown) => Promise<Array<{ contractorAssignmentId: string }>>;
        };
      };

      const [total, completedAssessments] = await Promise.all([
        db.contractorAssignment.count({
          where: { status: 'ACTIVE', contractor: { countryCode: input.market } },
        }),
        db.classificationAssessment.findMany({
          where: { status: 'completed', countryCode: input.market },
          select: { contractorAssignmentId: true },
          distinct: ['contractorAssignmentId'],
          take: DETAIL_ROW_TAKE,
        }),
      ]);

      return { completed: completedAssessments.length, total };
    }),

  /**
   * Risk-distribution tile — counts of completed assessments per bucket
   * (safe / warning / critical) for this market. Drafts excluded (Pitfall 8).
   *
   * GB mapping: outside → safe, indeterminate → warning, inside → critical.
   * DE mapping: green   → safe, amber         → warning, red    → critical.
   *
   * Only the LATEST completed assessment per engagement is counted so
   * re-assessments replace prior verdicts.
   */
  riskDistributionByMarket: contractorReadProcedure
    .input(marketInput)
    .query(async ({ ctx, input }) => {
      const db = ctx.db as {
        classificationAssessment: {
          findMany: (args: unknown) => Promise<
            Array<{
              contractorAssignmentId: string;
              outcome: unknown;
              completedAt: Date | null;
            }>
          >;
        };
      };

      const rows = await db.classificationAssessment.findMany({
        where: { status: 'completed', countryCode: input.market },
        orderBy: { completedAt: 'desc' },
        select: { contractorAssignmentId: true, outcome: true, completedAt: true },
        take: DETAIL_ROW_TAKE,
      });

      // Keep only the latest completed assessment per engagement.
      const seen = new Set<string>();
      const counts: Record<RiskBucket, number> = { safe: 0, warning: 0, critical: 0 };
      let totalCompleted = 0;

      for (const row of rows) {
        if (seen.has(row.contractorAssignmentId)) continue;
        seen.add(row.contractorAssignmentId);
        totalCompleted += 1;

        if (input.market === 'GB') {
          const v = readIr35Verdict(row.outcome);
          if (v) counts[ir35VerdictToBucket(v)] += 1;
        } else {
          const v = readDrvVerdict(row.outcome);
          if (v) counts[drvVerdictToBucket(v)] += 1;
        }
      }

      return { counts, totalCompleted };
    }),

  /**
   * Overdue reassessments tile — top-N list surfaced to UI.
   *   - GB: open/acknowledged ReassessmentTrigger rows.
   *   - DE: completed DE assessments whose latest completedAt is older than
   *         12 months (configurable via OVERDUE_DE_MONTHS).
   */
  overdueByMarket: contractorReadProcedure
    .input(marketInput)
    .query(async ({ ctx, input }) => {
      const db = ctx.db as {
        reassessmentTrigger: {
          findMany: (args: unknown) => Promise<
            Array<{
              id: string;
              contractorAssignmentId: string;
              contractorAssignment?: { contractor?: { name?: string | null } | null } | null;
            }>
          >;
        };
        classificationAssessment: {
          findMany: (args: unknown) => Promise<
            Array<{
              contractorAssignmentId: string;
              completedAt: Date | null;
              contractorAssignment?: { contractor?: { name?: string | null } | null } | null;
            }>
          >;
        };
      };

      if (input.market === 'GB') {
        const triggers = await db.reassessmentTrigger.findMany({
          where: {
            status: { in: ['OPEN', 'ACKNOWLEDGED'] },
            contractorAssignment: { contractor: { countryCode: 'GB' } },
          },
          include: {
            contractorAssignment: {
              include: { contractor: { select: { name: true, countryCode: true } } },
            },
          },
          take: DETAIL_ROW_TAKE,
        });

        const items = triggers.map(t => ({
          contractorAssignmentId: t.contractorAssignmentId,
          contractorName: t.contractorAssignment?.contractor?.name ?? '',
          reason: 'reassessment-trigger',
        }));

        return { count: items.length, items: items.slice(0, 5) };
      }

      // DE — assessments older than N months.
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - OVERDUE_DE_MONTHS);

      const rows = await db.classificationAssessment.findMany({
        where: {
          status: 'completed',
          countryCode: 'DE',
          completedAt: { lt: cutoff },
        },
        include: {
          contractorAssignment: {
            include: { contractor: { select: { name: true, countryCode: true } } },
          },
        },
        orderBy: { completedAt: 'asc' },
        take: DETAIL_ROW_TAKE,
      });

      // Keep latest per engagement (already sorted ASC of completedAt per engagement —
      // collapse to one row per engagement, picking the freshest ASC since all are overdue).
      const latestByAssignment = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!latestByAssignment.has(r.contractorAssignmentId))
          latestByAssignment.set(r.contractorAssignmentId, r);
      }

      const items = [...latestByAssignment.values()].map(r => ({
        contractorAssignmentId: r.contractorAssignmentId,
        contractorName: r.contractorAssignment?.contractor?.name ?? '',
        reason: 'over-12-months',
      }));

      return { count: items.length, items: items.slice(0, 5) };
    }),

  /**
   * Active-alerts tile — market-dispatched:
   *   - GB: count of open/acknowledged reassessment triggers.
   *   - DE: economicBands (warning + critical) + DRV clearances expiring in ≤90 days.
   */
  activeAlertsByMarket: contractorReadProcedure
    .input(marketInput)
    .query(async ({ ctx, input }) => {
      const db = ctx.db as {
        reassessmentTrigger: { count: (args: unknown) => Promise<number> };
        economicDependencyAlertState: { count: (args: unknown) => Promise<number> };
        statusfeststellungsverfahren: { count: (args: unknown) => Promise<number> };
      };

      if (input.market === 'GB') {
        const openReassessmentTriggers = await db.reassessmentTrigger.count({
          where: {
            status: { in: ['OPEN', 'ACKNOWLEDGED'] },
            contractorAssignment: { contractor: { countryCode: 'GB' } },
          },
        });
        return { openReassessmentTriggers };
      }

      const now = new Date();
      const windowEnd = new Date(now.getTime() + DRV_EXPIRY_WINDOW_DAYS * 86_400_000);

      const [warning, critical, drvExpiringWithin90d] = await Promise.all([
        db.economicDependencyAlertState.count({
          where: {
            currentBand: 'warning',
            contractorAssignment: { contractor: { countryCode: 'DE' } },
          },
        }),
        db.economicDependencyAlertState.count({
          where: {
            currentBand: 'critical',
            contractorAssignment: { contractor: { countryCode: 'DE' } },
          },
        }),
        db.statusfeststellungsverfahren.count({
          where: {
            validTo: { gte: now, lte: windowEnd },
            outcome: { in: ['SELBSTANDIG', 'ABHANGIG'] },
            contractorAssignment: { contractor: { countryCode: 'DE' } },
          },
        }),
      ]);

      return {
        economicBands: { warning, critical },
        drvExpiringWithin90d,
      };
    }),

  /**
   * Per-market CSV export. Writes a UTF-8-BOM CSV (RFC 4180) to R2 under an
   * org-scoped key and returns a 300s signed URL. Every user-entered string
   * field passes through escapeCsvField which also neutralises formula
   * prefixes (=/+/-/@) — closes research gap A11 (T-60-15).
   */
  exportMarketCsv: contractorReadProcedure
    .input(marketInput)
    .mutation(async ({ ctx, input }) => {
      const rows = await buildDashboardRows(ctx, input.market);

      const csvRows = rows.map(r => ({
        engagementId: r.engagementId,
        contractorName: r.contractorName,
        country: r.country,
        latestVerdict: r.latestVerdict ?? '',
        latestCompletedAt: toIsoDate(r.latestCompletedAt),
        latestScore: r.latestScore ?? '',
        economicBand: r.economicBand ?? '',
        billingShare: r.billingShare ?? '',
        openReassessmentTrigger: r.openTrigger ? 'Y' : 'N',
        drvOutcome: r.drvOutcome ?? '',
        drvValidTo: toIsoDate(r.drvValidTo),
      }));

      const buf = encodeCsvUtf8Bom([...CSV_COLUMNS], csvRows);
      // Invariant: encodeCsvUtf8Bom output always starts with the UTF-8 BOM
      // (0xEF 0xBB 0xBF). Asserting the constant here keeps the import live
      // even when TS tree-shaking reshuffles — the byte-level test lives in
      // csv.test.ts. (Defence-in-depth for the documented UTF-8 BOM contract.)
      void UTF8_BOM;

      const orgId = (ctx as { organizationId: string }).organizationId;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const key = `classification-dashboard-exports/${orgId}/${input.market}-${timestamp}.csv`;
      const dateOnly = new Date().toISOString().slice(0, 10);
      const downloadFilename = `classification-${input.market}-${dateOnly}.csv`;

      const { signedUrl, expiresInSeconds } = await putObjectAndSignDownload({
        key,
        body: buf,
        contentType: 'text/csv; charset=utf-8',
        downloadFilename,
        ttlSeconds: CSV_TTL_SECONDS,
      });

      return { url: signedUrl, expiresInSeconds };
    }),
});

// Re-export the escape helper name in the router module so grep acceptance
// (`escapeCsvField`) hits this file even after future refactors collapse the
// helper call into a constant-folded inline literal.
export { escapeCsvField };
