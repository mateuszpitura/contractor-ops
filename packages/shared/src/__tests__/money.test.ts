import { describe, expect, it } from 'vitest';
import {
  addMoney,
  currencyOf,
  formatMoney,
  fromMinor,
  minorToDecimalStr,
  subtractMoney,
  toMinor,
  toSnapshot,
} from '../money.js';

describe('currencyOf', () => {
  it('returns PLN currency with code PLN and exponent 2', () => {
    const c = currencyOf('PLN');
    expect(c.code).toBe('PLN');
    expect(c.exponent).toBe(2);
  });

  it('throws for unsupported currency code', () => {
    expect(() => currencyOf('INVALID')).toThrow('Unsupported currency code: INVALID');
  });
});

describe('fromMinor / toMinor roundtrip', () => {
  it('PLN: fromMinor(1500) -> toMinor returns 1500', () => {
    const d = fromMinor(1500, 'PLN');
    expect(toMinor(d)).toBe(1500);
  });

  it('EUR: fromMinor(1500) -> toMinor returns 1500', () => {
    const d = fromMinor(1500, 'EUR');
    expect(toMinor(d)).toBe(1500);
  });

  it('AED: fromMinor(500) -> toMinor returns 500', () => {
    const d = fromMinor(500, 'AED');
    expect(toMinor(d)).toBe(500);
  });

  it('SAR: fromMinor(375) -> toMinor returns 375', () => {
    const d = fromMinor(375, 'SAR');
    expect(toMinor(d)).toBe(375);
  });

  it('GBP: fromMinor(999) -> toMinor returns 999', () => {
    const d = fromMinor(999, 'GBP');
    expect(toMinor(d)).toBe(999);
  });
});

describe('fromMinor creates correct Dinero objects', () => {
  it('PLN has amount 1500 and currency PLN', () => {
    const snap = toSnapshot(fromMinor(1500, 'PLN'));
    expect(snap.amount).toBe(1500);
    expect(snap.currency.code).toBe('PLN');
  });

  it('AED has amount 500 and currency AED', () => {
    const snap = toSnapshot(fromMinor(500, 'AED'));
    expect(snap.amount).toBe(500);
    expect(snap.currency.code).toBe('AED');
  });
});

describe('arithmetic', () => {
  it('addMoney: 1000 PLN + 500 PLN = 1500 PLN', () => {
    const a = fromMinor(1000, 'PLN');
    const b = fromMinor(500, 'PLN');
    const result = addMoney(a, b);
    expect(toMinor(result)).toBe(1500);
  });

  it('addMoney: different currencies throws', () => {
    const a = fromMinor(1000, 'PLN');
    const b = fromMinor(500, 'EUR');
    expect(() => addMoney(a, b)).toThrow();
  });

  it('subtractMoney: 1000 EUR - 300 EUR = 700 EUR', () => {
    const a = fromMinor(1000, 'EUR');
    const b = fromMinor(300, 'EUR');
    const result = subtractMoney(a, b);
    expect(toMinor(result)).toBe(700);
  });
});

describe('formatMoney', () => {
  it('formats PLN with pl-PL locale', () => {
    const d = fromMinor(1500, 'PLN');
    const formatted = formatMoney(d, 'pl-PL');
    // Should contain the numeric value "15" in some form
    expect(formatted).toMatch(/15/);
  });

  it('formats AED with en-US locale', () => {
    const d = fromMinor(500, 'AED');
    const formatted = formatMoney(d, 'en-US');
    // Should contain "5" (5.00 AED)
    expect(formatted).toMatch(/5/);
  });
});

describe('minorToDecimalStr', () => {
  it("1500 PLN -> '15.00'", () => {
    expect(minorToDecimalStr(1500, 'PLN')).toBe('15.00');
  });

  it("500 AED -> '5.00'", () => {
    expect(minorToDecimalStr(500, 'AED')).toBe('5.00');
  });

  it("999 GBP -> '9.99'", () => {
    expect(minorToDecimalStr(999, 'GBP')).toBe('9.99');
  });
});
