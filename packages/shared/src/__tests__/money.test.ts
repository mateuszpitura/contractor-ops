import { describe, expect, it } from 'vitest';
import {
  addMoney,
  currencyOf,
  formatMinorAsCurrency,
  formatMoney,
  fromMinor,
  minorToDecimalStr,
  minorToMajor,
  minorUnitDigits,
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

describe('formatMinorAsCurrency', () => {
  it('formats EUR with de-DE locale and default 2/2 fraction digits', () => {
    // Avoid asserting on raw Unicode space/separator variants across ICU
    // versions — assert the digit grouping and decimal sign instead.
    const out = formatMinorAsCurrency(123456, 'EUR', 'de-DE');
    expect(out).toMatch(/1\.234,56/);
    expect(out).toMatch(/€/);
  });

  it('formats USD with en-US locale, default 2 fraction digits, with $ symbol', () => {
    const out = formatMinorAsCurrency(123456, 'USD', 'en-US');
    expect(out).toBe('$1,234.56');
  });

  it('falls back to runtime default locale when locale is undefined', () => {
    // Just confirm a non-empty string comes back and the value is recognisable
    // (decimal or comma separator, depending on runtime locale).
    const out = formatMinorAsCurrency(100, 'USD');
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/1[.,]00/);
  });

  it('honours custom fractionDigits when provided', () => {
    expect(formatMinorAsCurrency(123456, 'USD', 'en-US', 0)).toBe('$1,235');
  });

  it('defaults to the currency ISO 4217 exponent when fractionDigits is undefined', () => {
    // Passing `undefined` defers to the currency's own exponent (USD = 2).
    expect(formatMinorAsCurrency(123456, 'USD', 'en-US', undefined)).toBe('$1,234.56');
  });

  it('formats JPY (zero-decimal) without a 100x error', () => {
    // JPY has no minor units: 123456 minor === ¥123,456, not ¥1,234.56.
    expect(formatMinorAsCurrency(123456, 'JPY', 'en-US')).toBe('¥123,456');
  });
});

describe('minorUnitDigits', () => {
  it('returns 2 for the common two-decimal currencies', () => {
    for (const code of ['USD', 'EUR', 'GBP', 'PLN', 'AED', 'SAR']) {
      expect(minorUnitDigits(code)).toBe(2);
    }
  });

  it('returns 0 for zero-decimal currencies', () => {
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('KRW')).toBe(0);
  });

  it('returns 3 for three-decimal currencies', () => {
    for (const code of ['BHD', 'KWD', 'OMR', 'TND']) {
      expect(minorUnitDigits(code)).toBe(3);
    }
  });

  it('falls back to 2 for an unknown code without throwing', () => {
    expect(minorUnitDigits('ZZZ')).toBe(2);
  });
});

describe('minorToMajor', () => {
  it('divides by 100 for two-decimal currencies', () => {
    expect(minorToMajor(123456, 'EUR')).toBe(1234.56);
  });

  it('does not divide for zero-decimal currencies', () => {
    expect(minorToMajor(123456, 'JPY')).toBe(123456);
  });

  it('divides by 1000 for three-decimal currencies', () => {
    expect(minorToMajor(123456, 'KWD')).toBe(123.456);
  });
});
