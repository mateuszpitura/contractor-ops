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

  // 3. Get org threshold setting (default 10% per D-14)
  const org = await db.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settingsJson: true },
  });
  const settings = (org.settingsJson as Record<string, unknown>) ?? {};
  const thresholdPercent =
    typeof settings.timeDeviationThresholdPercent === 'number'
      ? settings.timeDeviationThresholdPercent
      : 10;
  const hoursPerDay = typeof settings.timeHoursPerDay === 'number' ? settings.timeHoursPerDay : 8;

  // 4. Calculate expected amount
  //    PER_HOUR: (minutes * rateMinor) / 60
  //    PER_DAY: (minutes / (hoursPerDay * 60)) * rateMinor
  let expectedAmountMinor: number;
  if (contract.rateType === 'PER_HOUR') {
    expectedAmountMinor = Math.round((approvedMinutes * contract.rateValueMinor) / 60);
  } else {
    // PER_DAY
    const days = approvedMinutes / (hoursPerDay * 60);
    expectedAmountMinor = Math.round(days * contract.rateValueMinor);
  }

  // 5. Calculate deviation
  const deviationMinor = invoicedAmountMinor - expectedAmountMinor;
  const deviationPercent =
    expectedAmountMinor > 0
      ? Math.round((Math.abs(deviationMinor) / expectedAmountMinor) * 10000) / 100
      : 0;
  const withinThreshold = deviationPercent <= thresholdPercent;

  return {
    approvedMinutes,
    rateValueMinor: contract.rateValueMinor,
    rateType: contract.rateType,
    hoursPerDay,
    expectedAmountMinor,
    invoicedAmountMinor,
    deviationMinor,
    deviationPercent,
    withinThreshold,
    thresholdPercent,
  };
}
