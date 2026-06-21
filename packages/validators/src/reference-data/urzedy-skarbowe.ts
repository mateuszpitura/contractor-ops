// packages/validators/src/reference-data/urzedy-skarbowe.ts
//
// Urzędy skarbowe — 4-digit office codes used on Polish tax filings.
//
// Source: Krajowa Administracja Skarbowa office register.
//
// LOCAL-ONLY / adviser-verify: a representative subset captured as-of the
// version date below, NOT the complete register (~400 offices). List accuracy
// and the as-of date need a Polish tax adviser's sign-off before production. No
// live KAS API — lookups are served from this seeded snapshot only.

export const URZEDY_SKARBOWE_VERSION = '2026-06' as const;
export const URZEDY_SKARBOWE_SOURCE = 'https://www.podatki.gov.pl/urzedy-skarbowe/' as const;

export interface UrzadSkarbowy {
  /** 4-digit office code (kod urzędu skarbowego). */
  code: string;
  /** Human-readable office name. */
  name: string;
}

/**
 * Representative subset of urzędy skarbowe. Seeded for the reference-list
 * picker; not authoritative — adviser-verify before production.
 */
export const URZEDY_SKARBOWE: readonly UrzadSkarbowy[] = [
  { code: '0271', name: 'Pierwszy Urząd Skarbowy w Białymstoku' },
  { code: '0471', name: 'Pierwszy Urząd Skarbowy w Bydgoszczy' },
  { code: '0871', name: 'Pierwszy Urząd Skarbowy w Gdańsku' },
  { code: '1271', name: 'Pierwszy Urząd Skarbowy w Krakowie' },
  { code: '1471', name: 'Pierwszy Urząd Skarbowy w Lublinie' },
  { code: '1671', name: 'Pierwszy Urząd Skarbowy Łódź-Bałuty' },
  { code: '2271', name: 'Pierwszy Urząd Skarbowy w Opolu' },
  { code: '2471', name: 'Pierwszy Urząd Skarbowy w Poznaniu' },
  { code: '2671', name: 'Pierwszy Urząd Skarbowy w Rzeszowie' },
  { code: '1435', name: 'Pierwszy Urząd Skarbowy Warszawa-Śródmieście' },
  { code: '0235', name: 'Pierwszy Urząd Skarbowy we Wrocławiu' },
] as const;
