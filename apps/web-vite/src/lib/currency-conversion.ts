/**
 * Minor-unit ↔ display conversions (ISO 4217). The exponent per currency is
 * resolved by the shared `money` helper, which is authoritative for every ISO
 * code the runtime knows (JPY/KRW = 0, BHD/KWD/OMR/TND = 3, most = 2).
 */

import { minorUnitDigits } from '@contractor-ops/shared';

function getMinorUnitFactor(currency: string): number {
  return 10 ** minorUnitDigits(currency);
}

function getMinorUnitExponent(currency: string): number {
  return minorUnitDigits(currency);
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
