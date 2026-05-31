// packages/validators/src/legal/compliance-de.ts
//
// LOCKED COMPL DOC NAMES — DE · Phase 73 (D-14, D-15, D-16).
//
// DE legal review = Steuerberater per Standing Constraint.
// Per Phase 70 D-09: entries ship PENDING; flip to APPROVED via dedicated PRs
// each carrying a `legalTicketRef`.
//
// Per-locale phrase map: en + pl + de + ar (ar REQUIRED for the i18n:parity guard;
// interim-mirrors en where no authoritative DE-context Arabic term is at hand).

export const LOCKED_COMPL_NAMES_DE = {
  'de.a1@v1': {
    en: 'A1 certificate (posted-worker statement)',
    pl: 'Zaświadczenie A1 (oświadczenie pracownika delegowanego)',
    de: 'A1-Bescheinigung (Entsendebescheinigung)',
    ar: 'A1 certificate (posted-worker statement)', // TODO ar legal review (Phase 79)
  },
  'de.aufenthaltstitel@v1': {
    en: 'Residence permit (Aufenthaltstitel)',
    pl: 'Zezwolenie na pobyt (Aufenthaltstitel)',
    de: 'Aufenthaltstitel',
    ar: 'تصريح الإقامة (Aufenthaltstitel)', // TODO ar legal review (Phase 79)
  },
  'de.eight_b_estg@v1': {
    en: 'Exemption certificate §48b EStG (Freistellungsbescheinigung)',
    pl: 'Zaświadczenie o zwolnieniu §48b EStG (Freistellungsbescheinigung)',
    de: 'Freistellungsbescheinigung §48b EStG',
    ar: 'Exemption certificate §48b EStG', // TODO ar legal review (Phase 79)
  },
  'de.werkvertrag_ip@v1': {
    en: 'DE Werkvertrag — grant of usage rights',
    pl: 'DE Werkvertrag — udzielenie praw do korzystania',
    de: 'DE Werkvertrag — Einräumung von Nutzungsrechten',
    ar: 'DE Werkvertrag — grant of usage rights', // TODO ar legal review (Phase 79)
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_DE;
void Typecheck;

export const RESERVED_COMPL_KEYS_DE = Object.keys(LOCKED_COMPL_NAMES_DE) as Array<
  keyof typeof LOCKED_COMPL_NAMES_DE
>;

export type LockedComplNameKeyDE = keyof typeof LOCKED_COMPL_NAMES_DE;
