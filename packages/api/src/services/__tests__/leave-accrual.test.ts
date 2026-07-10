import { describe, expect, it } from 'vitest';

import { computeTenureYears } from '../leave-accrual';

describe('computeTenureYears', () => {
  it('returns 0 before the first service anniversary', () => {
    const hireDate = new Date(Date.UTC(2024, 6, 15));
    const asOf = new Date(Date.UTC(2025, 0, 1));
    expect(computeTenureYears(hireDate, asOf)).toBe(0);
  });

  it('returns completed full years on/after the anniversary', () => {
    const hireDate = new Date(Date.UTC(2020, 2, 10));
    const asOf = new Date(Date.UTC(2025, 2, 10));
    expect(computeTenureYears(hireDate, asOf)).toBe(5);
  });

  it('never returns negative tenure', () => {
    const hireDate = new Date(Date.UTC(2026, 0, 1));
    const asOf = new Date(Date.UTC(2025, 0, 1));
    expect(computeTenureYears(hireDate, asOf)).toBe(0);
  });
});
