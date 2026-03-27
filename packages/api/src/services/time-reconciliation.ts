// Loosely typed PrismaClient for parallel execution compatibility (precedent: Phase 16, 18)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaClient = any;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeReconciliation {
  approvedMinutes: number;
  rateValueGrosze: number;
  rateType: string;
  hoursPerDay: number;
  expectedAmountGrosze: number;
  invoicedAmountGrosze: number;
  deviationGrosze: number;
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
  prisma: PrismaClient,
  organizationId: string,
  contractId: string,
  periodStart: Date,
  periodEnd: Date,
  invoicedAmountGrosze: number,
): Promise<TimeReconciliation | null> {
  // 1. Get contract with rateType and rateValueGrosze
  const contract = await prisma.contract.findFirst({
    where: { id: contractId, organizationId },
    select: { rateType: true, rateValueGrosze: true },
  });

  if (!contract || !contract.rateValueGrosze) return null;

  // Only compute for PER_HOUR and PER_DAY contracts
  // MONTHLY_FIXED: skip (expected = fixed rate regardless of hours)
  // PER_MILESTONE/PER_DELIVERABLE: skip (not time-based)
  if (contract.rateType !== "PER_HOUR" && contract.rateType !== "PER_DAY") {
    return null;
  }

  // 2. Sum approved minutes for this contract in the period
  //    Only count entries from APPROVED timesheets
  const approvedEntries = await prisma.timeEntry.aggregate({
    where: {
      organizationId,
      contractId,
      entryDate: { gte: periodStart, lte: periodEnd },
      timesheet: { status: "APPROVED" },
    },
    _sum: { minutes: true },
  });

  const approvedMinutes = approvedEntries._sum.minutes ?? 0;
  if (approvedMinutes === 0) return null;

  // 3. Get org threshold setting (default 10% per D-14)
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { settingsJson: true },
  });
  const settings = (org.settingsJson as Record<string, unknown>) ?? {};
  const thresholdPercent =
    typeof settings.timeDeviationThresholdPercent === "number"
      ? settings.timeDeviationThresholdPercent
      : 10;
  const hoursPerDay =
    typeof settings.timeHoursPerDay === "number"
      ? settings.timeHoursPerDay
      : 8;

  // 4. Calculate expected amount
  //    PER_HOUR: (minutes * rateGrosze) / 60
  //    PER_DAY: (minutes / (hoursPerDay * 60)) * rateGrosze
  let expectedAmountGrosze: number;
  if (contract.rateType === "PER_HOUR") {
    expectedAmountGrosze = Math.round(
      (approvedMinutes * contract.rateValueGrosze) / 60,
    );
  } else {
    // PER_DAY
    const days = approvedMinutes / (hoursPerDay * 60);
    expectedAmountGrosze = Math.round(days * contract.rateValueGrosze);
  }

  // 5. Calculate deviation
  const deviationGrosze = invoicedAmountGrosze - expectedAmountGrosze;
  const deviationPercent =
    expectedAmountGrosze > 0
      ? Math.round(
          (Math.abs(deviationGrosze) / expectedAmountGrosze) * 10000,
        ) / 100
      : 0;
  const withinThreshold = deviationPercent <= thresholdPercent;

  return {
    approvedMinutes,
    rateValueGrosze: contract.rateValueGrosze,
    rateType: contract.rateType,
    hoursPerDay,
    expectedAmountGrosze,
    invoicedAmountGrosze,
    deviationGrosze,
    deviationPercent,
    withinThreshold,
    thresholdPercent,
  };
}
