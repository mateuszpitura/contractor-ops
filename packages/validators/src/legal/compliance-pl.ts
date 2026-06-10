// packages/validators/src/legal/compliance-pl.ts
//
// LOCKED COMPL DOC NAMES — PL.
//
// Per-locale phrase map: en + pl + de + ar (ar REQUIRED for the i18n:parity guard;
// interim-mirrors en where no authoritative PL-context Arabic term is at hand).
// Entries ship PENDING; PL adviser flips to APPROVED in dedicated PRs.

export const LOCKED_COMPL_NAMES_PL = {
  'pl.zus_a1@v1': {
    en: 'ZUS A1 certificate',
    pl: 'ZUS A1 (zaświadczenie A1 z ZUS)',
    de: 'ZUS-A1-Bescheinigung',
    ar: 'ZUS A1 certificate', // TODO ar legal review pending
  },
  'pl.udt@v1': {
    en: 'UDT certificate (regulated equipment qualification)',
    pl: 'Uprawnienia UDT (Urząd Dozoru Technicznego)',
    de: 'UDT-Bescheinigung',
    ar: 'UDT certificate', // TODO ar legal review pending
  },
  'pl.ip_assignment@v1': {
    en: 'PL — assignment of economic copyright',
    pl: 'PL — Przeniesienie autorskich praw majątkowych',
    de: 'PL — Übertragung wirtschaftlicher Urheberrechte',
    ar: 'PL — assignment of economic copyright', // TODO ar legal review pending
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_PL;
void Typecheck;

export const RESERVED_COMPL_KEYS_PL = Object.keys(LOCKED_COMPL_NAMES_PL) as Array<
  keyof typeof LOCKED_COMPL_NAMES_PL
>;

export type LockedComplNameKeyPL = keyof typeof LOCKED_COMPL_NAMES_PL;
