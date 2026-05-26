/**
 * Shared Money utility wrapping Dinero.js v2.
 * Single source of truth for all monetary operations across the platform.
 *
 * Per D-01: Dinero.js v2 (2.0.2) is the Money utility.
 * Per D-02: All monetary operations pass through this module.
 *
 * @module money
 */

import type { Dinero, DineroCurrency } from 'dinero.js';
import { add, allocate, dinero, multiply, subtract, toDecimal, toSnapshot } from 'dinero.js';
import { AED, EUR, GBP, PLN, SAR, USD } from 'dinero.js/currencies';

// ---------------------------------------------------------------------------
// Currency Registry
// ---------------------------------------------------------------------------

/**
 * Supported ISO 4217 currencies mapped by code string.
 * Extend this map when adding new currencies.
 */
const CURRENCY_MAP: Record<string, DineroCurrency<number>> = {
  USD,
  EUR,
  GBP,
  PLN,
  AED,
  SAR,
};

// ---------------------------------------------------------------------------
// Currency Lookup
// ---------------------------------------------------------------------------

/**
 * Look up a Dinero Currency by ISO 4217 code.
 * @throws Error if currency code is not in the supported set.
 */
export function currencyOf(code: string): DineroCurrency<number> {
  const currency = CURRENCY_MAP[code];
  if (!currency) {
    throw new Error(
      `Unsupported currency code: ${code}. Supported: ${Object.keys(CURRENCY_MAP).join(', ')}`,
    );
  }
  return currency;
}

// ---------------------------------------------------------------------------
// Construction / Serialization
// ---------------------------------------------------------------------------

/**
 * Create a Dinero object from an integer minor-unit amount and ISO 4217 code.
 * Primary way to construct Money from DB values (which store integers).
 */
export function fromMinor(amount: number, currencyCode: string): Dinero<number> {
  return dinero({ amount, currency: currencyOf(currencyCode) });
}

/**
 * Extract the integer minor-unit amount from a Dinero object for DB storage.
 */
export function toMinor(d: Dinero<number>): number {
  return toSnapshot(d).amount;
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/**
 * Add two Dinero objects. Throws if currencies differ.
 */
export function addMoney(a: Dinero<number>, b: Dinero<number>): Dinero<number> {
  return add(a, b);
}

/**
 * Subtract b from a. Throws if currencies differ.
 */
export function subtractMoney(a: Dinero<number>, b: Dinero<number>): Dinero<number> {
  return subtract(a, b);
}

/**
 * Multiply a Dinero object by an integer multiplier.
 */
export function multiplyMoney(d: Dinero<number>, multiplier: number): Dinero<number> {
  return multiply(d, multiplier);
}

/**
 * Allocate a Dinero object into parts according to ratios.
 * Example: allocateMoney(total, [1, 1, 1]) splits into 3 equal parts.
 */
export function allocateMoney(d: Dinero<number>, ratios: number[]): Dinero<number>[] {
  return allocate(d, ratios);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a Dinero object as a locale-aware currency string.
 * Uses Intl.NumberFormat for localization.
 */
export function formatMoney(d: Dinero<number>, locale: string = 'en-US'): string {
  return toDecimal(d, ({ value, currency }) => {
    return Number(value).toLocaleString(locale, {
      style: 'currency',
      currency: currency.code as string,
    });
  });
}

/**
 * Convert a minor-unit integer to a decimal string using ISO 4217 exponent.
 * Replacement for hardcoded `(amount / 100).toFixed(2)`.
 * Uses Dinero internally for correctness.
 */
export function minorToDecimalStr(amount: number, currencyCode: string): string {
  const d = fromMinor(amount, currencyCode);
  return toDecimal(d);
}

/**
 * Format a minor-unit integer as a localised currency string.
 *
 * Thin wrapper around `Intl.NumberFormat({ style: 'currency' })` that
 * matches the inline `new Intl.NumberFormat(locale, { style: 'currency',
 * currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)`
 * pattern duplicated across web-vite and landing components.
 *
 * Behaviour is preserved bit-for-bit at every call site that migrates:
 * `locale` is passed straight through (use `undefined` to defer to the
 * runtime default), `currency` is required, and the fraction digit
 * options default to 2/2 (the dominant existing choice). Pass
 * `fractionDigits: undefined` to use the ISO 4217 exponent default.
 *
 * For Dinero-aware formatting that respects each currency's exponent,
 * use `formatMoney(d, locale)` instead.
 *
 * @param amount  Minor units (integer) — e.g. 12345 for 123.45.
 * @param currency  ISO 4217 code (e.g. `EUR`, `USD`).
 * @param locale  BCP-47 locale tag or `undefined` to defer to the runtime.
 * @param fractionDigits  Override the min/max fraction digits. Default `2`.
 */
export function formatMinorAsCurrency(
  amount: number,
  currency: string,
  locale?: string,
  fractionDigits: number | undefined = 2,
): string {
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
  };
  if (fractionDigits !== undefined) {
    options.minimumFractionDigits = fractionDigits;
    options.maximumFractionDigits = fractionDigits;
  }
  return new Intl.NumberFormat(locale, options).format(amount / 100);
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { Dinero, DineroCurrency };
export { toDecimal, toSnapshot };
