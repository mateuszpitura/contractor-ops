// packages/api/src/services/late-payment-interest.ts
//
// LPCDA-compliant late payment interest calculation.
// Pure functions — no DB access; callers provide all data.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structural type for rate values. Mirrors `BoeRateRow.ratePercent` from
 * `boe-rate-cache.ts` so callers can pass Prisma `Decimal` instances, plain
 * numbers, or numeric strings without a hard import dependency on
 * `@prisma/client-runtime-utils`.
 */
type RateValue = number | { toNumber(): number } | string;

export interface RateHistoryEntry {
  effectiveFrom: Date;
  ratePercent: RateValue;
}

export interface InvoicePaymentEntry {
  amountMinor: number;
  paidAt: Date;
}

export interface WaiverEntry {
  waiveType: 'STATUTORY_INTEREST' | 'COMPENSATION' | 'BOTH';
  revokedAt: Date | null;
}

export interface LateInterestInput {
  invoiceTotalMinor: number;
  invoiceDueDate: Date;
  currency: string;
  contractorCountryCode: string | null;
  isBusinessCustomer: boolean;
  rateHistory: RateHistoryEntry[];
  payments: InvoicePaymentEntry[];
  waivers: WaiverEntry[];
  compensationTierMinor: number | null;
  paidAt: Date | null;
  asOf?: Date;
}

export interface LateInterestResult {
  applicable: boolean;
  reason?: string;
  daysOverdue: number;
  principalOutstandingMinor: number;
  rateUsed: number;
  dailyInterestMinor: number;
  accruedInterestMinor: number;
  compensationTierMinor: number;
  totalClaimMinor: number;
  waiverApplied: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * LPCDA §5A fixed compensation tiers (in pence).
 *   < £1,000 (< 100_000 pence) → £40 (4_000)
 *   £1,000–£9,999.99 (100_000–999_999) → £70 (7_000)
 *   ≥ £10,000 (≥ 1_000_000) → £100 (10_000)
 */
export function getCompensationTier(invoiceTotalMinor: number): number {
  if (invoiceTotalMinor < 100_000) return 4_000;
  if (invoiceTotalMinor < 1_000_000) return 7_000;
  return 10_000;
}

/**
 * Resolve the BoE base rate in effect on the last day of the preceding
 * 6-month statutory period per LPCDA §4(1).
 *
 * Reference dates: 30 Jun or 31 Dec preceding the debt period start.
 *
 * Returns `null` when no rate is in effect on the reference date (empty history,
 * or every entry postdates it) — the caller must treat that as "cannot compute"
 * rather than assuming a 0% base, which would silently accrue interest at the
 * bare 8% margin.
 */
export function resolveStatutoryRate(
  rateHistory: RateHistoryEntry[],
  debtPeriodStart: Date,
): number | null {
  // Determine the reference date (last day of the preceding 6-month period)
  const year = debtPeriodStart.getFullYear();
  const month = debtPeriodStart.getMonth(); // 0-indexed

  let referenceDate: Date;
  if (month < 6) {
    // Jan–Jun → previous 31 Dec
    referenceDate = new Date(Date.UTC(year - 1, 11, 31));
  } else {
    // Jul–Dec → 30 Jun of same year
    referenceDate = new Date(Date.UTC(year, 5, 30));
  }

  // Find the rate in effect on the reference date
  // Sort descending by effectiveFrom
  const sorted = [...rateHistory].sort(
    (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime(),
  );

  for (const entry of sorted) {
    const effectiveFrom = new Date(entry.effectiveFrom);
    if (effectiveFrom.getTime() <= referenceDate.getTime()) {
      return Number(entry.ratePercent);
    }
  }

  // No rate in effect on the reference date — cannot determine the statutory base.
  return null;
}

// ---------------------------------------------------------------------------
// Main calculation
// ---------------------------------------------------------------------------

/**
 * Calculate late payment interest per the Late Payment of Commercial Debts
 * (Interest) Act 1998.
 *
 * Interest = principal × (BoE rate + 8%) / 100 / 365 × days overdue
 * Simple interest, not compound.
 */
export function calculateLateInterest(input: LateInterestInput): LateInterestResult {
  const {
    invoiceTotalMinor,
    invoiceDueDate,
    currency,
    contractorCountryCode,
    isBusinessCustomer,
    rateHistory,
    payments,
    waivers,
    compensationTierMinor,
    paidAt,
    asOf,
  } = input;

  const now = asOf ?? new Date();

  // Scope gates
  if (contractorCountryCode !== 'GB') {
    return {
      applicable: false,
      reason: 'NON_GB_INVOICE',
      daysOverdue: 0,
      principalOutstandingMinor: 0,
      rateUsed: 0,
      dailyInterestMinor: 0,
      accruedInterestMinor: 0,
      compensationTierMinor: 0,
      totalClaimMinor: 0,
      waiverApplied: false,
    };
  }

  if (!isBusinessCustomer) {
    return {
      applicable: false,
      reason: 'B2C_TRANSACTION',
      daysOverdue: 0,
      principalOutstandingMinor: 0,
      rateUsed: 0,
      dailyInterestMinor: 0,
      accruedInterestMinor: 0,
      compensationTierMinor: 0,
      totalClaimMinor: 0,
      waiverApplied: false,
    };
  }

  if (currency !== 'GBP') {
    return {
      applicable: false,
      reason: 'NON_GBP_CURRENCY',
      daysOverdue: 0,
      principalOutstandingMinor: 0,
      rateUsed: 0,
      dailyInterestMinor: 0,
      accruedInterestMinor: 0,
      compensationTierMinor: 0,
      totalClaimMinor: 0,
      waiverApplied: false,
    };
  }

  // Calculate due date + 1 (interest starts the day after due date)
  const dueDateMs = new Date(invoiceDueDate).getTime();
  const overdueStartMs = dueDateMs + 24 * 60 * 60 * 1000;
  const endDateMs = paidAt ? new Date(paidAt).getTime() : now.getTime();

  // Cover the entire grace period (up to but not including overdueStartMs)
  // so the post-guard daysOverdue formula can never return a negative value
  // when endDateMs lands inside the same calendar day as dueDateMs. The pre-fix
  // guard (`endDateMs <= dueDateMs`) was a strict subset of this range — for
  // @db.Date columns at midnight UTC the boundary `endDateMs == overdueStartMs`
  // (= dueDate + 24h) now correctly falls THROUGH to the formula and yields
  // daysOverdue=0 (no full overdue day elapsed yet).
  if (endDateMs < overdueStartMs) {
    return {
      applicable: true,
      daysOverdue: 0,
      principalOutstandingMinor: invoiceTotalMinor,
      rateUsed: 0,
      dailyInterestMinor: 0,
      accruedInterestMinor: 0,
      compensationTierMinor: compensationTierMinor ?? 0,
      totalClaimMinor: 0,
      waiverApplied: false,
    };
  }

  // LPCDA Section 4(1): interest accrues from the day AFTER due date
  // (overdueStartMs). daysOverdue counts the number of full days that have
  // ELAPSED since overdueStartMs — partial days don't accrue a full day's
  // interest. DO NOT revert to (endDateMs - dueDateMs) — that overstates by
  // one day because it counts the grace-period day (= dueDate itself) as overdue.
  const daysOverdue = Math.floor((endDateMs - overdueStartMs) / (24 * 60 * 60 * 1000));

  // Calculate principal outstanding (invoice total - sum of payments)
  const totalPaid = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  const principalOutstandingMinor = Math.max(0, invoiceTotalMinor - totalPaid);

  // Resolve the statutory rate
  const debtPeriodStart = new Date(overdueStartMs);
  const boeRate = resolveStatutoryRate(rateHistory, debtPeriodStart);

  // Missing rate history → cannot determine the BoE base for this period. Fail
  // loudly (not applicable) rather than accruing interest at the bare 8% margin.
  if (boeRate === null) {
    return {
      applicable: false,
      reason: 'RATE_HISTORY_UNAVAILABLE',
      daysOverdue,
      principalOutstandingMinor,
      rateUsed: 0,
      dailyInterestMinor: 0,
      accruedInterestMinor: 0,
      compensationTierMinor: 0,
      totalClaimMinor: 0,
      waiverApplied: false,
    };
  }

  const statutoryRate = boeRate + 8; // BoE rate + 8 percentage points

  // Daily interest = principal × (rate / 100) / 365
  const dailyInterest = (principalOutstandingMinor * statutoryRate) / 100 / 365;
  const dailyInterestMinor = Math.round(dailyInterest);

  // Total accrued = daily × days
  // Money-rounding policy (see wiki/patterns/money-rounding): statutory interest rounds
  // HALF-UP on the final accrued claim (compute-then-round, per EU Late Payment Directive / §288 BGB).
  const accruedInterest = dailyInterest * daysOverdue;
  const accruedInterestMinor = Math.round(accruedInterest);

  // Check for active waivers
  const activeWaivers = waivers.filter(w => w.revokedAt === null);
  const interestWaived = activeWaivers.some(
    w => w.waiveType === 'STATUTORY_INTEREST' || w.waiveType === 'BOTH',
  );
  const compensationWaived = activeWaivers.some(
    w => w.waiveType === 'COMPENSATION' || w.waiveType === 'BOTH',
  );
  const waiverApplied = interestWaived || compensationWaived;

  const effectiveInterest = interestWaived ? 0 : accruedInterestMinor;
  const effectiveCompensation = compensationWaived ? 0 : (compensationTierMinor ?? 0);

  return {
    applicable: true,
    daysOverdue,
    principalOutstandingMinor,
    rateUsed: statutoryRate,
    dailyInterestMinor: interestWaived ? 0 : dailyInterestMinor,
    accruedInterestMinor: effectiveInterest,
    compensationTierMinor: effectiveCompensation,
    totalClaimMinor: effectiveInterest + effectiveCompensation,
    waiverApplied,
  };
}
