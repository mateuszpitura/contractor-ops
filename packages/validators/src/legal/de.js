// packages/validators/src/legal/de.ts
//
// LOCKED GERMAN LEGAL PHRASES — Phase 56 (FOUND-04; D-05, D-06, D-07)
// and Phase 58 (D-07, CLASS-* classification rule set).
//
// SCOPE: GDPR notice phrasing + profile/onboarding tax labels + classification
// criteria titles. Invoice phrases are locked in Phase 61/62 when those
// documents are generated (D-07).
//
// DO NOT add any of these identifiers as keys in messages/*.json —
// the CI guard in __tests__/locked-phrases-guard.test.ts will fail the build.
//
// DO NOT translate these strings or move them into a translation file.
// They are legally vetted canonical forms (BfDI-aligned, DSGVO Art. 13/14;
// UStG § 19; DRV Katalog § 7 SGB IV). Steuerberater review tracked in
// STATE.md Blockers (D-13).
export const GDPR_CONTROLLER_LABEL = 'Verantwortlicher im Sinne der DSGVO';
export const GDPR_RIGHTS_HEADING = 'Ihre Rechte als betroffene Person';
export const GDPR_DPO_LABEL = 'Datenschutzbeauftragter';
export const GDPR_COMPLAINT_HEADING = 'Beschwerderecht bei der Aufsichtsbehörde';
export const TAX_USTIDNR_LABEL = 'Umsatzsteuer-Identifikationsnummer (USt-IdNr)';
export const TAX_STEUERNUMMER_LABEL = 'Steuernummer';
export const TAX_HANDELSREGISTER_LABEL = 'Handelsregisternummer';
export const TAX_SOZIALVERSICHERUNGSNUMMER_LABEL = 'Sozialversicherungsnummer';
export const TAX_KLEINUNTERNEHMER_LABEL = 'Kleinunternehmer gemäß § 19 UStG';
// Phase 57 (D-11, D-14) — invoice-footer tax notices.
export const TAX_KLEINUNTERNEHMER_NOTICE = 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen';
export const TAX_STEUERSCHULDNERSCHAFT = 'Steuerschuldnerschaft des Leistungsempfängers';
// --- Phase 58 additions (D-07) ----------------------------------------------
// Locked German legal phrases for classification. Never mirror these in
// messages/*.json — the CI guard in __tests__/locked-phrases-guard.test.ts
// enforces absence.
// See .planning/phases/58-classification-engine-rule-sets/58-UI-SPEC.md
// §Copywriting Contract → Locked German phrases.
export const CLASSIFICATION_SCHEIN_TITLE = 'Scheinselbständigkeit';
export const CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL = 'Statusfeststellungsverfahren';
export const CLASSIFICATION_SCHEIN_CRITERIA_LABEL = 'Wesentliche Merkmale der Selbstständigkeit';
export const CLASSIFICATION_SCHEIN_INTEGRATION = 'Eingliederung in die Arbeitsorganisation';
export const CLASSIFICATION_SCHEIN_ENTREPRENEURIAL = 'Unternehmerische Selbstständigkeit';
export const CLASSIFICATION_SCHEIN_PERSONAL_DEP = 'Persönliche Abhängigkeit';
export const CLASSIFICATION_SCHEIN_ECONOMIC_DEP = 'Wirtschaftliche Abhängigkeit';
export const CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL = 'Hinweis der Deutschen Rentenversicherung';
export const CLASSIFICATION_SCHEIN_NOT_APPLICABLE = 'Nicht anwendbar';
// --- Phase 59 additions (D-18) ---------------------------------------------
// Locked DRV audit defense bundle strings.
// Sourced from DRV Rundschreiben RS 2022/1 and § 7a SGB IV.
// PENDING Steuerberater sign-off (see Phase 59 Plan 59-01 Task 3 MANUAL-REVIEW checkpoint).
export const DRV_DEFENSE_COVER_HEADER_DE =
  'Statusfeststellungsverfahren nach § 7a SGB IV — Defensivdokumentation';
export const DRV_DEFENSE_SECTION_TITLES_DE = {
  engagementStructure: 'Engagement-Struktur',
  independenceIndicators: 'Selbständigkeitsindikatoren',
  riskAssessmentHistory: 'Risikobewertungsverlauf',
  otherClientAttestation: 'Attestierung weiterer Auftraggeber',
};
export const DRV_DEFENSE_TABLE_HEADERS_DE = {
  riskHistory: {
    date: 'Bewertungsdatum',
    ruleSetVersion: 'Regelwerk-Version',
    totalScore: 'Gesamtpunktzahl',
    verdict: 'Einstufung',
    delta: 'Veränderung',
  },
  crossReference: {
    client: 'Auftraggeber',
    role: 'Tätigkeit',
    startDate: 'Beginn',
    endDate: 'Ende',
  },
};
export const DRV_DEFENSE_ATTESTATION_FOOTER_DE =
  'Datum: __________________   Unterschrift: __________________';
export const DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE =
  'Diese Übersicht zeigt nur Engagements, die von Ihrer Organisation auf dieser Plattform ' +
  'erfasst wurden. Sie ist nicht erschöpfend.';
// --- Phase 63 additions (D-22) — Skonto description template ----------------
export const SKONTO_DESCRIPTION_TEMPLATE_DE =
  '{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage';
// --- Phase 62 additions (EINV-02, EINV-03) — Inbound e-invoice intake --------
// Canonical DE error-text forms surfaced in the upload dialog when inbound
// XRechnung / ZUGFeRD validation fails at the CII-XSD layer or the profile
// level is too low to preserve line-item data. Phrased per Phase 62 UI spec
// § Copywriting Contract; statutory meaning lies in the reference to the
// CII schema + ZUGFeRD profile semantics.
//
// Kept in legal/de.ts (not messages/de.json) so the CI guard locks them
// against accidental paraphrase. messages/de.json carries the same text as
// VALUES (allowed) — only reserved key identifiers are forbidden there.
export const EINVOICE_INTAKE_XSD_REJECT_DE =
  'Die XML entspricht nicht dem CII-Schema — bitten Sie den Absender, erneut auszustellen.';
export const EINVOICE_INTAKE_LEVEL_TOO_LOW_DE =
  'Diese Rechnung verwendet das ZUGFeRD-Profil {level}, dem die Positionsdaten fehlen. Bitten Sie den Absender um ein COMFORT- oder XRECHNUNG-Profil.';
export const EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE =
  'Diese Rechnung verwendet das EXTENDED-ZUGFeRD-Profil. Einige absenderspezifische Felder konnten nicht zugeordnet werden. Prüfen Sie die Daten sorgfältig vor der Übernahme.';
// --- Phase 60 additions (CLASS-09) -----------------------------------------
// Locked DRV Statusfeststellungsverfahren panel phrasing.
// Sourced from § 7a SGB IV and DRV Clearingstelle terminology.
// PENDING Steuerberater sign-off — flagged under Manual-Only Verifications.
export const DRV_CLEARANCE_PANEL_HEADER_DE = 'Statusfeststellungsverfahren (§ 7a SGB IV)';
export const DRV_CLEARANCE_SECTION_REFERENCE_DE = '§ 7a SGB IV';
/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 * Keeping this list in sync with `LOCKED_DE_PHRASES` is enforced by the guard.
 */
export const RESERVED_LEGAL_KEYS = [
  'GDPR_CONTROLLER_LABEL',
  'GDPR_RIGHTS_HEADING',
  'GDPR_DPO_LABEL',
  'GDPR_COMPLAINT_HEADING',
  'TAX_USTIDNR_LABEL',
  'TAX_STEUERNUMMER_LABEL',
  'TAX_HANDELSREGISTER_LABEL',
  'TAX_SOZIALVERSICHERUNGSNUMMER_LABEL',
  'TAX_KLEINUNTERNEHMER_LABEL',
  'TAX_KLEINUNTERNEHMER_NOTICE',
  'TAX_STEUERSCHULDNERSCHAFT',
  // Phase 58 — Classification (D-07)
  'CLASSIFICATION_SCHEIN_TITLE',
  'CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL',
  'CLASSIFICATION_SCHEIN_CRITERIA_LABEL',
  'CLASSIFICATION_SCHEIN_INTEGRATION',
  'CLASSIFICATION_SCHEIN_ENTREPRENEURIAL',
  'CLASSIFICATION_SCHEIN_PERSONAL_DEP',
  'CLASSIFICATION_SCHEIN_ECONOMIC_DEP',
  'CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL',
  'CLASSIFICATION_SCHEIN_NOT_APPLICABLE',
  // Phase 59 — DRV defense bundle (D-18)
  'DRV_DEFENSE_COVER_HEADER_DE',
  'DRV_DEFENSE_SECTION_TITLES_DE',
  'DRV_DEFENSE_TABLE_HEADERS_DE',
  'DRV_DEFENSE_ATTESTATION_FOOTER_DE',
  'DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE',
  // Phase 60 — DRV Statusfeststellungsverfahren clearance panel (CLASS-09)
  'DRV_CLEARANCE_PANEL_HEADER_DE',
  'DRV_CLEARANCE_SECTION_REFERENCE_DE',
  // Phase 63 — Skonto description template (D-22)
  'SKONTO_DESCRIPTION_TEMPLATE_DE',
  // Phase 62 — Inbound e-invoice intake (EINV-02, EINV-03)
  'EINVOICE_INTAKE_XSD_REJECT_DE',
  'EINVOICE_INTAKE_LEVEL_TOO_LOW_DE',
  'EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE',
];
/**
 * Canonical record of every locked DE phrase. Consumers should import from
 * here rather than inlining the strings to keep a single source of truth.
 */
export const LOCKED_DE_PHRASES = {
  GDPR_CONTROLLER_LABEL,
  GDPR_RIGHTS_HEADING,
  GDPR_DPO_LABEL,
  GDPR_COMPLAINT_HEADING,
  TAX_USTIDNR_LABEL,
  TAX_STEUERNUMMER_LABEL,
  TAX_HANDELSREGISTER_LABEL,
  TAX_SOZIALVERSICHERUNGSNUMMER_LABEL,
  TAX_KLEINUNTERNEHMER_LABEL,
  TAX_KLEINUNTERNEHMER_NOTICE,
  TAX_STEUERSCHULDNERSCHAFT,
  // Phase 58 — Classification (D-07)
  CLASSIFICATION_SCHEIN_TITLE,
  CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL,
  CLASSIFICATION_SCHEIN_CRITERIA_LABEL,
  CLASSIFICATION_SCHEIN_INTEGRATION,
  CLASSIFICATION_SCHEIN_ENTREPRENEURIAL,
  CLASSIFICATION_SCHEIN_PERSONAL_DEP,
  CLASSIFICATION_SCHEIN_ECONOMIC_DEP,
  CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL,
  CLASSIFICATION_SCHEIN_NOT_APPLICABLE,
  // Phase 59 — DRV defense bundle (D-18)
  DRV_DEFENSE_COVER_HEADER_DE,
  DRV_DEFENSE_SECTION_TITLES_DE,
  DRV_DEFENSE_TABLE_HEADERS_DE,
  DRV_DEFENSE_ATTESTATION_FOOTER_DE,
  DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE,
  // Phase 60 — DRV clearance panel (CLASS-09)
  DRV_CLEARANCE_PANEL_HEADER_DE,
  DRV_CLEARANCE_SECTION_REFERENCE_DE,
  // Phase 63 — Skonto description template (D-22)
  SKONTO_DESCRIPTION_TEMPLATE_DE,
  // Phase 62 — Inbound e-invoice intake (EINV-02, EINV-03)
  EINVOICE_INTAKE_XSD_REJECT_DE,
  EINVOICE_INTAKE_LEVEL_TOO_LOW_DE,
  EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE,
};
//# sourceMappingURL=de.js.map
