// Phase 57 · Plan 04 Task 4 — tax-rate.service unit test (PAY-02; PAY-04).
// Owns: pnpm --filter @contractor-ops/api test --run tax-rate.service
//
// The original Wave-0 RED scaffold (Plan 57-01 Task 1 Step 7, fallback clause)
// depended on a real Prisma test DB + seed helpers from
// @contractor-ops/test-utils/prisma. Those helpers still do not exist in the
// workspace, so Plan 57-04 Task 4 turns this scaffold GREEN by mocking the
// Prisma client at the call boundary instead. The underlying seed is already
// unit-tested in `packages/db/__tests__/tax-rates.seed.test.ts` (Plan 57-01).
//
// What we assert here is the SERVICE behaviour, not the DB seed:
//   - `getTaxRatesForCountry('GB')` issues a single `taxRate.findMany` with
//     `orderBy: [{isDefault: 'desc'}, {ratePercent: 'desc'}]` + temporal window.
//   - The returned list is mapped into `TaxRateResponse` shape and preserves
//     the Prisma-issued order (default-first by construction).
//   - `getDefaultRateCode` returns the `isDefault: true` row's code for the
//     country as of the supplied date (GB → '20', DE → '19').

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@contractor-ops/db', () => {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  return {
    prisma: {
      taxRate: { findMany, findFirst },
      withholdingTaxRate: { findFirst: vi.fn() },
    },
    withRlsTransactions: <T,>(c: T) => c,
  withRlsReads: <T,>(c: T) => c,
  };
});

import { prisma } from '@contractor-ops/db';
import { getDefaultRateCode, getTaxRatesForCountry } from '../tax-rate.service.js';

const mockTaxRate = vi.mocked(prisma.taxRate);

const GB_SEED = [
  {
    id: 'gb-20',
    countryCode: 'GB',
    code: '20',
    description: 'Standard rate',
    ratePercent: 20,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
  },
  {
    id: 'gb-5',
    countryCode: 'GB',
    code: '5',
    description: 'Reduced rate',
    ratePercent: 5,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
  },
  {
    id: 'gb-0',
    countryCode: 'GB',
    code: '0',
    description: 'Zero rate',
    ratePercent: 0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
  },
  {
    id: 'gb-rc',
    countryCode: 'GB',
    code: 'RC',
    description: 'Reverse charge',
    ratePercent: 0,
    isDefault: false,
    isReverseCharge: true,
    isExempt: false,
  },
];

const DE_SEED = [
  {
    id: 'de-19',
    countryCode: 'DE',
    code: '19',
    description: 'Standard rate',
    ratePercent: 19,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
  },
  {
    id: 'de-7',
    countryCode: 'DE',
    code: '7',
    description: 'Reduced rate',
    ratePercent: 7,
    isDefault: false,
    isReverseCharge: false,
    isExempt: false,
  },
  {
    id: 'de-rc',
    countryCode: 'DE',
    code: 'RC',
    description: 'Reverse charge',
    ratePercent: 0,
    isDefault: false,
    isReverseCharge: true,
    isExempt: false,
  },
  {
    id: 'de-ku',
    countryCode: 'DE',
    code: 'KU',
    description: 'Kleinunternehmer (§ 19 UStG)',
    ratePercent: 0,
    isDefault: false,
    isReverseCharge: false,
    isExempt: true,
  },
];

describe('tax-rate.service — getTaxRatesForCountry (PAY-02, PAY-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns all 4 GB rates ordered isDefault-first — code 20 must be first', async () => {
    mockTaxRate.findMany.mockResolvedValueOnce(GB_SEED);

    const result = await getTaxRatesForCountry('GB');

    // Shape + count
    expect(result).toHaveLength(4);
    // isDefault-first order preserved (code '20' must be at index 0)
    expect(result[0]?.code).toBe('20');
    expect(result[0]?.isDefault).toBe(true);
    // ratePercent is serialised as a number (Decimal → Number)
    expect(typeof result[0]?.ratePercent).toBe('number');
    expect(result[0]?.ratePercent).toBe(20);
    // The `findMany` query carries the correct ordering + temporal window.
    const findManyArgs = mockTaxRate.findMany.mock.calls[0]?.[0];
    expect(findManyArgs?.where?.countryCode).toBe('GB');
    expect(findManyArgs?.orderBy).toEqual([{ isDefault: 'desc' }, { ratePercent: 'desc' }]);
  });

  it('returns the 4 DE rates ordered isDefault-first — code 19 must be first', async () => {
    mockTaxRate.findMany.mockResolvedValueOnce(DE_SEED);

    const result = await getTaxRatesForCountry('DE');

    expect(result).toHaveLength(4);
    expect(result[0]?.code).toBe('19');
    expect(result[0]?.isDefault).toBe(true);
    expect(result.map(r => r.code)).toEqual(['19', '7', 'RC', 'KU']);
  });

  it('returns empty list when the country has no active rates', async () => {
    mockTaxRate.findMany.mockResolvedValueOnce([]);
    const result = await getTaxRatesForCountry('XX');
    expect(result).toEqual([]);
  });
});

describe('tax-rate.service — getDefaultRateCode (PAY-02, PAY-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns GB default code "20"', async () => {
    mockTaxRate.findFirst.mockResolvedValueOnce({ code: '20' });
    const code = await getDefaultRateCode('GB');
    expect(code).toBe('20');
    const args = mockTaxRate.findFirst.mock.calls[0]?.[0];
    expect(args?.where?.countryCode).toBe('GB');
    expect(args?.where?.isDefault).toBe(true);
  });

  it('returns DE default code "19"', async () => {
    mockTaxRate.findFirst.mockResolvedValueOnce({ code: '19' });
    const code = await getDefaultRateCode('DE');
    expect(code).toBe('19');
  });

  it('falls back to zero-rate code when no default row exists (defensive)', async () => {
    mockTaxRate.findFirst
      .mockResolvedValueOnce(null) // no default
      .mockResolvedValueOnce({ code: '0' }); // defensive zero-rate fallback
    const code = await getDefaultRateCode('GB');
    expect(code).toBe('0');
    expect(mockTaxRate.findFirst).toHaveBeenCalledTimes(2);
  });

  it('returns null when no rates exist for the country (no default + no fallback)', async () => {
    mockTaxRate.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const code = await getDefaultRateCode('ZZ');
    expect(code).toBeNull();
  });
});
