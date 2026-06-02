/**
 * Currency formatting. Amounts stored as integers in the smallest currency
 * unit (minor units per ISO 4217). The minor-unit divisor and fraction digits
 * follow each currency's ISO 4217 exponent (via the shared `money` helpers),
 * so zero-decimal currencies such as JPY format correctly. When no currency
 * is supplied, the legacy 2-decimal default is used.
 */

import { minorToMajor, minorUnitDigits } from '@contractor-ops/shared';

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

export function formatAmount(minor: number, currency: string, locale: string = 'en'): string {
  const digits = minorUnitDigits(currency);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(minorToMajor(minor, currency));
  return `${formatted} ${currency}`;
}
