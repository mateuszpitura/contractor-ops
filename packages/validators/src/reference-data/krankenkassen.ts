// packages/validators/src/reference-data/krankenkassen.ts
//
// German statutory health funds (gesetzliche Krankenkassen) keyed by their
// 8-digit Betriebsnummer.
//
// Source: krankenkasseninfo.de + GKV-Spitzenverband fund register.
//
// LOCAL-ONLY / adviser-verify: a representative subset captured as-of the
// version date below, NOT the complete fund register (~100 funds). List
// accuracy and the as-of date need a German payroll adviser's sign-off before
// production. No live GKV API — lookups are served from this seeded snapshot
// only.

export const KRANKENKASSEN_VERSION = '2026-06' as const;
export const KRANKENKASSEN_SOURCE = 'https://www.krankenkasseninfo.de/' as const;

export interface Krankenkasse {
  /** 8-digit Betriebsnummer of the health fund. */
  betriebsnummer: string;
  /** Fund name. */
  name: string;
}

/**
 * Representative subset of statutory German health funds. Seeded for the
 * reference-list picker; not authoritative — adviser-verify before production.
 */
export const KRANKENKASSEN: readonly Krankenkasse[] = [
  { betriebsnummer: '15027365', name: 'Techniker Krankenkasse' },
  { betriebsnummer: '02091917', name: 'BARMER' },
  { betriebsnummer: '10101011', name: 'DAK-Gesundheit' },
  { betriebsnummer: '85002146', name: 'AOK Bayern' },
  { betriebsnummer: '40024643', name: 'AOK Nordwest' },
  { betriebsnummer: '67603428', name: 'AOK Baden-Württemberg' },
  { betriebsnummer: '07803144', name: 'KKH Kaufmännische Krankenkasse' },
  { betriebsnummer: '20502124', name: 'hkk Handelskrankenkasse' },
  { betriebsnummer: '99301799', name: 'IKK classic' },
  { betriebsnummer: '10520387', name: 'BKK VBU' },
] as const;
