/**
 * Currency formatting utilities.
 *
 * Amounts are stored as integers in the smallest currency unit (minor units per ISO 4217).
 */

/**
 * Format a minor-unit amount to a human-readable string with optional currency suffix.
 *
 * @example formatMinorUnits(10050)       // "100,50"
 * @example formatMinorUnits(10050, "PLN") // "100,50 PLN"
 */
export function formatMinorUnits(minor: number, currency?: string | null): string {
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return currency ? `${formatted} ${currency}` : formatted;
}

/**
 * Format a minor-unit amount with a required currency suffix.
 *
 * @example formatAmount(10050, "PLN") // "100,50 PLN"
 */
export function formatAmount(minor: number, currency: string): string {
  const formatted = new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
  return `${formatted} ${currency}`;
}
