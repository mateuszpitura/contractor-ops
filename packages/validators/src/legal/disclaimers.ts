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

// Phase 64 · D-16 — Classification advisory banner phrases (LEGAL-03).
// PENDING legal sign-off — see signoff-registry.json.
// Jurisdiction-aware: UK users see the IR35 version, DE users see the Schein version.
export const BANNER_IR35_ADVISORY_EN =
  'This classification result is guidance only and does not constitute legal advice. ' +
  'The determination of IR35 status remains your responsibility as the client. Before ' +
  'acting on this result, consult a qualified UK tax adviser (CIOT or ATT member) to ' +
  'confirm the determination and assess your specific circumstances.';

export const BANNER_SCHEIN_ADVISORY_DE =
  'Dieses Klassifizierungsergebnis ist eine Orientierungshilfe und ersetzt keine ' +
  'Rechtsberatung. Die verbindliche Feststellung des Beschäftigungsstatus obliegt ' +
  'ausschließlich der Deutschen Rentenversicherung im Rahmen des ' +
  'Statusfeststellungsverfahrens (§ 7a SGB IV). Konsultieren Sie vor einer ' +
  'Entscheidung eine qualifizierte Steuerberatung oder ' +
  'Fachanwältin/Fachanwalt für Sozialrecht.';

// Phase 64 · D-23 — SDS approval statement (LEGAL-05).
// PENDING UK tax-adviser sign-off — see signoff-registry.json.
// Displayed in the in-app approval checkbox before SDS generation.
// Snapshot stored in SdsApproval.approvalStatementSnapshot at approval time.
export const SDS_APPROVAL_STATEMENT_EN =
  'I, as the client or authorised representative of the client named on this Status ' +
  'Determination Statement, confirm that I have reviewed this determination and take ' +
  'responsibility for its issuance under Chapter 10 ITEPA 2003. I understand this ' +
  'tool does not constitute legal advice.';

// Phase 64 · D-27 — DRV unverified-entry disclaimer (LEGAL-06).
// PENDING Steuerberater sign-off — see signoff-registry.json.
// Displayed in the DRV Statusfeststellungsverfahren tracking panel when no
// decision letter has been uploaded.
export const DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE =
  'Dieser Eintrag basiert auf manueller Angabe und ist nicht durch den offiziellen ' +
  'DRV-Bescheid verifiziert. Laden Sie den Bescheid der Deutschen Rentenversicherung ' +
  'hoch, um den Eintrag zu verifizieren.';

// Phase 64 · D-29 — Platform "software not legal advice" ToS disclaimers (LEGAL-07).
// PENDING legal sign-off — see signoff-registry.json.
// Embedded in the Terms of Service page for both EN and DE jurisdictions.
export const SOFTWARE_NOT_LEGAL_ADVICE_EN =
  'This platform is software that assists with contractor management tasks. It does ' +
  'not constitute legal advice, tax advice, or professional advice of any kind. ' +
  'Specifically: (1) Classification assessments (IR35 and Scheinselbständigkeit) are ' +
  'guidance tools only — final determinations remain the responsibility of the client ' +
  'organisation and should be confirmed by a qualified UK tax adviser or Steuerberater ' +
  'before being acted upon; (2) E-invoicing generation produces documents in standard ' +
  'formats but does not guarantee compliance with your specific tax obligations — ' +
  'consult a tax adviser for your jurisdiction; (3) Payment file exports format data ' +
  'for submission to payment processors but do not constitute representation that ' +
  'payments will be processed by your bank; (4) Late payment interest calculations ' +
  'follow the statutory formula under the Late Payment of Commercial Debts (Interest) ' +
  'Act 1998 but legal claims remain the responsibility of the user.';

export const SOFTWARE_NOT_LEGAL_ADVICE_DE =
  'Diese Plattform ist eine Software zur Unterstützung des Auftragnehmer-Managements. ' +
  'Sie ersetzt keine Rechts- oder Steuerberatung. Im Einzelnen: (1) ' +
  'Klassifizierungsbewertungen (IR35 und Scheinselbständigkeit) sind ' +
  'Orientierungshilfen — verbindliche Feststellungen obliegen dem Auftraggeber und ' +
  'sollten vor einer Umsetzung von einer qualifizierten Steuerberatung oder ' +
  'Fachanwaltskanzlei für Sozialrecht bestätigt werden; (2) Die ' +
  'E-Rechnungsgenerierung erzeugt Dokumente in Standardformaten, garantiert jedoch ' +
  'keine Erfüllung Ihrer spezifischen steuerrechtlichen Pflichten — konsultieren Sie ' +
  'eine Steuerberatung für Ihre Jurisdiktion; (3) Zahlungsdatei-Exporte ' +
  'formatieren Daten für Zahlungsdienstleister, stellen jedoch keine Garantie für ' +
  'die Verarbeitung durch Ihre Bank dar; (4) Verzugszinsberechnungen folgen der ' +
  'gesetzlichen Formel, die zugrundeliegenden Rechtsansprüche bleiben jedoch ' +
  'Verantwortung des Nutzers.';

export const RESERVED_DISCLAIMER_KEYS = [
  'DISCLAIMER_IR35_BODY',
  'DISCLAIMER_IR35_ACKNOWLEDGEMENT',
  'DISCLAIMER_SCHEIN_BODY',
  'DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT',
  'SDS_DISCLAIMER_EN',
  'DRV_DEFENSE_DISCLAIMER_DE',
  'BANNER_IR35_ADVISORY_EN',
  'BANNER_SCHEIN_ADVISORY_DE',
  'SDS_APPROVAL_STATEMENT_EN',
  'DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE',
  'SOFTWARE_NOT_LEGAL_ADVICE_EN',
  'SOFTWARE_NOT_LEGAL_ADVICE_DE',
] as const;

export const LOCKED_DISCLAIMERS = {
  DISCLAIMER_IR35_BODY,
  DISCLAIMER_IR35_ACKNOWLEDGEMENT,
  DISCLAIMER_SCHEIN_BODY,
  DISCLAIMER_SCHEIN_ACKNOWLEDGEMENT,
  SDS_DISCLAIMER_EN,
  DRV_DEFENSE_DISCLAIMER_DE,
  BANNER_IR35_ADVISORY_EN,
  BANNER_SCHEIN_ADVISORY_DE,
  SDS_APPROVAL_STATEMENT_EN,
  DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE,
  SOFTWARE_NOT_LEGAL_ADVICE_EN,
  SOFTWARE_NOT_LEGAL_ADVICE_DE,
} as const;

export type LockedDisclaimerKey = keyof typeof LOCKED_DISCLAIMERS;
