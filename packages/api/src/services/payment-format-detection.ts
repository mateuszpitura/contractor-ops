/**
 * Payment format auto-detection — routes payments to SEPA, SWIFT, or domestic format
 * based on currency and IBAN country code.
 *
 * Per D-03: payment run picks format based on currency/destination.
 */

import type { ExportItem } from './payment-export.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * EU and EEA IBAN country codes eligible for SEPA transfers.
 * 27 EU member states + 3 EEA (Iceland, Liechtenstein, Norway).
 */
export const EU_IBAN_COUNTRIES = new Set([
  // EU-27
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  // EEA
  'IS',
  'LI',
  'NO',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'SEPA_XML' | 'SWIFT_XML' | 'BANK_FILE' | 'CSV';

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect the appropriate payment export format for a single item.
 *
 * Rules (per D-03):
 * 1. PLN + Polish IBAN -> BANK_FILE (Elixir domestic)
 * 2. EUR + EU/EEA IBAN -> SEPA_XML
 * 3. Everything else -> SWIFT_XML (international)
 */
export function detectFormat(currency: string, iban: string): ExportFormat {
  const ibanCountry = iban.replace(/\s/g, '').substring(0, 2).toUpperCase();

  // Polish domestic: PLN + PL IBAN
  if (currency === 'PLN' && ibanCountry === 'PL') {
    return 'BANK_FILE';
  }

  // SEPA: EUR + EU/EEA country
  if (currency === 'EUR' && EU_IBAN_COUNTRIES.has(ibanCountry)) {
    return 'SEPA_XML';
  }

  // Everything else: SWIFT international
  return 'SWIFT_XML';
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group payment items by their detected export format.
 * Returns a map of format -> items for batch generation.
 */
export function groupItemsByFormat(items: ExportItem[]): Map<ExportFormat, ExportItem[]> {
  const groups = new Map<ExportFormat, ExportItem[]>();

  for (const item of items) {
    const format = detectFormat(item.currency, item.iban);
    const existing = groups.get(format) ?? [];
    existing.push(item);
    groups.set(format, existing);
  }

  return groups;
}
