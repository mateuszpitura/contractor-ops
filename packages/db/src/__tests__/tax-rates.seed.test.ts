// Phase 57 · Plan 01 — GB + DE TaxRate seed assertions (PAY-02, PAY-04; D-09).
// See .planning/phases/57-government-api-clients/57-01-PLAN.md Task 1.

import { describe, expect, it } from 'vitest';

import { taxRates } from '../../prisma/seed/tax-rates.js';

describe('tax-rates seed — GB + DE (PAY-02, PAY-04)', () => {
  const gbRates = taxRates.filter((r) => r.countryCode === 'GB');
  const deRates = taxRates.filter((r) => r.countryCode === 'DE');

  it('seeds 4 GB rows with codes [20, 5, 0, RC]; code 20 is default; code RC is reverse-charge', () => {
    expect(gbRates).toHaveLength(4);
    const byCode = new Map(gbRates.map((r) => [r.code, r]));
    expect([...byCode.keys()].sort()).toEqual(['0', '20', '5', 'RC']);
    expect(byCode.get('20')?.isDefault).toBe(true);
    expect(byCode.get('RC')?.isReverseCharge).toBe(true);
  });

  it('seeds 4 DE rows with codes [19, 7, RC, KU]; code 19 is default; KU is exempt; RC is reverse-charge', () => {
    expect(deRates).toHaveLength(4);
    const byCode = new Map(deRates.map((r) => [r.code, r]));
    expect([...byCode.keys()].sort()).toEqual(['19', '7', 'KU', 'RC']);
    expect(byCode.get('19')?.isDefault).toBe(true);
    expect(byCode.get('KU')?.isExempt).toBe(true);
    expect(byCode.get('RC')?.isReverseCharge).toBe(true);
  });

  it('every GB + DE row carries a non-null effectiveFrom', () => {
    for (const row of [...gbRates, ...deRates]) {
      expect(row.effectiveFrom, `${row.countryCode}/${row.code} missing effectiveFrom`).toBeInstanceOf(
        Date,
      );
    }
  });

  it('no GB or DE row has both isDefault=true AND isReverseCharge=true', () => {
    for (const row of [...gbRates, ...deRates]) {
      expect(
        row.isDefault && row.isReverseCharge,
        `${row.countryCode}/${row.code} cannot be both default and reverse-charge`,
      ).toBe(false);
    }
  });
});
