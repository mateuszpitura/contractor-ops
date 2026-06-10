import type { DbClient } from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeReconciliation {
  approvedMinutes: number;
  rateValueMinor: number;
  rateType: string;
  hoursPerDay: number;
  expectedAmountMinor: number;
  invoicedAmountMinor: number;
  deviationMinor: number;
  deviationPercent: number;
  withinThreshold: boolean;
  thresholdPercent: number;
}

interface ReconciliationSettings {
  thresholdPercent: number;
  hoursPerDay: number;
}

function readReconciliationSettings(settingsJson: unknown): ReconciliationSettings {
  const settings = (settingsJson as Record<string, unknown>) ?? {};
  return {
    thresholdPercent:
      typeof settings.timeDeviationThresholdPercent === 'number'
        ? settings.timeDeviationThresholdPercent
        : 10,
    hoursPerDay: typeof settings.timeHoursPerDay === 'number' ? settings.timeHoursPerDay : 8,
  };
}

/**
 * Pure reconciliation math shared by the single-invoice and batch paths.
 *
 * Returns null for non-time-based rate types or when no approved minutes exist,
 * mirroring the early-return rules of {@link computeTimeReconciliation}.
 */
function reconcile(
  rateType: string,
  rateValueMinor: number | null,
  approvedMinutes: number,
  invoicedAmountMinor: number,
  settings: ReconciliationSettings,
): TimeReconciliation | null {
  if (!rateValueMinor) return null;
  if (rateType !== 'PER_HOUR' && rateType !== 'PER_DAY') return null;
  if (approvedMinutes === 0) return null;

  let expectedAmountMinor: number;
  if (rateType === 'PER_HOUR') {
    expectedAmountMinor = Math.round((approvedMinutes * rateValueMinor) / 60);
  } else {
    const days = approvedMinutes / (settings.hoursPerDay * 60);
    expectedAmountMinor = Math.round(days * rateValueMinor);
  }

  const deviationMinor = invoicedAmountMinor - expectedAmountMinor;
  const deviationPercent =
    expectedAmountMinor > 0
      ? Math.round((Math.abs(deviationMinor) / expectedAmountMinor) * 10000) / 100
      : 0;
  const withinThreshold = deviationPercent <= settings.thresholdPercent;

  return {
    approvedMinutes,
    rateValueMinor,
    rateType,
    hoursPerDay: settings.hoursPerDay,
    expectedAmountMinor,
    invoicedAmountMinor,
    deviationMinor,
    deviationPercent,
    withinThreshold,
    thresholdPercent: settings.thresholdPercent,
  };
}

// ---------------------------------------------------------------------------
// Reconciliation computation
// ---------------------------------------------------------------------------

/**
 * Computes time-vs-invoice reconciliation for a given contract and period.
 *
 * Only applicable to PER_HOUR and PER_DAY rate types. Returns null for
 * MONTHLY_FIXED, PER_MILESTONE, PER_DELIVERABLE contracts (not time-based),
 * or when no approved time entries exist for the period.
 *
 * Deviation threshold is configurable per-org via settingsJson
 * (timeDeviationThresholdPercent, default 10%).
 */
export async function computeTimeReconciliation(
  db: DbClient,
  organizationId: string,
  contractId: string,
  periodStart: Date,
  periodEnd: Date,
  invoicedAmountMinor: number,
): Promise<TimeReconciliation | null> {
  // 1. Get contract with rateType and rateValueMinor
  const contract = await db.contract.findFirst({
    where: { id: contractId, organizationId },
    select: { rateType: true, rateValueMinor: true },
  });

  if (!contract?.rateValueMinor) return null;

  // Only compute for PER_HOUR and PER_DAY contracts
  // MONTHLY_FIXED: skip (expected = fixed rate regardless of hours)
  // PER_MILESTONE/PER_DELIVERABLE: skip (not time-based)
  if (contract.rateType !== 'PER_HOUR' && contract.rateType !== 'PER_DAY') {
    return null;
  }

  // 2. Sum approved minutes for this contract in the period
  //    Only count entries from APPROVED timesheets
  const approvedEntries = await db.timeEntry.aggregate({
    where: {
      organizationId,
      contractId,
      entryDate: { gte: periodStart, lte: periodEnd },
      timesheet: { status: 'APPROVED' },
    },
    _sum: { minutes: true },
  });

  const approvedMinutes = approvedEntries._sum.minutes ?? 0;
  if (approvedMinutes === 0) return null;

  // 3. Get org threshold setting (default 10%)
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settingsJson: true },
  });
  const settings = readReconciliationSettings(org.settingsJson);

  // 4. Calculate expected amount, deviation and threshold
  return reconcile(
    contract.rateType,
    contract.rateValueMinor,
    approvedMinutes,
    invoicedAmountMinor,
    settings,
  );
}

// ---------------------------------------------------------------------------
// Batch reconciliation (list view)
// ---------------------------------------------------------------------------

/** A single invoice to reconcile, with its already-resolved contract terms. */
export interface ReconciliationBatchItem<T> {
  invoice: T;
  contractId: string;
  rateType: string;
  rateValueMinor: number | null;
  periodStart: Date;
  periodEnd: Date;
  invoicedAmountMinor: number;
}

/** An invoice paired with its computed reconciliation (null when not applicable). */
export interface ReconciliationBatchResult<T> {
  invoice: T;
  reconciliation: TimeReconciliation | null;
}

/**
 * Reconciles a page of invoices against approved time entries using a fixed
 * number of queries regardless of page size: one org-settings read plus one
 * time-entry read spanning every contract/period in the page.
 *
 * Contract terms (rateType, rateValueMinor) are supplied by the caller from the
 * data it already loaded, so no per-invoice contract query is issued. Approved
 * minutes are grouped in memory by contract and entry date so each invoice is
 * scored only against entries falling inside its own service period — identical
 * to the per-invoice {@link computeTimeReconciliation} math.
 */
export async function computeTimeReconciliationBatch<T>(
  db: DbClient,
  organizationId: string,
  invoices: ReconciliationBatchItem<T>[],
): Promise<ReconciliationBatchResult<T>[]> {
  if (invoices.length === 0) return [];

  // Only contracts on time-based rate types can contribute approved minutes.
  const timeBasedContractIds = [
    ...new Set(
      invoices
        .filter(item => item.rateType === 'PER_HOUR' || item.rateType === 'PER_DAY')
        .map(item => item.contractId),
    ),
  ];

  if (timeBasedContractIds.length === 0) {
    return invoices.map(item => ({ invoice: item.invoice, reconciliation: null }));
  }

  const periodStartTimes = invoices.map(item => item.periodStart.getTime());
  const periodEndTimes = invoices.map(item => item.periodEnd.getTime());
  const windowStart = new Date(Math.min(...periodStartTimes));
  const windowEnd = new Date(Math.max(...periodEndTimes));

  const [org, entries] = await Promise.all([
    db.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { settingsJson: true },
    }),
    db.timeEntry.findMany({
      where: {
        organizationId,
        contractId: { in: timeBasedContractIds },
        entryDate: { gte: windowStart, lte: windowEnd },
        timesheet: { status: 'APPROVED' },
      },
      select: { contractId: true, entryDate: true, minutes: true },
    }),
  ]);

  const settings = readReconciliationSettings(org.settingsJson);

  const entriesByContract = new Map<string, { entryTime: number; minutes: number }[]>();
  for (const entry of entries) {
    const bucket = entriesByContract.get(entry.contractId);
    const value = { entryTime: entry.entryDate.getTime(), minutes: entry.minutes };
    if (bucket) {
      bucket.push(value);
    } else {
      entriesByContract.set(entry.contractId, [value]);
    }
  }

  return invoices.map(item => {
    const bucket = entriesByContract.get(item.contractId);
    let approvedMinutes = 0;
    if (bucket) {
      const start = item.periodStart.getTime();
      const end = item.periodEnd.getTime();
      for (const entry of bucket) {
        if (entry.entryTime >= start && entry.entryTime <= end) {
          approvedMinutes += entry.minutes;
        }
      }
    }

    return {
      invoice: item.invoice,
      reconciliation: reconcile(
        item.rateType,
        item.rateValueMinor,
        approvedMinutes,
        item.invoicedAmountMinor,
        settings,
      ),
    };
  });
}
