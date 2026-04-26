import { describe, expect, it } from 'vitest';
import {
  exchangeRateConvertSchema,
  exchangeRateLatestSchema,
  exchangeRateQuerySchema,
} from '../exchange-rate.js';

// ---------------------------------------------------------------------------
// exchangeRateQuerySchema
// ---------------------------------------------------------------------------

describe('exchangeRateQuerySchema', () => {
  it('accepts valid input with defaults', () => {
    const result = exchangeRateQuerySchema.safeParse({
      target: 'USD',
      dateFrom: '2025-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base).toBe('EUR');
      expect(result.data.target).toBe('USD');
      expect(result.data.dateFrom).toBeInstanceOf(Date);
    }
  });

  it('defaults base to EUR', () => {
    const result = exchangeRateQuerySchema.safeParse({
      target: 'GBP',
      dateFrom: '2025-06-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base).toBe('EUR');
    }
  });

  it('rejects target not length 3', () => {
    expect(
      exchangeRateQuerySchema.safeParse({
        target: 'US',
        dateFrom: '2025-01-01',
      }).success,
    ).toBe(false);

    expect(
      exchangeRateQuerySchema.safeParse({
        target: 'USDD',
        dateFrom: '2025-01-01',
      }).success,
    ).toBe(false);
  });

  it('accepts optional dateTo', () => {
    const withoutDateTo = exchangeRateQuerySchema.safeParse({
      target: 'USD',
      dateFrom: '2025-01-01',
    });
    expect(withoutDateTo.success).toBe(true);
    if (withoutDateTo.success) {
      expect(withoutDateTo.data.dateTo).toBeUndefined();
    }

    const withDateTo = exchangeRateQuerySchema.safeParse({
      target: 'USD',
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
    });
    expect(withDateTo.success).toBe(true);
    if (withDateTo.success) {
      expect(withDateTo.data.dateTo).toBeInstanceOf(Date);
    }
  });
});

// ---------------------------------------------------------------------------
// exchangeRateLatestSchema
// ---------------------------------------------------------------------------

describe('exchangeRateLatestSchema', () => {
  it('accepts valid input', () => {
    const result = exchangeRateLatestSchema.safeParse({
      target: 'PLN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.base).toBe('EUR');
      expect(result.data.target).toBe('PLN');
    }
  });

  it('rejects base not length 3', () => {
    expect(
      exchangeRateLatestSchema.safeParse({
        base: 'EU',
        target: 'USD',
      }).success,
    ).toBe(false);

    expect(
      exchangeRateLatestSchema.safeParse({
        base: 'EURO',
        target: 'USD',
      }).success,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// exchangeRateConvertSchema
// ---------------------------------------------------------------------------

describe('exchangeRateConvertSchema', () => {
  it('accepts valid input', () => {
    const result = exchangeRateConvertSchema.safeParse({
      amountMinor: 10000,
      from: 'EUR',
      to: 'USD',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amountMinor).toBe(10000);
      expect(result.data.from).toBe('EUR');
      expect(result.data.to).toBe('USD');
      expect(result.data.date).toBeUndefined();
    }
  });

  it('rejects non-integer amountMinor', () => {
    expect(
      exchangeRateConvertSchema.safeParse({
        amountMinor: 100.5,
        from: 'EUR',
        to: 'USD',
      }).success,
    ).toBe(false);
  });

  it('rejects from not length 3', () => {
    expect(
      exchangeRateConvertSchema.safeParse({
        amountMinor: 100,
        from: 'EU',
        to: 'USD',
      }).success,
    ).toBe(false);

    expect(
      exchangeRateConvertSchema.safeParse({
        amountMinor: 100,
        from: 'EURO',
        to: 'USD',
      }).success,
    ).toBe(false);
  });

  it('accepts optional date', () => {
    const withoutDate = exchangeRateConvertSchema.safeParse({
      amountMinor: 5000,
      from: 'GBP',
      to: 'PLN',
    });
    expect(withoutDate.success).toBe(true);
    if (withoutDate.success) {
      expect(withoutDate.data.date).toBeUndefined();
    }

    const withDate = exchangeRateConvertSchema.safeParse({
      amountMinor: 5000,
      from: 'GBP',
      to: 'PLN',
      date: '2025-06-15',
    });
    expect(withDate.success).toBe(true);
    if (withDate.success) {
      expect(withDate.data.date).toBeInstanceOf(Date);
    }
  });
});
