/**
 * Convert between minor units (integer) and display strings.
 *
 * ISO 4217 defines minor unit exponents per currency.
 * Most currencies (PLN, EUR, USD) use 2 decimal places (factor 100).
 * Some currencies differ: JPY has 0, BHD/KWD/OMR have 3.
 */

const MINOR_UNIT_EXPONENTS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
};

function getMinorUnitFactor(currency: string): number {
  const exponent = MINOR_UNIT_EXPONENTS[currency] ?? 2;
  return 10 ** exponent;
}

function getMinorUnitExponent(currency: string): number {
  return MINOR_UNIT_EXPONENTS[currency] ?? 2;
}

/** Convert minor units integer to display string (e.g. 10050 -> "100.50" for PLN) */
export function minorToDisplay(minor: number | null | undefined, currency = "PLN"): string {
  if (minor == null || minor === 0) return "";
  const factor = getMinorUnitFactor(currency);
  const exponent = getMinorUnitExponent(currency);
  return (minor / factor).toFixed(exponent);
}

/** Convert display string to minor units integer (e.g. "100.50" -> 10050 for PLN) */
export function displayToMinor(display: string, currency = "PLN"): number {
  const num = parseFloat(display);
  if (isNaN(num)) return 0;
  return Math.round(num * getMinorUnitFactor(currency));
}
