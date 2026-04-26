import { describe, expect, it } from 'vitest';
import {
  taxRateCodeSchema,
  taxRateResponseSchema,
  whtCalculationSchema,
  whtServiceTypeEnum,
} from '../tax.js';

// ---------------------------------------------------------------------------
// taxRateCodeSchema
// ---------------------------------------------------------------------------

describe('taxRateCodeSchema', () => {
  it('accepts uppercase code', () => {
    expect(taxRateCodeSchema.safeParse('VAT-STD').success).toBe(true);
  });

  it('accepts lowercase code', () => {
    expect(taxRateCodeSchema.safeParse('vat-std').success).toBe(true);
  });

  it('accepts numeric code', () => {
    expect(taxRateCodeSchema.safeParse('VAT19').success).toBe(true);
  });

  it('rejects code longer than 10 chars', () => {
    expect(taxRateCodeSchema.safeParse('ABCDEFGHIJK').success).toBe(false);
  });

  it('rejects code with spaces', () => {
    expect(taxRateCodeSchema.safeParse('VAT STD').success).toBe(false);
  });

  it('rejects code with special characters', () => {
    expect(taxRateCodeSchema.safeParse('VAT@19').success).toBe(false);
  });

  it('rejects empty string', () => {
    // regex won't match empty string
    expect(taxRateCodeSchema.safeParse('').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// taxRateResponseSchema
// ---------------------------------------------------------------------------

describe('taxRateResponseSchema', () => {
  const valid = {
    id: 'rate-1',
    countryCode: 'DE',
    code: 'VAT-STD',
    description: 'Standard VAT',
    ratePercent: 19,
    isDefault: true,
    isReverseCharge: false,
    isExempt: false,
  };

  it('accepts valid tax rate response', () => {
    expect(taxRateResponseSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects country code not exactly 2 chars', () => {
    expect(taxRateResponseSchema.safeParse({ ...valid, countryCode: 'DEU' }).success).toBe(false);
    expect(taxRateResponseSchema.safeParse({ ...valid, countryCode: 'D' }).success).toBe(false);
  });

  it('rejects missing boolean fields', () => {
    const { isDefault: _, ...partial } = valid;
    expect(taxRateResponseSchema.safeParse(partial).success).toBe(false);
  });

  it('accepts zero rate', () => {
    expect(taxRateResponseSchema.safeParse({ ...valid, ratePercent: 0 }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// whtServiceTypeEnum
// ---------------------------------------------------------------------------

describe('whtServiceTypeEnum', () => {
  it.each([
    'technical_services',
    'management_fees',
    'royalties',
    'rent_equipment',
  ])('accepts %s', val => {
    expect(whtServiceTypeEnum.safeParse(val).success).toBe(true);
  });

  it('rejects unknown service type', () => {
    expect(whtServiceTypeEnum.safeParse('consulting').success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// whtCalculationSchema
// ---------------------------------------------------------------------------

describe('whtCalculationSchema', () => {
  const valid = {
    grossAmountMinor: 100_000,
    whtRate: 15,
    whtAmountMinor: 15_000,
    netAmountMinor: 85_000,
    treatyApplied: true,
    treatyReference: 'DE-SA-2020',
    rateSource: 'treaty' as const,
  };

  it('accepts valid calculation', () => {
    expect(whtCalculationSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts null treaty reference', () => {
    const r = whtCalculationSchema.safeParse({ ...valid, treatyReference: null });
    expect(r.success).toBe(true);
  });

  it('accepts standard rate source', () => {
    const r = whtCalculationSchema.safeParse({
      ...valid,
      treatyApplied: false,
      treatyReference: null,
      rateSource: 'standard',
    });
    expect(r.success).toBe(true);
  });

  it('rejects negative gross amount', () => {
    expect(whtCalculationSchema.safeParse({ ...valid, grossAmountMinor: -1 }).success).toBe(false);
  });

  it('rejects wht rate above 100', () => {
    expect(whtCalculationSchema.safeParse({ ...valid, whtRate: 101 }).success).toBe(false);
  });

  it('rejects negative wht rate', () => {
    expect(whtCalculationSchema.safeParse({ ...valid, whtRate: -1 }).success).toBe(false);
  });

  it('rejects non-integer amounts', () => {
    expect(whtCalculationSchema.safeParse({ ...valid, grossAmountMinor: 100.5 }).success).toBe(
      false,
    );
  });

  it('rejects invalid rate source', () => {
    expect(whtCalculationSchema.safeParse({ ...valid, rateSource: 'custom' }).success).toBe(false);
  });

  it('accepts zero amounts', () => {
    const r = whtCalculationSchema.safeParse({
      ...valid,
      grossAmountMinor: 0,
      whtAmountMinor: 0,
      netAmountMinor: 0,
      whtRate: 0,
    });
    expect(r.success).toBe(true);
  });
});
