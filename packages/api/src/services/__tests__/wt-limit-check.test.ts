// TIME-EMP-02 on-save half: the synchronous per-jurisdiction working-time
// check. A pure function (no DB) that resolves resolveWtLimits(jurisdiction) and
// flags a daily-ceiling / current-week heuristic breach; the true rolling
// weekly average is the daily scan's job. The UK weekly breach is suppressed
// when the worker holds a written opt-out. Wave-0: RED until the service lands.

import { describe, expect, it } from 'vitest';

import { checkWtLimits } from '../wt-limit-check';

describe('checkWtLimits', () => {
  it('flags a PL day over the 8h (480 min) statutory norm', () => {
    const findings = checkWtLimits({
      jurisdiction: 'PL',
      record: { workedMinutes: 540, wtOptOut: false },
      recentWeekMinutes: 540,
    });
    expect(findings.some(f => f.dimension === 'daily' && f.level === 'breach')).toBe(true);
  });

  it('flags a DE day over the 10h (600 min) hard ceiling but not one under it', () => {
    const over = checkWtLimits({
      jurisdiction: 'DE',
      record: { workedMinutes: 660, wtOptOut: false },
      recentWeekMinutes: 660,
    });
    expect(over.some(f => f.dimension === 'daily' && f.level === 'breach')).toBe(true);

    const under = checkWtLimits({
      jurisdiction: 'DE',
      record: { workedMinutes: 570, wtOptOut: false },
      recentWeekMinutes: 570,
    });
    expect(under.some(f => f.dimension === 'daily' && f.level === 'breach')).toBe(false);
  });

  it('flags a UK week over 48h (2880 min) unless the worker has opted out', () => {
    const breach = checkWtLimits({
      jurisdiction: 'UK',
      record: { workedMinutes: 600, wtOptOut: false },
      recentWeekMinutes: 3000,
    });
    expect(breach.some(f => f.dimension === 'weekly' && f.level === 'breach')).toBe(true);

    const optedOut = checkWtLimits({
      jurisdiction: 'UK',
      record: { workedMinutes: 600, wtOptOut: true },
      recentWeekMinutes: 3000,
    });
    expect(optedOut.some(f => f.dimension === 'weekly')).toBe(false);
  });

  it('is pure — returns findings carrying an i18n copy key, not a literal string', () => {
    const findings = checkWtLimits({
      jurisdiction: 'PL',
      record: { workedMinutes: 540, wtOptOut: false },
      recentWeekMinutes: 540,
    });
    expect(findings[0]?.copyKey).toMatch(/\./);
  });
});
