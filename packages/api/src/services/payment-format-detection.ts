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

/**
 * Available payment export formats.
 *
 * - `SEPA_XML`: pain.001.001.03 SEPA credit transfer (EUR + EU/EEA IBAN)
 * - `SWIFT_XML`: pain.001.001.09 SWIFT international credit transfer
 * - `BANK_FILE`: Polish Elixir type 110 flat file (PLN + PL IBAN)
 * - `CSV`: Generic CSV with org-defined column mapping
 * - `BACS_STD18`: UK BACS Standard 18 Direct Credit fixed-width file (D-04)
 */
export type ExportFormat = 'SEPA_XML' | 'SWIFT_XML' | 'BANK_FILE' | 'CSV' | 'BACS_STD18';

/**
 * Destination identity for routing decisions. UK accounts use sort code +
 * account number (no IBAN); EU accounts use IBAN. Both may be present for a
 * UK account that also has a GB IBAN — in that case BACS_STD18 wins per D-04.
 */
export interface Destination {
  iban: string | null;
  ukSortCodeEncrypted: string | null;
  ukAccountNumberEncrypted: string | null;
}

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
 *
 * Note: this currency+IBAN form does not surface UK account routing; use
 * {@link detectFormatForDestination} when the destination has UK sort
 * code/account fields populated.
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

/**
 * Detect the appropriate payment export format for a destination that may
 * carry either UK sort code + account number OR a SEPA/IBAN identifier.
 *
 * Rules (per D-04):
 * 1. **GBP + UK sort code + UK account number -> BACS_STD18** (checked BEFORE IBAN)
 * 2. PLN + Polish IBAN -> BANK_FILE
 * 3. EUR + EU/EEA IBAN -> SEPA_XML
 * 4. Everything else -> SWIFT_XML
 *
 * The BACS check runs first because a UK payee may carry a GB IBAN AND UK
 * account fields — for GBP transfers BACS Std 18 is preferred over SWIFT.
 */
export function detectFormatForDestination(
  currency: string,
  destination: Destination,
): ExportFormat {
  // 1. GBP + UK sort code + account -> BACS Standard 18 (per D-04)
  if (
    currency === 'GBP' &&
    destination.ukSortCodeEncrypted &&
    destination.ukAccountNumberEncrypted
  ) {
    return 'BACS_STD18';
  }

  // Fallback: legacy IBAN-based routing.
  if (destination.iban) {
    return detectFormat(currency, destination.iban);
  }

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
