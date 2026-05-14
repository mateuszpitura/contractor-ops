'use client';

import { useLocale } from 'next-intl';
import { useMemo } from 'react';

/**
 * Locale-aware currency formatter — workplan §6.5 (UI-ATELIER-WORKPLAN.md).
 *
 * Returns a `(minor: number, currency: string, opts?) => string` function
 * that formats a minor-unit integer (e.g. 12500 = PLN 125,00) into a
 * locale-specific string. The locale comes from the active next-intl
 * context; the currency is per-amount because invoice/payment data
 * carries its own ISO 4217 code.
 *
 * Replaces the assorted hardcoded `new Intl.NumberFormat('pl-PL'|'en-GB',
 * { currency: 'PLN'|'GBP' })` calls that pre-dated this initiative.
 *
 *   const fmt = useCurrencyFormatter();
 *   <span>{fmt(invoice.totalMinor, invoice.currency)}</span>
 *
 * Returns identical output for identical inputs across SSR + CSR
 * provided the locale is stable per request, which next-intl guarantees.
 */
export function useCurrencyFormatter() {
  const locale = useLocale();

  return useMemo(() => {
    return (minor: number, currency: string, opts?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        ...opts,
      }).format(minor / 100);
  }, [locale]);
}
