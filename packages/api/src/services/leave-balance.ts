// Leave-balance engine — the append-only ledger correctness core.
//
// Balance is Σ signed ledger minutes (ACCRUAL/CARRYOVER positive, DEDUCTION
// negative), never a mutable running total: corrections are reversing ADJUSTMENT
// inserts, so every point-in-time balance is reconstructible for KP/RODO
// evidentiary needs. Statutory entitlement resolves from the compliance-policy
// leave registry and scales by the employment fraction (etat), a partial day
// rounding UP (KP art. 154 §2). A null/unset etat is treated as full-time (1.00)
// with a logged warning — an unfilled fraction must never brick balance math.

import type { Jurisdiction, LeaveKind } from '@contractor-ops/compliance-policy';
import { resolveLeaveAccrual } from '@contractor-ops/compliance-policy';
import { createLogger } from '@contractor-ops/logger';

import type { TxClient } from './approval-engine';

const log = createLogger({ service: 'leave-balance' });

/** Statutory-entitlement day → minutes conversion (8h standard working day). */
export const MINUTES_PER_LEAVE_DAY = 480;

export interface LedgerMinutesRow {
  minutes: number;
}

/** Balance = Σ signed ledger minutes. Pure. */
export function computeLeaveBalance(rows: readonly LedgerMinutesRow[]): number {
  return rows.reduce((sum, row) => sum + row.minutes, 0);
}

export interface EntitlementInput {
  jurisdiction: Jurisdiction;
  leaveKind: LeaveKind;
  tenureYears: number;
  /** Employment fraction; null/undefined = unset → treated as full-time. */
  etat: number | null | undefined;
}

/**
 * Statutory entitlement in minutes for the (jurisdiction, kind, tenure, etat).
 * `round_up(baseEntitlementDays × etat) × MINUTES_PER_LEAVE_DAY`. Returns 0 when
 * the market defines no statutory rule (caller falls back to org policy). Never
 * throws on a null etat.
 */
export function resolveEntitlementMinutes(input: EntitlementInput): number {
  const rule = resolveLeaveAccrual(input.jurisdiction, input.leaveKind);
  if (!rule) return 0;

  const baseDays = rule.baseEntitlementDays({ tenureYears: input.tenureYears });

  let fraction = 1;
  if (rule.proRataByEtat) {
    if (input.etat === null || input.etat === undefined) {
      log.warn(
        { jurisdiction: input.jurisdiction, leaveKind: input.leaveKind },
        'etat unset on a pro-rata jurisdiction — treating as full-time (1.00)',
      );
    } else {
      fraction = input.etat;
    }
  }

  const days = Math.ceil(baseDays * fraction);
  return days * MINUTES_PER_LEAVE_DAY;
}

export interface BalanceCacheKey {
  organizationId: string;
  workerId: string;
  leaveTypeId: string;
  year: number;
}

/**
 * Re-sums the ledger for a (worker, leaveType, year) and refreshes the
 * LeaveBalance cache row in the SAME transaction as the caller's ledger insert.
 * This is the reconciliation oracle: the cache is always Σ ledger, never a
 * drifting counter.
 */
export async function recomputeBalanceCache(
  tx: TxClient,
  key: BalanceCacheKey,
): Promise<{ entitledMinutes: number; usedMinutes: number; carryoverMinutes: number }> {
  const yearStart = new Date(Date.UTC(key.year, 0, 1));
  const yearEnd = new Date(Date.UTC(key.year + 1, 0, 1));

  const rows = await tx.leaveLedgerEntry.findMany({
    where: {
      organizationId: key.organizationId,
      workerId: key.workerId,
      leaveTypeId: key.leaveTypeId,
      effectiveDate: { gte: yearStart, lt: yearEnd },
    },
    select: { entryType: true, minutes: true },
  });

  let entitledMinutes = 0;
  let usedMinutes = 0;
  let carryoverMinutes = 0;
  for (const row of rows) {
    if (row.entryType === 'ACCRUAL' || row.entryType === 'ADJUSTMENT') {
      entitledMinutes += row.minutes;
    } else if (row.entryType === 'CARRYOVER') {
      carryoverMinutes += row.minutes;
    } else if (row.entryType === 'DEDUCTION') {
      // DEDUCTION rows are stored negative; usedMinutes is the positive magnitude.
      usedMinutes += -row.minutes;
    }
  }

  await tx.leaveBalance.upsert({
    where: {
      organizationId_workerId_leaveTypeId_year: {
        organizationId: key.organizationId,
        workerId: key.workerId,
        leaveTypeId: key.leaveTypeId,
        year: key.year,
      },
    },
    create: {
      organizationId: key.organizationId,
      workerId: key.workerId,
      leaveTypeId: key.leaveTypeId,
      year: key.year,
      entitledMinutes,
      usedMinutes,
      carryoverMinutes,
      recomputedAt: new Date(),
    },
    update: { entitledMinutes, usedMinutes, carryoverMinutes, recomputedAt: new Date() },
  });

  return { entitledMinutes, usedMinutes, carryoverMinutes };
}

export interface AccrueAnnualInput {
  organizationId: string;
  workerId: string;
  leaveTypeId: string;
  jurisdiction: Jurisdiction;
  tenureYears: number;
  etat: number | null | undefined;
  year: number;
}

/**
 * Inserts the ANNUAL accrual ledger row for a worker-year and refreshes the
 * balance cache in the same tx. Idempotence is the caller's concern (run once
 * per worker-year); the ledger stays append-only.
 */
export async function accrueAnnual(
  tx: TxClient,
  input: AccrueAnnualInput,
): Promise<{ accruedMinutes: number }> {
  const accruedMinutes = resolveEntitlementMinutes({
    jurisdiction: input.jurisdiction,
    leaveKind: 'ANNUAL',
    tenureYears: input.tenureYears,
    etat: input.etat,
  });

  await tx.leaveLedgerEntry.create({
    data: {
      organizationId: input.organizationId,
      workerId: input.workerId,
      leaveTypeId: input.leaveTypeId,
      entryType: 'ACCRUAL',
      minutes: accruedMinutes,
      effectiveDate: new Date(Date.UTC(input.year, 0, 1)),
      sourceRef: `accrual:${input.year}`,
    },
  });

  await recomputeBalanceCache(tx, {
    organizationId: input.organizationId,
    workerId: input.workerId,
    leaveTypeId: input.leaveTypeId,
    year: input.year,
  });

  return { accruedMinutes };
}

export interface CarryoverInput {
  organizationId: string;
  workerId: string;
  leaveTypeId: string;
  jurisdiction: Jurisdiction;
  /** Unused minutes remaining at the end of `fromYear`. */
  remainingMinutes: number;
  fromYear: number;
}

/**
 * Inserts a CARRYOVER ledger row into the next year, capped at the market's
 * statutory `carryoverPolicy.maxDays`. Returns the actually carried minutes.
 */
export async function applyCarryover(
  tx: TxClient,
  input: CarryoverInput,
): Promise<{ carriedMinutes: number }> {
  const rule = resolveLeaveAccrual(input.jurisdiction, 'ANNUAL');
  const capDays = rule?.carryoverPolicy.maxDays ?? null;
  const capMinutes = capDays === null ? input.remainingMinutes : capDays * MINUTES_PER_LEAVE_DAY;
  const carriedMinutes = Math.max(0, Math.min(input.remainingMinutes, capMinutes));

  if (carriedMinutes > 0) {
    await tx.leaveLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        workerId: input.workerId,
        leaveTypeId: input.leaveTypeId,
        entryType: 'CARRYOVER',
        minutes: carriedMinutes,
        effectiveDate: new Date(Date.UTC(input.fromYear + 1, 0, 1)),
        sourceRef: `carryover:${input.fromYear}->${input.fromYear + 1}`,
      },
    });
    await recomputeBalanceCache(tx, {
      organizationId: input.organizationId,
      workerId: input.workerId,
      leaveTypeId: input.leaveTypeId,
      year: input.fromYear + 1,
    });
  }

  return { carriedMinutes };
}
