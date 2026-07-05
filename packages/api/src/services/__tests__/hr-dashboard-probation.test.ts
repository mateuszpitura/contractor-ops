import { describe, expect, it } from 'vitest';
import type { ProbationRow } from '../hr-dashboard-probation';
import { deriveProbationWatchlist } from '../hr-dashboard-probation';

const NOW = new Date('2026-06-15T12:00:00Z');

function row(workerId: string, probationEndsAt: Date): ProbationRow {
  return { workerId, probationEndsAt, displayName: `Worker ${workerId}`, countryCode: 'PL' };
}

describe('deriveProbationWatchlist — 14/7/0 buckets at the TZ start-of-day boundary', () => {
  it('partitions workers into dueToday / dueWithin7 / dueWithin14', () => {
    const rows: ProbationRow[] = [
      row('today', new Date('2026-06-15')), // 0 → dueToday
      row('plus5', new Date('2026-06-20')), // 5 → dueWithin7
      row('plus12', new Date('2026-06-27')), // 12 → dueWithin14
      row('plus30', new Date('2026-07-15')), // 30 → excluded
    ];
    const result = deriveProbationWatchlist(rows, NOW);
    expect(result.dueToday.map(i => i.workerId)).toEqual(['today']);
    expect(result.dueWithin7.map(i => i.workerId)).toEqual(['plus5']);
    expect(result.dueWithin14.map(i => i.workerId)).toEqual(['plus12']);
    expect(result.total).toBe(3);
  });

  it('places an already-lapsed probation in dueToday', () => {
    const result = deriveProbationWatchlist([row('past', new Date('2026-06-10'))], NOW);
    expect(result.dueToday.map(i => i.workerId)).toEqual(['past']);
    expect(result.dueToday[0]?.daysRemaining).toBeLessThan(0);
  });

  it('excludes workers more than 14 days out', () => {
    const result = deriveProbationWatchlist([row('far', new Date('2026-07-01'))], NOW);
    expect(result.total).toBe(0);
  });
});
