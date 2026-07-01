// packages/validators/src/legal/personnel-file.ts
//
// LOCKED PERSONNEL-FILE (akta osobowe) ADVISER-VERIFY DISCLAIMER.
//
// The retention windows and section structure shown on the personnel-file
// surface are seeded reference data, not adviser-verified statutory periods.
// The erasure result view foots its per-section disposition list with this
// disclaimer so a staff member never reads a retain-until date as a confirmed
// legal fact. The wording is legally load-bearing and MUST NOT be reflowed or
// silently drifted per locale — the CI guard in
// __tests__/locked-phrases-guard.test.ts asserts each locale verbatim. Like the
// AE/SA statutory labels (and unlike the ToS "software not legal advice"
// disclaimers), this is a seeded-data caveat, not a legal sign-off artifact, so
// it carries no signoff-registry entry.

export const PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN =
  'Retention windows shown here are seeded reference data pending jurisdiction ' +
  'legal or tax adviser verification. Confirm exact statutory periods before ' +
  'relying on this for compliance decisions.';

export const PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_DE =
  'Die hier angezeigten Aufbewahrungsfristen sind Referenzdaten und müssen noch ' +
  'von einem Rechts- oder Steuerberater der jeweiligen Rechtsordnung bestätigt ' +
  'werden. Bestätigen Sie die genauen gesetzlichen Fristen, bevor Sie sich für ' +
  'Compliance-Entscheidungen darauf verlassen.';

export const PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_PL =
  'Pokazane tutaj okresy przechowywania to wstępne dane referencyjne wymagające ' +
  'weryfikacji przez radcę prawnego lub doradcę podatkowego właściwej ' +
  'jurysdykcji. Potwierdź dokładne okresy ustawowe, zanim wykorzystasz je do ' +
  'decyzji dotyczących zgodności.';

export const PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_AR =
  'فترات الاحتفاظ المعروضة هنا بيانات مرجعية أولية بانتظار التحقق من مستشار ' +
  'قانوني أو ضريبي مختص بالاختصاص القضائي. تأكّد من الفترات القانونية الدقيقة ' +
  'قبل الاعتماد عليها في قرارات الامتثال.';

/** Identifier names the CI guard forbids as keys in any `messages/*.json` file. */
export const RESERVED_PERSONNEL_FILE_LEGAL_KEYS = [
  'PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN',
  'PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_DE',
  'PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_PL',
  'PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_AR',
] as const;

/** Canonical record of every locked personnel-file phrase, keyed per locale. */
export const LOCKED_PERSONNEL_FILE_PHRASES = {
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_EN,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_DE,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_PL,
  PERSONNEL_FILE_RETENTION_ADVISER_VERIFY_AR,
} as const;

/** Literal-union type of the locked personnel-file phrase identifiers. */
export type LockedPersonnelFilePhraseKey = keyof typeof LOCKED_PERSONNEL_FILE_PHRASES;
