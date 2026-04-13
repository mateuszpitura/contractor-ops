// packages/validators/src/legal/disclaimers.ts
//
// LOCKED BILINGUAL CLASSIFICATION DISCLAIMERS — Phase 58 (D-12).
//
// These canonical disclaimer strings are legally vetted and MUST NOT be
// translated, reflowed, or moved into messages/*.json. The CI guard in
// __tests__/locked-phrases-guard.test.ts enforces absence from translation
// files on every build.

export const DISCLAIMER_IR35_BODY =
  'This tool does not constitute legal advice. The Status Determination Statement (SDS) under ' +
  'Chapter 10 ITEPA 2003 remains your responsibility; HMRC does not recognise third-party tool ' +
  'output as a substitute for reasonable care. Consult a qualified UK tax adviser before acting ' +
  'on this result.';

export const DISCLAIMER_IR35_ACKNOWLEDGEMENT = 'I understand this is not legal advice';

export const DISCLAIMER_SCHEIN_BODY =
  'Dieses Ergebnis ersetzt keine rechtsverbindliche Statusfeststellung nach § 7a SGB IV. ' +
  'Eine abschließende Beurteilung obliegt ausschließlich der Deutschen Rentenversicherung im ' +
  'Rahmen des Statusfeststellungsverfahrens. Konsultieren Sie vor einer Entscheidung eine ' +
  'qualifizierte Steuerberatung oder Fachanwältin/Fachanwalt für Sozialrecht.';

export const DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT =
  'Ich verstehe, dass diese Bewertung keine rechtsverbindliche Statusfeststellung ersetzt.';

// Phase 59 · D-03 — SDS disclaimer on final page.
// PENDING UK tax-adviser sign-off (see Phase 59 Plan 59-01 Task 3 MANUAL-REVIEW checkpoint).
export const SDS_DISCLAIMER_EN =
  'This Status Determination Statement is issued by the client named above under ' +
  'Chapter 10 ITEPA 2003 for the purposes of off-payroll working (IR35). The tooling ' +
  'used to prepare this determination does not constitute legal advice; the client ' +
  'retains responsibility for the determination and for taking reasonable care. ' +
  'Consult a qualified UK tax adviser before acting on this result.';

// Phase 59 · D-18 — DRV defense bundle disclaimer (German).
// PENDING Steuerberater sign-off (see Phase 59 Plan 59-01 Task 3 MANUAL-REVIEW checkpoint).
export const DRV_DEFENSE_DISCLAIMER_DE =
  'Dieses Dokument ersetzt keine rechtsverbindliche Statusfeststellung nach § 7a SGB IV. ' +
  'Es dient ausschließlich der Beweissicherung und Dokumentation gegenüber der Deutschen ' +
  'Rentenversicherung im Rahmen einer Betriebsprüfung. Eine abschließende Beurteilung ' +
  'obliegt der zuständigen Prüfstelle. Konsultieren Sie eine qualifizierte ' +
  'Steuerberatung oder Fachanwältin/Fachanwalt für Sozialrecht.';

export const RESERVED_DISCLAIMER_KEYS = [
  'DISCLAIMER_IR35_BODY',
  'DISCLAIMER_IR35_ACKNOWLEDGEMENT',
  'DISCLAIMER_SCHEIN_BODY',
  'DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT',
  'SDS_DISCLAIMER_EN',
  'DRV_DEFENSE_DISCLAIMER_DE',
] as const;

export const LOCKED_DISCLAIMERS = {
  DISCLAIMER_IR35_BODY,
  DISCLAIMER_IR35_ACKNOWLEDGEMENT,
  DISCLAIMER_SCHEIN_BODY,
  DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT,
  SDS_DISCLAIMER_EN,
  DRV_DEFENSE_DISCLAIMER_DE,
} as const;

export type LockedDisclaimerKey = keyof typeof LOCKED_DISCLAIMERS;
