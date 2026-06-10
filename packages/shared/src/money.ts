/**
 * Shared Money utility wrapping Dinero.js v2.
 * Single source of truth for all monetary operations across the platform.
 *
 * Dinero.js v2 (2.0.2) is the Money utility.
 * All monetary operations pass through this module.
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
// ISO 4217 minor-unit precision
// ---------------------------------------------------------------------------

/**
 * Static fallback for ISO 4217 minor-unit digits, used only when the runtime
 * `Intl` data does not recognise a currency code. Covers the zero- and
 * three-decimal currencies that diverge from the default of 2.
 */
const MINOR_UNIT_DIGITS_FALLBACK: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  CLP: 0,
  ISK: 0,
  HUF: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
};

/**
 * Number of minor-unit digits (the ISO 4217 exponent) for a currency.
 * JPY/KRW = 0, BHD/KWD/OMR/TND = 3, most = 2.
 *
 * Resolved from `Intl.NumberFormat` (authoritative for every ISO code the
 * runtime knows) and falls back to a small static table — then to 2 — for
 * unrecognised codes. Never throws, so it is safe on free-form currency
 * strings coming from the database.
 */
export function minorUnitDigits(currencyCode: string): number {
  try {
    const resolved = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).resolvedOptions();
    if (typeof resolved.maximumFractionDigits === 'number') {
      return resolved.maximumFractionDigits;
    }
  } catch {
    // Unsupported code — fall through to the static table.
  }
  return MINOR_UNIT_DIGITS_FALLBACK[currencyCode] ?? 2;
}

/**
 * Convert an integer minor-unit amount to its major-unit numeric value using
 * the currency's ISO 4217 exponent. Replacement for the hardcoded
 * `amount / 100`, which is wrong for zero- and three-decimal currencies
 * (e.g. JPY would be displayed 100x too small).
 */
export function minorToMajor(amountMinor: number, currencyCode: string): number {
  return amountMinor / 10 ** minorUnitDigits(currencyCode);
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
 * The minor-unit divisor is derived from the currency's ISO 4217 exponent
 * (via {@link minorToMajor}), so zero-decimal currencies such as JPY format
 * correctly instead of 100x too small. `locale` is passed straight through
 * (use `undefined` to defer to the runtime default) and `currency` is
 * required. By default the displayed fraction digits also follow the
 * currency's exponent; pass `fractionDigits` to force a specific min/max.
 *
 * For Dinero-aware formatting, use `formatMoney(d, locale)` instead.
 *
 * @param amount  Minor units (integer) — e.g. 12345 for 123.45.
 * @param currency  ISO 4217 code (e.g. `EUR`, `USD`, `JPY`).
 * @param locale  BCP-47 locale tag or `undefined` to defer to the runtime.
 * @param fractionDigits  Override the min/max fraction digits. Defaults to
 *   the currency's ISO 4217 exponent.
 */
export function formatMinorAsCurrency(
  amount: number,
  currency: string,
  locale?: string,
  fractionDigits?: number,
): string {
  const digits = fractionDigits ?? minorUnitDigits(currency);
  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
  return new Intl.NumberFormat(locale, options).format(minorToMajor(amount, currency));
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export type { Dinero, DineroCurrency };
export { toDecimal, toSnapshot };
