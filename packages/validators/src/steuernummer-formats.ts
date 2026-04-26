// packages/validators/src/steuernummer-formats.ts
//
// Per-Bundesland Steuernummer format lookup.
// Source: https://de.wikipedia.org/wiki/Steuernummer
// Last verified: 2026-04-12 (during Phase 56 research).
// Review cadence: annual Steuerberater re-verification (Finanzamt reorganisations are
// rare but do happen; a Bundesland-level format change would silently invalidate
// legitimate inputs until this table is refreshed).
//
// Format components (informational — not reflected in regex):
//   FF(F)  = BUFA-Nr (Finanzamt area; 2 or 3 digits depending on state)
//   BBB(B) = Bezirksnummer
//   UUUU   = Unterscheidungsnummer
//   P      = Prüfziffer (checksum — not independently validated here; the regex enforces
//            the structural shape only).
//
// The regex for each state accepts both the raw-digit form and the slash-separated
// display form. Consumers that need to normalise input should strip `/` before storage
// (the UI masks the slashes purely for readability).

export type BundeslandCode =
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'SH'
  | 'TH';

export interface SteuernummerFormat {
  code: BundeslandCode;
  germanName: string;
  regex: RegExp;
  example: string;
  length: 10 | 11;
}

export const STEUERNUMMER_FORMATS: readonly SteuernummerFormat[] = [
  {
    code: 'BW',
    germanName: 'Baden-Württemberg',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '93/815/08152',
    length: 10,
  },
  {
    code: 'BY',
    germanName: 'Bayern',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '181/815/08155',
    length: 11,
  },
  {
    code: 'BE',
    germanName: 'Berlin',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '21/815/08150',
    length: 10,
  },
  {
    code: 'BB',
    germanName: 'Brandenburg',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '048/815/08155',
    length: 11,
  },
  {
    code: 'HB',
    germanName: 'Bremen',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '75/815/08152',
    length: 10,
  },
  {
    code: 'HH',
    germanName: 'Hamburg',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '02/815/08156',
    length: 10,
  },
  {
    code: 'HE',
    germanName: 'Hessen',
    regex: /^0\d{2}\/?\d{3}\/?\d{5}$/,
    example: '013/815/08153',
    length: 11,
  },
  {
    code: 'MV',
    germanName: 'Mecklenburg-Vorpommern',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '079/815/08151',
    length: 11,
  },
  {
    code: 'NI',
    germanName: 'Niedersachsen',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '24/815/08151',
    length: 10,
  },
  {
    code: 'NW',
    germanName: 'Nordrhein-Westfalen',
    regex: /^\d{3}\/?\d{4}\/?\d{4}$/,
    example: '133/8150/8159',
    length: 11,
  },
  {
    code: 'RP',
    germanName: 'Rheinland-Pfalz',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '22/815/08154',
    length: 10,
  },
  {
    code: 'SL',
    germanName: 'Saarland',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '10/815/08182',
    length: 10,
  },
  {
    code: 'SN',
    germanName: 'Sachsen',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '201/123/12340',
    length: 11,
  },
  {
    code: 'ST',
    germanName: 'Sachsen-Anhalt',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '101/815/08154',
    length: 11,
  },
  {
    code: 'SH',
    germanName: 'Schleswig-Holstein',
    regex: /^\d{2}\/?\d{3}\/?\d{5}$/,
    example: '29/815/08158',
    length: 10,
  },
  {
    code: 'TH',
    germanName: 'Thüringen',
    regex: /^\d{3}\/?\d{3}\/?\d{5}$/,
    example: '151/815/08156',
    length: 11,
  },
];

/**
 * Look up the full Steuernummer format descriptor for a Bundesland.
 *
 * @throws Error if the code is not a known Bundesland.
 */
export function getSteuernummerFormat(code: BundeslandCode): SteuernummerFormat {
  const found = STEUERNUMMER_FORMATS.find(f => f.code === code);
  if (!found) {
    throw new Error(`Unknown Bundesland: ${code}`);
  }
  return found;
}

/**
 * Convenience accessor for the per-Bundesland Steuernummer regex.
 * Consumed by the DE country-fields Zod schema (see country-fields.ts).
 */
export function getSteuernummerRegex(code: BundeslandCode): RegExp {
  return getSteuernummerFormat(code).regex;
}
