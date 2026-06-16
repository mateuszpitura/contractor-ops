// tax-rate.service unit test.
// Owns: pnpm --filter @contractor-ops/api test --run tax-rate.service
//
// Mocks the Prisma client at the call boundary rather than requiring a real
// Prisma test DB + seed helpers. The underlying seed is already unit-tested
// in `packages/db/__tests__/tax-rates.seed.test.ts`.
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
  const prisma = {
    taxRate: { findMany, findFirst },
    withholdingTaxRate: { findFirst: vi.fn() },
  };
  return {
    prisma,
    prismaRaw: prisma,
    withRlsTransactions: <T>(c: T) => c,
    withRlsReads: <T>(c: T) => c,
  };
});

import { prisma } from '@contractor-ops/db';
import { calculateWht, getDefaultRateCode, getTaxRatesForCountry } from '../tax-rate.service';

const mockTaxRate = vi.mocked(prisma.taxRate);
const mockWht = vi.mocked(prisma.withholdingTaxRate);

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

describe('tax-rate.service — calculateWht non-breakage after US treaty rows (US-LOC-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SA org still resolves the SA treaty/standard row unchanged when US rows coexist in the table', async () => {
    // The table now also holds sourceCountry='US' rows. The SA lookup must be
    // unaffected: it queries sourceCountry='SA' and applies the divide-by-100
    // percent contract exactly as before.
    mockWht.findFirst.mockResolvedValueOnce({
      contractorResidency: 'PL',
      serviceType: 'CONSULTING',
      standardRate: 20,
      treatyRate: 5,
      treatyReference: 'Saudi-Poland DTA',
    } as never);

    const result = await calculateWht('SA', 'PL', 'CONSULTING', 100_000);

    expect(result).not.toBeNull();
    expect(result?.whtRate).toBe(5);
    expect(result?.whtAmountMinor).toBe(5_000);
    expect(result?.treatyApplied).toBe(true);

    // The SA lookup is scoped to sourceCountry='SA' — US rows cannot be selected.
    const args = mockWht.findFirst.mock.calls[0]?.[0];
    expect(args?.where?.sourceCountry).toBe('SA');
  });

  it('US org returns null — the SA gate keeps US source-country rows out of the WHT path', async () => {
    const result = await calculateWht('US', 'PL', 'CONSULTING', 100_000);

    expect(result).toBeNull();
    // Gate short-circuits before any DB read — US rows are never queried here.
    expect(mockWht.findFirst).not.toHaveBeenCalled();
  });
});
