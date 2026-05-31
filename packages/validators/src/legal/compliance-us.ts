// packages/validators/src/legal/compliance-us.ts
//
// LOCKED COMPL DOC NAMES — US · Phase 73 (D-14, D-15, D-16).
//
// Added beyond the original 5-jurisdiction plan: Phase 75 registered
// `us.ip_assignment@v1` in @contractor-ops/compliance-policy, and the D-17 parity
// guard is data-driven over the FULL `listPolicyRules()` set — so every registered
// jurisdiction (incl. US) needs a locked-name module or the guard fails. Mirrors the
// `ip-clauses-index.ts` six-jurisdiction shape.
//
// Per-locale phrase map: en + pl + de + ar (ar REQUIRED for the i18n:parity guard).
// Entries ship PENDING per Phase 70 D-09; US adviser flips to APPROVED in dedicated PRs.

export const LOCKED_COMPL_NAMES_US = {
  'us.ip_assignment@v1': {
    en: 'US Intellectual Property Assignment',
    pl: 'Przeniesienie praw własności intelektualnej (US)',
    de: 'US Übertragung geistigen Eigentums',
    ar: 'US Intellectual Property Assignment', // TODO ar legal review (Phase 79)
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_US;
void Typecheck;

export const RESERVED_COMPL_KEYS_US = Object.keys(LOCKED_COMPL_NAMES_US) as Array<
  keyof typeof LOCKED_COMPL_NAMES_US
>;

export type LockedComplNameKeyUS = keyof typeof LOCKED_COMPL_NAMES_US;
