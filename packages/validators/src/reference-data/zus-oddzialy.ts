// packages/validators/src/reference-data/zus-oddzialy.ts
//
// ZUS (Zakład Ubezpieczeń Społecznych) jednostki terenowe — 6-character
// territorial codes used on Polish social-insurance filings.
//
// Source: ZUS kody terytorialne — przepisy.gofin.pl + isap.sejm.gov.pl
//
// LOCAL-ONLY / adviser-verify: this is a representative subset captured as-of
// the version date below, NOT the complete ZUS register (~600 codes). List
// accuracy and the as-of date need a Polish payroll adviser's sign-off before
// production use. There is no live ZUS API by design — lookups are served from
// this seeded snapshot only.

export const ZUS_ODDZIALY_VERSION = '2026-06' as const;
export const ZUS_ODDZIALY_SOURCE =
  'https://www.zus.pl/o-zus/o-nas/struktura-organizacyjna' as const;

export interface ZusOddzial {
  /** 6-character territorial code (kod terytorialny jednostki). */
  code: string;
  /** Human-readable ZUS oddział / inspektorat name. */
  name: string;
}

/**
 * Representative subset of ZUS territorial units (oddziały). Seeded for the
 * reference-list picker; not authoritative — adviser-verify before production.
 */
export const ZUS_ODDZIALY: readonly ZusOddzial[] = [
  { code: '011000', name: 'ZUS Oddział w Białymstoku' },
  { code: '031000', name: 'ZUS Oddział w Bydgoszczy' },
  { code: '071000', name: 'ZUS Oddział w Gdańsku' },
  { code: '081000', name: 'ZUS Oddział w Zabrzu' },
  { code: '131000', name: 'ZUS Oddział w Krakowie' },
  { code: '151000', name: 'ZUS Oddział w Lublinie' },
  { code: '191000', name: 'ZUS Oddział w Łodzi' },
  { code: '231000', name: 'ZUS Oddział w Olsztynie' },
  { code: '251000', name: 'ZUS Oddział w Opolu' },
  { code: '271000', name: 'ZUS Oddział w Poznaniu' },
  { code: '331000', name: 'ZUS Oddział w Rzeszowie' },
  { code: '391000', name: 'ZUS I Oddział w Warszawie' },
  { code: '411000', name: 'ZUS Oddział we Wrocławiu' },
  { code: '451000', name: 'ZUS Oddział w Zielonej Górze' },
] as const;
