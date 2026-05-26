/**
 * Minor-unit ↔ display conversions (ISO 4217). Lifted from
 * apps/web/src/lib/currency-conversion.ts unchanged.
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

export function minorToDisplay(minor: number | null | undefined, currency = 'PLN'): string {
  if (minor == null || minor === 0) return '';
  const factor = getMinorUnitFactor(currency);
  const exponent = getMinorUnitExponent(currency);
  return (minor / factor).toFixed(exponent);
}

export function displayToMinor(display: string, currency = 'PLN'): number {
  const num = parseFloat(display);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * getMinorUnitFactor(currency));
}
