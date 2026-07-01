/**
 * Payment format auto-detection — routes payments to SEPA, SWIFT, or domestic format
 * based on currency and IBAN country code.
 *
 * Payment run picks format based on currency/destination.
 */

import type { ExportItem } from './payment-export';

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
 * - `BACS_STD18`: UK BACS Standard 18 Direct Credit fixed-width file
 * - `ACH_NACHA`: US ACH NACHA fixed-width credit file (USD + US bank)
 * - `FEDWIRE`: US high-value wire as an ISO 20022 pacs.008 XML (above the
 *   Same-Day ACH ceiling)
 */
export type ExportFormat =
  | 'SEPA_XML'
  | 'SWIFT_XML'
  | 'BANK_FILE'
  | 'CSV'
  | 'BACS_STD18'
  | 'ACH_NACHA'
  | 'FEDWIRE';

// ---------------------------------------------------------------------------
// Same-Day ACH ceiling (config, not a constant inside detect)
// ---------------------------------------------------------------------------

/** Same-Day ACH per-payment ceiling in cents, in effect until 2027-09-17: $1,000,000.00. */
export const SAME_DAY_ACH_CEILING_MINOR_CURRENT = 1_000_000_00;

/** Same-Day ACH per-payment ceiling in cents from 2027-09-17: $10,000,000.00. */
export const SAME_DAY_ACH_CEILING_MINOR_2027 = 10_000_000_00;

/** The date the Same-Day ACH ceiling rises from $1M to $10M. */
export const SAME_DAY_ACH_CEILING_EFFECTIVE_2027 = new Date('2027-09-17T00:00:00Z');

/**
 * Resolve the Same-Day ACH per-payment ceiling (in cents) in effect on a given
 * date. Above this ceiling a US payout routes to Fedwire rather than ACH. The
 * ceiling is a moving config value ($1M now, $10M from 2027-09-17) — never a
 * constant baked into the routing rule.
 */
export function sameDayAchCeilingMinor(asOf: Date = new Date()): number {
  return asOf >= SAME_DAY_ACH_CEILING_EFFECTIVE_2027
    ? SAME_DAY_ACH_CEILING_MINOR_2027
    : SAME_DAY_ACH_CEILING_MINOR_CURRENT;
}

/**
 * Destination identity for routing decisions. UK accounts use sort code +
 * account number (no IBAN); EU accounts use IBAN. Both may be present for a
 * UK account that also has a GB IBAN — in that case BACS_STD18 wins.
 *
 * The US routing/account signals are optional so callers that only know an
 * IBAN or UK pair keep constructing a valid destination without them; when both
 * are present the destination is treated as a US bank for USD routing.
 */
export interface Destination {
  iban: string | null;
  ukSortCodeEncrypted: string | null;
  ukAccountNumberEncrypted: string | null;
  usRoutingNumberEncrypted?: string | null;
  usAccountNumberEncrypted?: string | null;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Detect the appropriate payment export format for a single item.
 *
 * Rules:
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
 * carry UK sort code + account number, US routing + account number, OR a
 * SEPA/IBAN identifier.
 *
 * Rules (in precedence order):
 * 1. **GBP + UK sort code + UK account number -> BACS_STD18** (checked BEFORE US/IBAN)
 * 2. **USD + US routing + US account -> ACH_NACHA / FEDWIRE** (by the Same-Day ACH ceiling)
 * 3. PLN + Polish IBAN -> BANK_FILE
 * 4. EUR + EU/EEA IBAN -> SEPA_XML
 * 5. Everything else -> SWIFT_XML
 *
 * The BACS check runs first because a UK payee may carry a GB IBAN AND UK
 * account fields — for GBP transfers BACS Std 18 is preferred over SWIFT.
 *
 * The US branch is entered ONLY when a defined `amountMinor` is supplied: the
 * ACH-vs-Fedwire rail is chosen by comparing the payout amount against the
 * Same-Day ACH ceiling, so without an amount there is no way to pick a rail. A
 * caller that omits the amount therefore falls straight through to the IBAN
 * fallback rather than silently defaulting a US destination to ACH.
 */
export function detectFormatForDestination(
  currency: string,
  destination: Destination,
  options?: { amountMinor?: number; asOf?: Date; sameDayCeilingMinor?: number },
): ExportFormat {
  // 1. GBP + UK sort code + account -> BACS Standard 18
  if (
    currency === 'GBP' &&
    destination.ukSortCodeEncrypted &&
    destination.ukAccountNumberEncrypted
  ) {
    return 'BACS_STD18';
  }

  // 2. USD + US bank -> ACH_NACHA / FEDWIRE, but only when the amount is known
  // (the rail is chosen against the Same-Day ACH ceiling).
  if (options?.amountMinor !== undefined) {
    const isUsBank = Boolean(
      destination.usRoutingNumberEncrypted && destination.usAccountNumberEncrypted,
    );
    const ceiling = options.sameDayCeilingMinor ?? sameDayAchCeilingMinor(options.asOf);
    const usFormat = detectUsFormat(currency, isUsBank, options.amountMinor, ceiling);
    if (usFormat !== null) return usFormat;
  }

  // 3. Fallback: legacy IBAN-based routing.
  if (destination.iban) {
    return detectFormat(currency, destination.iban);
  }

  return 'SWIFT_XML';
}

/**
 * Detect the US export format for a USD payout to a US bank account.
 *
 * Returns `null` for anything that is not a USD payout to a US bank (the caller
 * falls back to the SEPA/SWIFT routing). Otherwise a payout at or below the
 * Same-Day ACH per-payment ceiling routes to `ACH_NACHA`; a payout above it
 * routes to `FEDWIRE`.
 *
 * The ceiling is supplied by the caller (from {@link sameDayAchCeilingMinor}) so
 * the moving $1M→$10M threshold stays a config value rather than a constant
 * baked into this rule.
 */
export function detectUsFormat(
  currency: string,
  isUsBank: boolean,
  amountMinor: number,
  sameDayCeilingMinor: number,
): ExportFormat | null {
  if (currency !== 'USD' || !isUsBank) return null;
  return amountMinor > sameDayCeilingMinor ? 'FEDWIRE' : 'ACH_NACHA';
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group payment items by their detected export format.
 * Returns a map of format -> items for batch generation.
 *
 * US-aware: an item carrying decrypted US routing + account is routed to
 * ACH_NACHA / FEDWIRE by the Same-Day ACH ceiling (resolved from `asOf`);
 * every other item falls back to the currency + IBAN detection.
 */
export function groupItemsByFormat(
  items: ExportItem[],
  asOf: Date = new Date(),
): Map<ExportFormat, ExportItem[]> {
  const groups = new Map<ExportFormat, ExportItem[]>();
  const ceiling = sameDayAchCeilingMinor(asOf);

  for (const item of items) {
    const isUsBank = Boolean(item.usRoutingNumber && item.usAccountNumber);
    const usFormat = detectUsFormat(item.currency, isUsBank, item.amountMinor, ceiling);
    const format = usFormat ?? detectFormat(item.currency, item.iban);
    const existing = groups.get(format) ?? [];
    existing.push(item);
    groups.set(format, existing);
  }

  return groups;
}
