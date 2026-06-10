import type { Jurisdiction } from './types.js';

// ---------------------------------------------------------------------------
// Canonical ISO → Jurisdiction map (alpha-2 and alpha-3)
// ---------------------------------------------------------------------------

const ISO_TO_JURISDICTION: Record<string, Jurisdiction> = {
  GBR: 'UK',
  GB: 'UK',
  UK: 'UK',
  DEU: 'DE',
  DE: 'DE',
  POL: 'PL',
  PL: 'PL',
  USA: 'US',
  US: 'US',
  SAU: 'KSA',
  SA: 'KSA',
  KSA: 'KSA',
  ARE: 'UAE',
  AE: 'UAE',
  UAE: 'UAE',
};

/**
 * Maps an ISO country code (alpha-2 or alpha-3) to a compliance jurisdiction.
 */
export function mapIsoToJurisdiction(iso: string): Jurisdiction | null {
  const upper = iso.toUpperCase();
  return ISO_TO_JURISDICTION[upper] ?? null;
}

/**
 * Maps a 2-char contractor/org country code to jurisdiction (classification entry point).
 */
export function mapCountryCodeToJurisdiction(countryCode: string): Jurisdiction | null {
  return mapIsoToJurisdiction(countryCode);
}
