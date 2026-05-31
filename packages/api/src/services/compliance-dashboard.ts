// ---------------------------------------------------------------------------
// Phase 73 · COMPL-01 — Admin dashboard query helpers (D-01..D-05).
// ---------------------------------------------------------------------------
//
// All item helpers use the composite index `@@index([organizationId, severity,
// status, expiresAt])` introduced by Plan 73-02. No N+1: each helper issues
// exactly ONE compliance-item query (the blocked-payments helper additionally
// reads the live payment-gate source + the 7-day historical check table).
//
// Signature pattern: `(db, organizationId, ...)` — accepts a tenant-scoped
// Prisma client OR a transaction client. Mirrors the Phase 71/72 service-module
// shape (compliance-supersession.ts / compliance-payment-gate.ts).

import type { Prisma } from '@contractor-ops/db';
import { createLogger } from '@contractor-ops/logger';
import type { ContractorReason } from './compliance-payment-gate.js';
import { assertContractorPaymentEligibility } from './compliance-payment-gate.js';

/**
 * Structural client interface — works with the full PrismaClient, a `tx` from
 * `$transaction`, AND the tenant-scoped extended client. Loose `Promise<unknown>`
 * returns avoid the deep-generic instantiation that the concrete Prisma client
 * union triggers. Mirrors compliance-payment-gate.ts PaymentGateClient.
 */
interface DashboardClient {
  contractorComplianceItem: {
    findMany: (args: Prisma.ContractorComplianceItemFindManyArgs) => Promise<unknown>;
    count: (args: Prisma.ContractorComplianceItemCountArgs) => Promise<number>;
  };
  paymentRun: {
    findMany: (args: Prisma.PaymentRunFindManyArgs) => Promise<unknown>;
  };
  paymentRunComplianceCheck: {
    findMany: (args: Prisma.PaymentRunComplianceCheckFindManyArgs) => Promise<unknown>;
  };
}

type Db = DashboardClient;

const log = createLogger({ service: 'compliance-dashboard' });

const AT_RISK_LOOKAHEAD_DAYS = 30;
const UPCOMING_RENEWALS_LOOKAHEAD_DAYS = 90;
const BLOCKED_PAYMENTS_HISTORY_DAYS = 7;

/** Returns `from + days` (days may be negative). Avoids a date-fns dependency in the API package. */
function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

const DASHBOARD_ITEM_SELECT = {
  id: true,
  name: true,
  documentType: true,
  status: true,
  severity: true,
  expiresAt: true,
  policyRuleId: true,
  contractorId: true,
  contractor: { select: { id: true, legalName: true, displayName: true } },
} as const;

export interface DashboardItem {
  id: string;
  name: string;
  documentType: string;
  status: string;
  severity: string | null;
  expiresAt: Date | null;
  policyRuleId: string | null;
  contractorId: string;
  contractor: { id: string; legalName: string; displayName: string } | null;
}

export type AtRiskItem = DashboardItem;
export type UpcomingRenewalItem = DashboardItem;

export interface BlockedPaymentItem {
  contractorId: string;
  contractorName: string;
  reasons: ContractorReason['reasons'];
  source: 'live' | 'historical';
  latestEvidenceAt: Date;
  paymentRunId?: string;
}

// ---------------------------------------------------------------------------
// At risk (D-02)
// ---------------------------------------------------------------------------

/**
 * "At risk" semantics:
 *   severity = 'BLOCKING' AND status != 'WAIVED' AND
 *   (status IN ('MISSING','EXPIRED') OR
 *    (status = 'SATISFIED' AND expiresAt <= now() + 30d))
 */
function atRiskWhere(organizationId: string): Prisma.ContractorComplianceItemWhereInput {
  const lookahead = addDays(new Date(), AT_RISK_LOOKAHEAD_DAYS);
  return {
    organizationId,
    severity: 'BLOCKING',
    NOT: { status: 'WAIVED' },
    OR: [
      { status: { in: ['MISSING', 'EXPIRED'] } },
      { AND: [{ status: 'SATISFIED' }, { expiresAt: { lte: lookahead } }] },
    ],
  };
}

/** Count distinct contractors with at least one BLOCKING + at-risk item. */
export async function countAtRiskContractors(db: Db, organizationId: string): Promise<number> {
  const distinct = (await db.contractorComplianceItem.findMany({
    where: atRiskWhere(organizationId),
    select: { contractorId: true },
    distinct: ['contractorId'],
  })) as Array<{ contractorId: string }>;
  return distinct.length;
}

export async function listAtRiskItems(db: Db, organizationId: string): Promise<AtRiskItem[]> {
  return (await db.contractorComplianceItem.findMany({
    where: atRiskWhere(organizationId),
    select: DASHBOARD_ITEM_SELECT,
    orderBy: [{ status: 'desc' }, { expiresAt: 'asc' }],
    take: 200,
  })) as AtRiskItem[];
}

// ---------------------------------------------------------------------------
// Upcoming renewals (D-03)
// ---------------------------------------------------------------------------

function upcomingRenewalsWhere(organizationId: string): Prisma.ContractorComplianceItemWhereInput {
  const lookahead = addDays(new Date(), UPCOMING_RENEWALS_LOOKAHEAD_DAYS);
  return {
    organizationId,
    severity: 'BLOCKING',
    status: 'SATISFIED',
    expiresAt: { lte: lookahead, gte: new Date() },
  };
}

export async function countUpcomingRenewals(db: Db, organizationId: string): Promise<number> {
  return db.contractorComplianceItem.count({ where: upcomingRenewalsWhere(organizationId) });
}

export async function listUpcomingRenewals(
  db: Db,
  organizationId: string,
): Promise<UpcomingRenewalItem[]> {
  return (await db.contractorComplianceItem.findMany({
    where: upcomingRenewalsWhere(organizationId),
    select: DASHBOARD_ITEM_SELECT,
    orderBy: { expiresAt: 'asc' },
    take: 200,
  })) as UpcomingRenewalItem[];
}

// ---------------------------------------------------------------------------
// Blocked payments (D-04, D-05)
// ---------------------------------------------------------------------------

/**
 * Merges live + historical sources, deduped by contractorId (live wins).
 *
 * Live source: re-runs `assertContractorPaymentEligibility` over all DRAFT
 * PaymentRun contractors with `throwOnFail: false` — catches "this run will
 * fail on Export" before the admin hits it.
 *
 * Historical source: `PaymentRunComplianceCheck` rows with FAIL verdict in the
 * last 7 days — catches recent failed export attempts.
 */
export async function listBlockedPayments(
  db: Db,
  organizationId: string,
): Promise<BlockedPaymentItem[]> {
  // Live source — distinct contractorIds across DRAFT runs.
  const draftRuns = (await db.paymentRun.findMany({
    where: { organizationId, status: 'DRAFT' },
    select: { id: true, items: { select: { contractorId: true } } },
  })) as Array<{ id: string; items: Array<{ contractorId: string }> }>;
  const liveContractorIds = Array.from(
    new Set(draftRuns.flatMap(run => run.items.map(item => item.contractorId))),
  );

  let liveReasons: ContractorReason[] = [];
  if (liveContractorIds.length > 0) {
    try {
      const result = await assertContractorPaymentEligibility(liveContractorIds, {
        tx: db as never,
        throwOnFail: false,
        organizationId,
      });
      liveReasons = result.contractorReasons;
    } catch (err) {
      // Graceful degradation — the dashboard must never 500 on the live probe.
      log.warn(
        { event: 'compliance.dashboard.live_source_unavailable', err: String(err) },
        'live blocked-payments source unavailable; falling back to historical only',
      );
    }
  }

  // Historical source — last 7 days of FAIL verdicts.
  const historyCutoff = addDays(new Date(), -BLOCKED_PAYMENTS_HISTORY_DAYS);
  const historicalChecks = (await db.paymentRunComplianceCheck.findMany({
    where: {
      organizationId,
      eligibilityVerdict: 'FAIL',
      snapshottedAt: { gte: historyCutoff },
    },
    select: { contractorId: true, paymentRunId: true, snapshottedAt: true, snapshotJson: true },
    orderBy: { snapshottedAt: 'desc' },
  })) as Array<{
    contractorId: string;
    paymentRunId: string;
    snapshottedAt: Date;
    snapshotJson: unknown;
  }>;

  // Dedup by contractorId — admin sees ONE row per contractor; live wins.
  const seen = new Set<string>();
  const out: BlockedPaymentItem[] = [];

  for (const reason of liveReasons) {
    if (seen.has(reason.contractorId)) continue;
    seen.add(reason.contractorId);
    out.push({
      contractorId: reason.contractorId,
      contractorName: reason.contractorName,
      reasons: reason.reasons,
      source: 'live',
      latestEvidenceAt: new Date(),
    });
  }

  for (const check of historicalChecks) {
    if (seen.has(check.contractorId)) continue;
    seen.add(check.contractorId);
    out.push({
      contractorId: check.contractorId,
      contractorName: '', // caller may join the contractor name if needed for display
      reasons: extractReasonsFromSnapshot(check.snapshotJson),
      source: 'historical',
      latestEvidenceAt: check.snapshottedAt,
      paymentRunId: check.paymentRunId,
    });
  }

  return out;
}

function extractReasonsFromSnapshot(snapshot: unknown): ContractorReason['reasons'] {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const reasons = (snapshot as Record<string, unknown>).reasons;
  return Array.isArray(reasons) ? (reasons as ContractorReason['reasons']) : [];
}
