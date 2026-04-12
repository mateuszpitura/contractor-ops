/**
 * Currency formatting utilities.
 *
 * Amounts are stored as integers in the smallest currency unit (minor units per ISO 4217).
 */

/**
 * Format a minor-unit amount to a human-readable string with optional currency suffix.
 *
 * @param minor  Amount in minor units (e.g. 10050 = 100.50)
 * @param currency  Optional ISO 4217 currency code to append
 * @param locale  BCP 47 locale tag for number formatting (default: "en")
 *
 * @example formatMinorUnits(10050)              // "100.50"
 * @example formatMinorUnits(10050, "PLN", "pl") // "100,50 PLN"
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

/**
 * Format a minor-unit amount with a required currency suffix.
 *
 * @param minor  Amount in minor units (e.g. 10050 = 100.50)
 * @param currency  ISO 4217 currency code to append
 * @param locale  BCP 47 locale tag for number formatting (default: "en")
 *
 * @example formatAmount(10050, "PLN", "pl") // "100,50 PLN"
 */
export function formatAmount(minor: number, currency: string, locale: string = 'en'): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${formatted} ${currency}`;
}
