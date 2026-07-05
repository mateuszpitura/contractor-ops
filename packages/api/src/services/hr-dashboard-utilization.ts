// Vacation-utilization derivation for the HR dashboard — pure, DB-free.
//
// Reads the materialized LeaveBalance cache directly (never re-sums the ledger):
// per worker-year, available = entitledMinutes + carryoverMinutes and taken =
// usedMinutes. A worker is flagged under-utilized when they still hold more than
// UNDER_UTILIZATION_UNUSED_DAYS_THRESHOLD unused days AND `now` sits inside the
// year-end window (the "use it or lose it" nudge only matters near year-end).
//
// Balances arrive per (workerId, leaveTypeId, year); this aggregates them per
// (workerId, year) so a worker with several leave types rolls up to one row.

import { MINUTES_PER_LEAVE_DAY } from './leave-balance';

export interface LeaveBalanceRow {
  workerId: string;
  year: number;
  entitledMinutes: number;
  usedMinutes: number;
  carryoverMinutes: number;
}

export interface WorkerUtilization {
  workerId: string;
  year: number;
  takenDays: number;
  entitledDays: number;
  unusedDays: number;
  underUtilized: boolean;
}

export interface VacationUtilizationResult {
  items: WorkerUtilization[];
  underUtilizedCount: number;
}

/** Unused-day count above which a worker is flagged (near year-end only). */
export const UNDER_UTILIZATION_UNUSED_DAYS_THRESHOLD = 10;

/** Trailing window of the calendar year in which under-utilization is surfaced. */
export const YEAR_END_WINDOW_DAYS = 60;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * True when `now` is within the final YEAR_END_WINDOW_DAYS of its calendar year
 * (inclusive of 31 Dec). The under-utilization flag only fires inside this window.
 */
export function isWithinYearEndWindow(now: Date): boolean {
  const yearEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  const daysRemaining = Math.ceil((yearEnd.getTime() - startOfUtcDay(now).getTime()) / MS_PER_DAY);
  return daysRemaining >= 0 && daysRemaining <= YEAR_END_WINDOW_DAYS;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function minutesToDays(minutes: number): number {
  return Math.round((minutes / MINUTES_PER_LEAVE_DAY) * 100) / 100;
}

/**
 * Per worker-year taken/entitled/unused days from the LeaveBalance cache, plus
 * the under-utilization flag. Pure: params in, structured out, no DB, no throws.
 */
export function deriveVacationUtilization(
  balances: readonly LeaveBalanceRow[],
  now: Date,
): VacationUtilizationResult {
  const inWindow = isWithinYearEndWindow(now);

  const byWorkerYear = new Map<
    string,
    { workerId: string; year: number; entitled: number; used: number; carryover: number }
  >();
  for (const b of balances) {
    const key = `${b.workerId}::${b.year}`;
    const agg = byWorkerYear.get(key) ?? {
      workerId: b.workerId,
      year: b.year,
      entitled: 0,
      used: 0,
      carryover: 0,
    };
    agg.entitled += b.entitledMinutes;
    agg.used += b.usedMinutes;
    agg.carryover += b.carryoverMinutes;
    byWorkerYear.set(key, agg);
  }

  const items: WorkerUtilization[] = [];
  for (const agg of byWorkerYear.values()) {
    const availableMinutes = agg.entitled + agg.carryover;
    const unusedMinutes = Math.max(0, availableMinutes - agg.used);
    const unusedDays = minutesToDays(unusedMinutes);
    items.push({
      workerId: agg.workerId,
      year: agg.year,
      takenDays: minutesToDays(agg.used),
      entitledDays: minutesToDays(availableMinutes),
      unusedDays,
      underUtilized: inWindow && unusedDays > UNDER_UTILIZATION_UNUSED_DAYS_THRESHOLD,
    });
  }

  items.sort((a, b) => b.unusedDays - a.unusedDays);

  return { items, underUtilizedCount: items.filter(i => i.underUtilized).length };
}
