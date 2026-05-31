// packages/validators/src/legal/compliance-ksa.ts
//
// LOCKED COMPL DOC NAMES — KSA · Phase 73 (D-14, D-15, D-16).
//
// Per-locale phrase map: en + pl + de + ar (ar REQUIRED for the i18n:parity guard;
// authoritative Arabic terms used where well-known — Iqama الإقامة). Entries ship
// PENDING per Phase 70 D-09; KSA adviser flips to APPROVED in dedicated PRs.

export const LOCKED_COMPL_NAMES_KSA = {
  'ksa.iqama@v1': {
    en: 'Iqama (Saudi residence permit)',
    pl: 'Iqama (saudyjskie zezwolenie na pobyt)',
    de: 'Iqama (saudische Aufenthaltsgenehmigung)',
    ar: 'الإقامة',
  },
  'ksa.work_permit_qiwa@v1': {
    en: 'Saudi work permit + Qiwa authorisation',
    pl: 'Saudyjskie pozwolenie na pracę + autoryzacja Qiwa',
    de: 'Saudische Arbeitserlaubnis + Qiwa-Autorisierung',
    ar: 'رخصة العمل + تفويض قوى',
  },
  'ksa.ip_assignment@v1': {
    en: 'KSA — transfer of economic rights',
    pl: 'KSA — przeniesienie praw majątkowych',
    de: 'KSA — Übertragung wirtschaftlicher Rechte',
    ar: 'KSA — transfer of economic rights', // TODO ar legal review (Phase 79)
  },
} as const;

const Typecheck: Record<string, { en: string; pl: string; de: string; ar: string }> =
  LOCKED_COMPL_NAMES_KSA;
void Typecheck;

export const RESERVED_COMPL_KEYS_KSA = Object.keys(LOCKED_COMPL_NAMES_KSA) as Array<
  keyof typeof LOCKED_COMPL_NAMES_KSA
>;

export type LockedComplNameKeyKSA = keyof typeof LOCKED_COMPL_NAMES_KSA;
