// Probation-watchlist derivation for the HR dashboard — pure, DB-free.
//
// Buckets workers whose probation period ends soon into 14/7/0-day bands at the
// TZ start-of-day boundary (the worker's own jurisdiction, resolved from
// countryCode via the same compliance-policy math the doc-expiry widget uses).
// Read-only: the watchlist widget satisfies "auto-surface" without a reminder
// cron in v7.0.

import { daysUntilExpiryInTz } from '@contractor-ops/compliance-policy';
import { tzForCountry } from './hr-dashboard-doc-expiry';

export interface ProbationRow {
  workerId: string;
  probationEndsAt: Date;
  displayName: string;
  countryCode: string;
}

export interface ProbationWatchlistItem {
  workerId: string;
  displayName: string;
  probationEndsAt: Date;
  daysRemaining: number;
}

export interface ProbationWatchlistResult {
  dueToday: ProbationWatchlistItem[];
  dueWithin7: ProbationWatchlistItem[];
  dueWithin14: ProbationWatchlistItem[];
  total: number;
}

/**
 * Partition probation-ending workers into 0 / <=7 / <=14-day buckets. A worker
 * whose probation ends today (or already lapsed) lands in `dueToday`; anyone
 * more than 14 days out is excluded. Pure.
 */
export function deriveProbationWatchlist(
  rows: readonly ProbationRow[],
  now: Date,
): ProbationWatchlistResult {
  const dueToday: ProbationWatchlistItem[] = [];
  const dueWithin7: ProbationWatchlistItem[] = [];
  const dueWithin14: ProbationWatchlistItem[] = [];

  for (const row of rows) {
    const daysRemaining = daysUntilExpiryInTz(
      row.probationEndsAt,
      tzForCountry(row.countryCode),
      now,
    );
    if (daysRemaining > 14) continue;
    const item: ProbationWatchlistItem = {
      workerId: row.workerId,
      displayName: row.displayName,
      probationEndsAt: row.probationEndsAt,
      daysRemaining,
    };
    if (daysRemaining <= 0) dueToday.push(item);
    else if (daysRemaining <= 7) dueWithin7.push(item);
    else dueWithin14.push(item);
  }

  const byDaysAsc = (a: ProbationWatchlistItem, b: ProbationWatchlistItem) =>
    a.daysRemaining - b.daysRemaining;
  dueToday.sort(byDaysAsc);
  dueWithin7.sort(byDaysAsc);
  dueWithin14.sort(byDaysAsc);

  return {
    dueToday,
    dueWithin7,
    dueWithin14,
    total: dueToday.length + dueWithin7.length + dueWithin14.length,
  };
}
