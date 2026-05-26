/**
 * Currency formatting. Lifted from apps/web/src/lib/format-currency.ts
 * unchanged. Amounts stored as integers in the smallest currency unit
 * (minor units per ISO 4217).
 */

export function formatMinorUnits(
  minor: number,
  currency?: string | null,
  locale: string = 'en',
): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return currency ? `${formatted} ${currency}` : formatted;
}

export function formatAmount(minor: number, currency: string, locale: string = 'en'): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${formatted} ${currency}`;
}
