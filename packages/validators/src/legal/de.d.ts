export declare const GDPR_CONTROLLER_LABEL: 'Verantwortlicher im Sinne der DSGVO';
export declare const GDPR_RIGHTS_HEADING: 'Ihre Rechte als betroffene Person';
export declare const GDPR_DPO_LABEL: 'Datenschutzbeauftragter';
export declare const GDPR_COMPLAINT_HEADING: 'Beschwerderecht bei der Aufsichtsbeh\u00F6rde';
export declare const TAX_USTIDNR_LABEL: 'Umsatzsteuer-Identifikationsnummer (USt-IdNr)';
export declare const TAX_STEUERNUMMER_LABEL: 'Steuernummer';
export declare const TAX_HANDELSREGISTER_LABEL: 'Handelsregisternummer';
export declare const TAX_SOZIALVERSICHERUNGSNUMMER_LABEL: 'Sozialversicherungsnummer';
export declare const TAX_KLEINUNTERNEHMER_LABEL: 'Kleinunternehmer gem\u00E4\u00DF \u00A7 19 UStG';
export declare const TAX_KLEINUNTERNEHMER_NOTICE: 'Gem\u00E4\u00DF \u00A7 19 UStG wird keine Umsatzsteuer ausgewiesen';
export declare const TAX_STEUERSCHULDNERSCHAFT: 'Steuerschuldnerschaft des Leistungsempf\u00E4ngers';
export declare const CLASSIFICATION_SCHEIN_TITLE: 'Scheinselbst\u00E4ndigkeit';
export declare const CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL: 'Statusfeststellungsverfahren';
export declare const CLASSIFICATION_SCHEIN_CRITERIA_LABEL: 'Wesentliche Merkmale der Selbstst\u00E4ndigkeit';
export declare const CLASSIFICATION_SCHEIN_INTEGRATION: 'Eingliederung in die Arbeitsorganisation';
export declare const CLASSIFICATION_SCHEIN_ENTREPRENEURIAL: 'Unternehmerische Selbstst\u00E4ndigkeit';
export declare const CLASSIFICATION_SCHEIN_PERSONAL_DEP: 'Pers\u00F6nliche Abh\u00E4ngigkeit';
export declare const CLASSIFICATION_SCHEIN_ECONOMIC_DEP: 'Wirtschaftliche Abh\u00E4ngigkeit';
export declare const CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL: 'Hinweis der Deutschen Rentenversicherung';
export declare const CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar';
export declare const DRV_DEFENSE_COVER_HEADER_DE: 'Statusfeststellungsverfahren nach \u00A7 7a SGB IV \u2014 Defensivdokumentation';
export declare const DRV_DEFENSE_SECTION_TITLES_DE: {
  readonly engagementStructure: 'Engagement-Struktur';
  readonly independenceIndicators: 'Selbständigkeitsindikatoren';
  readonly riskAssessmentHistory: 'Risikobewertungsverlauf';
  readonly otherClientAttestation: 'Attestierung weiterer Auftraggeber';
};
export declare const DRV_DEFENSE_TABLE_HEADERS_DE: {
  readonly riskHistory: {
    readonly date: 'Bewertungsdatum';
    readonly ruleSetVersion: 'Regelwerk-Version';
    readonly totalScore: 'Gesamtpunktzahl';
    readonly verdict: 'Einstufung';
    readonly delta: 'Veränderung';
  };
  readonly crossReference: {
    readonly client: 'Auftraggeber';
    readonly role: 'Tätigkeit';
    readonly startDate: 'Beginn';
    readonly endDate: 'Ende';
  };
};
export declare const DRV_DEFENSE_ATTESTATION_FOOTER_DE: 'Datum: __________________   Unterschrift: __________________';
export declare const DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE: string;
export declare const SKONTO_DESCRIPTION_TEMPLATE_DE: '{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage';
export declare const EINVOICE_INTAKE_XSD_REJECT_DE: 'Die XML entspricht nicht dem CII-Schema \u2014 bitten Sie den Absender, erneut auszustellen.';
export declare const EINVOICE_INTAKE_LEVEL_TOO_LOW_DE: 'Diese Rechnung verwendet das ZUGFeRD-Profil {level}, dem die Positionsdaten fehlen. Bitten Sie den Absender um ein COMFORT- oder XRECHNUNG-Profil.';
export declare const EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE: 'Diese Rechnung verwendet das EXTENDED-ZUGFeRD-Profil. Einige absenderspezifische Felder konnten nicht zugeordnet werden. Pr\u00FCfen Sie die Daten sorgf\u00E4ltig vor der \u00DCbernahme.';
export declare const DRV_CLEARANCE_PANEL_HEADER_DE: 'Statusfeststellungsverfahren (\u00A7 7a SGB IV)';
export declare const DRV_CLEARANCE_SECTION_REFERENCE_DE: '\u00A7 7a SGB IV';
/**
 * Identifier names that the CI guard forbids in any `messages/*.json` file.
 * Keeping this list in sync with `LOCKED_DE_PHRASES` is enforced by the guard.
 */
export declare const RESERVED_LEGAL_KEYS: readonly [
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
  'CLASSIFICATION_SCHEIN_TITLE',
  'CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL',
  'CLASSIFICATION_SCHEIN_CRITERIA_LABEL',
  'CLASSIFICATION_SCHEIN_INTEGRATION',
  'CLASSIFICATION_SCHEIN_ENTREPRENEURIAL',
  'CLASSIFICATION_SCHEIN_PERSONAL_DEP',
  'CLASSIFICATION_SCHEIN_ECONOMIC_DEP',
  'CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL',
  'CLASSIFICATION_SCHEIN_NOT_APPLICABLE',
  'DRV_DEFENSE_COVER_HEADER_DE',
  'DRV_DEFENSE_SECTION_TITLES_DE',
  'DRV_DEFENSE_TABLE_HEADERS_DE',
  'DRV_DEFENSE_ATTESTATION_FOOTER_DE',
  'DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE',
  'DRV_CLEARANCE_PANEL_HEADER_DE',
  'DRV_CLEARANCE_SECTION_REFERENCE_DE',
  'SKONTO_DESCRIPTION_TEMPLATE_DE',
  'EINVOICE_INTAKE_XSD_REJECT_DE',
  'EINVOICE_INTAKE_LEVEL_TOO_LOW_DE',
  'EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE',
];
/**
 * Canonical record of every locked DE phrase. Consumers should import from
 * here rather than inlining the strings to keep a single source of truth.
 */
export declare const LOCKED_DE_PHRASES: {
  readonly GDPR_CONTROLLER_LABEL: 'Verantwortlicher im Sinne der DSGVO';
  readonly GDPR_RIGHTS_HEADING: 'Ihre Rechte als betroffene Person';
  readonly GDPR_DPO_LABEL: 'Datenschutzbeauftragter';
  readonly GDPR_COMPLAINT_HEADING: 'Beschwerderecht bei der Aufsichtsbehörde';
  readonly TAX_USTIDNR_LABEL: 'Umsatzsteuer-Identifikationsnummer (USt-IdNr)';
  readonly TAX_STEUERNUMMER_LABEL: 'Steuernummer';
  readonly TAX_HANDELSREGISTER_LABEL: 'Handelsregisternummer';
  readonly TAX_SOZIALVERSICHERUNGSNUMMER_LABEL: 'Sozialversicherungsnummer';
  readonly TAX_KLEINUNTERNEHMER_LABEL: 'Kleinunternehmer gemäß § 19 UStG';
  readonly TAX_KLEINUNTERNEHMER_NOTICE: 'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen';
  readonly TAX_STEUERSCHULDNERSCHAFT: 'Steuerschuldnerschaft des Leistungsempfängers';
  readonly CLASSIFICATION_SCHEIN_TITLE: 'Scheinselbständigkeit';
  readonly CLASSIFICATION_SCHEIN_ASSESSMENT_LABEL: 'Statusfeststellungsverfahren';
  readonly CLASSIFICATION_SCHEIN_CRITERIA_LABEL: 'Wesentliche Merkmale der Selbstständigkeit';
  readonly CLASSIFICATION_SCHEIN_INTEGRATION: 'Eingliederung in die Arbeitsorganisation';
  readonly CLASSIFICATION_SCHEIN_ENTREPRENEURIAL: 'Unternehmerische Selbstständigkeit';
  readonly CLASSIFICATION_SCHEIN_PERSONAL_DEP: 'Persönliche Abhängigkeit';
  readonly CLASSIFICATION_SCHEIN_ECONOMIC_DEP: 'Wirtschaftliche Abhängigkeit';
  readonly CLASSIFICATION_SCHEIN_DRV_REFERENCE_LABEL: 'Hinweis der Deutschen Rentenversicherung';
  readonly CLASSIFICATION_SCHEIN_NOT_APPLICABLE: 'Nicht anwendbar';
  readonly DRV_DEFENSE_COVER_HEADER_DE: 'Statusfeststellungsverfahren nach § 7a SGB IV — Defensivdokumentation';
  readonly DRV_DEFENSE_SECTION_TITLES_DE: {
    readonly engagementStructure: 'Engagement-Struktur';
    readonly independenceIndicators: 'Selbständigkeitsindikatoren';
    readonly riskAssessmentHistory: 'Risikobewertungsverlauf';
    readonly otherClientAttestation: 'Attestierung weiterer Auftraggeber';
  };
  readonly DRV_DEFENSE_TABLE_HEADERS_DE: {
    readonly riskHistory: {
      readonly date: 'Bewertungsdatum';
      readonly ruleSetVersion: 'Regelwerk-Version';
      readonly totalScore: 'Gesamtpunktzahl';
      readonly verdict: 'Einstufung';
      readonly delta: 'Veränderung';
    };
    readonly crossReference: {
      readonly client: 'Auftraggeber';
      readonly role: 'Tätigkeit';
      readonly startDate: 'Beginn';
      readonly endDate: 'Ende';
    };
  };
  readonly DRV_DEFENSE_ATTESTATION_FOOTER_DE: 'Datum: __________________   Unterschrift: __________________';
  readonly DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE: string;
  readonly DRV_CLEARANCE_PANEL_HEADER_DE: 'Statusfeststellungsverfahren (§ 7a SGB IV)';
  readonly DRV_CLEARANCE_SECTION_REFERENCE_DE: '§ 7a SGB IV';
  readonly SKONTO_DESCRIPTION_TEMPLATE_DE: '{percent}% Skonto bei Zahlung innerhalb von {discountDays} Tagen, sonst netto {netDays} Tage';
  readonly EINVOICE_INTAKE_XSD_REJECT_DE: 'Die XML entspricht nicht dem CII-Schema — bitten Sie den Absender, erneut auszustellen.';
  readonly EINVOICE_INTAKE_LEVEL_TOO_LOW_DE: 'Diese Rechnung verwendet das ZUGFeRD-Profil {level}, dem die Positionsdaten fehlen. Bitten Sie den Absender um ein COMFORT- oder XRECHNUNG-Profil.';
  readonly EINVOICE_INTAKE_EXTENDED_BEST_EFFORT_DE: 'Diese Rechnung verwendet das EXTENDED-ZUGFeRD-Profil. Einige absenderspezifische Felder konnten nicht zugeordnet werden. Prüfen Sie die Daten sorgfältig vor der Übernahme.';
};
/** Literal-union type of the locked-phrase identifiers. */
export type LockedDePhraseKey = keyof typeof LOCKED_DE_PHRASES;
//# sourceMappingURL=de.d.ts.map
