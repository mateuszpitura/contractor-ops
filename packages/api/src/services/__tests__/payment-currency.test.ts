// Wave-0 contract lock for USD-first-class settlement FX.
//
// USD is already a normal ECB currency (stored as EUR->USD), and `convertAmount`
// already short-circuits same-currency to rate 1 and returns null on a missing
// rate. This guard pins that behavior so a later wave cannot regress it into a
// USD=1.0 special-case that would mask a genuinely missing rate (e.g. a holiday
// gap returning 1.0 instead of null).
//
// Assertions:
//   - convertAmount(USD -> USD) returns rate 1 (same-currency short-circuit)
//   - USD <-> EUR uses the stored ECB rate (no special-case)
//   - a missing rate returns null, never a coerced 1.0

import { describe, expect, it } from 'vitest';

import { convertAmount } from '../exchange-rate';

/** Stored EUR->USD rate for the fixture (mirrors the ECB daily feed shape). */
const EUR_USD = 1.0836;

/**
 * Minimal Prisma-shaped stub exposing only `exchangeRate.findFirst`, the single
 * DB call `getRate` makes. `rates` maps a `${base}->${target}` key to a stored
 * rate; an absent key models a missing rate (returns null).
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

describe('convertAmount — USD settlement', () => {
  it('short-circuits USD -> USD to rate 1', async () => {
    const db = makeDbStub({});
    const result = await convertAmount(db, 250_000, 'USD', 'USD');
    expect(result).not.toBeNull();
    expect(result?.rate).toBe(1);
    expect(result?.amountMinor).toBe(250_000);
  });

  it('converts EUR -> USD via the stored ECB rate (no special-case)', async () => {
    const db = makeDbStub({ 'EUR->USD': EUR_USD });
    const result = await convertAmount(db, 100_000, 'EUR', 'USD');
    expect(result).not.toBeNull();
    expect(result?.rate).toBeCloseTo(EUR_USD, 4);
    expect(result?.amountMinor).toBe(Math.round(100_000 * EUR_USD));
  });

  it('converts USD -> EUR through EUR as base', async () => {
    const db = makeDbStub({ 'EUR->USD': EUR_USD });
    const result = await convertAmount(db, 100_000, 'USD', 'EUR');
    expect(result).not.toBeNull();
    expect(result?.amountMinor).toBe(Math.round(100_000 * (1 / EUR_USD)));
  });

  it('returns null when the USD rate is missing (no coerced 1.0)', async () => {
    const db = makeDbStub({});
    const result = await convertAmount(db, 100_000, 'EUR', 'USD');
    expect(result).toBeNull();
  });
});
