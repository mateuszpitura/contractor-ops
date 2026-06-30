// Settlement-currency resolution + conversion for cross-border payouts.
//
// resolveSettlementCurrency picks the currency a payout settles in: a per-run
// override (e.g. the contractor receives USD) wins, otherwise the contractor's
// own currency. convertForSettlement turns the gross into that currency at the
// payment-date ECB rate by delegating to exchange-rate.convertAmount — same FX
// path the 1099 box-1 conversion uses, so there is no hand-rolled rate math and
// a missing rate surfaces as null rather than a silently zeroed payout.

import { describe, expect, it } from 'vitest';

import { convertForSettlement, resolveSettlementCurrency } from '../payment-settlement';

/** Stored EUR->USD rate for the fixture (mirrors the ECB daily feed shape). */
const EUR_USD = 1.0836;

/**
 * Minimal Prisma-shaped stub exposing only `exchangeRate.findFirst`, the single
 * DB call `getRate` (inside `convertAmount`) makes. An absent key models a
 * missing rate (returns null).
 */
function makeDbStub(rates: Record<string, number>) {
  return {
    exchangeRate: {
      findFirst: async ({ where }: { where: { base: string; target: string } }) => {
        const rate = rates[`${where.base}->${where.target}`];
        if (rate === undefined) return null;
        return { rate, date: new Date('2026-04-11'), source: 'ECB' };
      },
    },
  } as never;
}

describe('resolveSettlementCurrency', () => {
  it('returns the per-run override when set (contractor receives USD)', () => {
    expect(resolveSettlementCurrency({ contractorCurrency: 'PLN', perRunOverride: 'USD' })).toBe(
      'USD',
    );
  });

  it('defaults to the contractor currency when no override is given', () => {
    expect(resolveSettlementCurrency({ contractorCurrency: 'PLN' })).toBe('PLN');
  });

  it('treats a blank/whitespace override as unset and falls back to the contractor currency', () => {
    expect(resolveSettlementCurrency({ contractorCurrency: 'PLN', perRunOverride: '   ' })).toBe(
      'PLN',
    );
  });
});

describe('convertForSettlement', () => {
  const paymentDate = new Date('2026-04-11');

  it('returns the amount unchanged at rate 1 when settling in the source currency', async () => {
    const db = makeDbStub({});
    const result = await convertForSettlement(db, 250_000, 'USD', 'USD', paymentDate);
    expect(result).not.toBeNull();
    expect(result?.rate).toBe(1);
    expect(result?.amountMinor).toBe(250_000);
    expect(result?.rateDate).toEqual(paymentDate);
  });

  it('converts to the settlement currency at the payment-date ECB rate', async () => {
    const db = makeDbStub({ 'EUR->USD': EUR_USD });
    const result = await convertForSettlement(db, 100_000, 'EUR', 'USD', paymentDate);
    expect(result).not.toBeNull();
    expect(result?.amountMinor).toBe(Math.round(100_000 * EUR_USD));
    expect(result?.rateDate).toEqual(paymentDate);
  });

  it('returns null when the settlement rate is missing (no silent zero)', async () => {
    const db = makeDbStub({});
    const result = await convertForSettlement(db, 100_000, 'EUR', 'USD', paymentDate);
    expect(result).toBeNull();
  });
});
