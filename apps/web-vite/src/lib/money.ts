/**
 * Web-vite money facade — single entry for locale-aware currency display.
 * Delegates to @contractor-ops/shared for ISO 4217 minor-unit correctness.
 */

import { formatMinorAsCurrency, minorToMajor, minorUnitDigits } from '@contractor-ops/shared';

export { minorToMajor, minorUnitDigits };

/**
 * Format minor units as a locale-aware currency string (Intl style: symbol + amount).
 * Prefer this over local `formatAmount` helpers in components.
 */
export function formatMoneyAmount(minor: number, currency: string, locale: string = 'en'): string {
  return formatMinorAsCurrency(minor, currency, locale);
}

/**
 * Format minor units with trailing ISO currency code (legacy staff-app style).
 */
export function formatAmount(minor: number, currency: string, locale: string = 'en'): string {
  const digits = minorUnitDigits(currency);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minorToMajor(minor, currency));
  return `${formatted} ${currency}`;
}

/**
 * Format minor units without a currency code suffix (optional currency for exponent).
 */
export function formatMinorUnits(
  minor: number,
  currency?: string | null,
  locale: string = 'en',
): string {
  const digits = currency ? minorUnitDigits(currency) : 2;
  const major = currency ? minorToMajor(minor, currency) : minor / 100;
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(major);
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Format optional extracted minor amount (intake OCR) as locale currency.
 */
export function formatExtractedTotalMinor(
  amountMinor: unknown,
  currency: string | null,
  locale?: string,
): string | null {
  if (amountMinor === null || amountMinor === undefined) return null;
  const minor = typeof amountMinor === 'string' ? Number(amountMinor) : Number(amountMinor);
  if (!Number.isFinite(minor)) return null;
  const safeCurrency = currency ?? 'EUR';
  try {
    return formatMoneyAmount(minor, safeCurrency, locale);
  } catch {
    return `${minorToMajor(minor, safeCurrency).toFixed(minorUnitDigits(safeCurrency))} ${safeCurrency}`;
  }
}
