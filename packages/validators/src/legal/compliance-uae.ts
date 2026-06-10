// packages/validators/src/legal/compliance-uae.ts
//
// LOCKED COMPL DOC NAMES — UAE.
//
// Per-locale phrase map: en + pl + de + ar (ar REQUIRED for the i18n:parity guard;
// authoritative Arabic terms used where well-known — Emirates ID الهوية الإماراتية).
// Entries ship PENDING; UAE adviser flips to APPROVED in dedicated PRs.

export const LOCKED_COMPL_NAMES_UAE = {
  'uae.emirates_id@v1': {
    en: 'Emirates ID',
    pl: 'Emirates ID',
    de: 'Emirates-ID',
    ar: 'الهوية الإماراتية',
  },
  'uae.free_zone_license@v2': {
    en: 'UAE free-zone trade licence',
    pl: 'Licencja handlowa strefy wolnocłowej (UAE)',
    de: 'UAE Freihandelszonen-Gewerbelizenz',
    ar: 'رخصة تجارية للمنطقة الحرة',
  },
  'uae.ip_assignment@v1': {
    en: 'UAE — disposition of economic rights',
    pl: 'UAE — rozporządzenie prawami majątkowymi',
    de: 'UAE — Verfügung über wirtschaftliche Rechte',
    ar: 'UAE — disposition of economic rights', // TODO ar legal review pending
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_UAE;
void Typecheck;

export const RESERVED_COMPL_KEYS_UAE = Object.keys(LOCKED_COMPL_NAMES_UAE) as Array<
  keyof typeof LOCKED_COMPL_NAMES_UAE
>;

export type LockedComplNameKeyUAE = keyof typeof LOCKED_COMPL_NAMES_UAE;
