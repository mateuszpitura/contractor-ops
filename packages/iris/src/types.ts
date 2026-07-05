// Public types for the IRS IRIS (Information Returns Intake System) 1099-NEC
// generator + validator.
//
// ADVISER-VERIFY: element names, amount formatting, and the CFSF state list
// are best-effort until the IRS IRIS XSD bundle is pinned at the human-action
// checkpoint (see src/schema-bundle/README.md). No artifact here is final
// legal/tax advice (local-only / legal-deferred posture).

/** Schema VersionNum/VersionDt the submission is built against. */
export interface IrisSchemaVersion {
  /** Schema major version, e.g. `'2.0'`. */
  versionNum: string;
  /** ISO date the schema was posted, e.g. `'2025-11-06'`. */
  versionDt: string;
}

/** Payer (issuer) of the 1099-NEC. Their own EIN appears in full on the return. */
export interface IrisPayer {
  /** Payer EIN (9 digits, employer's own identifier). */
  tin: string;
  name: string;
  /** USPS two-letter state code, e.g. `'CA'`. */
  stateCode: string;
}

/**
 * Payee (recipient) B-record.
 *
 * `recipientTin` is the already-masked value (last-4 only, e.g. `'XXX-XX-1120'`).
 * The full recipient SSN/TIN MUST NOT be passed here or emitted — only the
 * masked form survives into the payload.
 */
export interface IrisPayee {
  /** Masked recipient TIN — last-4 only (e.g. `'XXX-XX-1120'`). Never the full SSN. */
  recipientTin: string;
  recipientName: string;
  /** Box 1 nonemployee compensation, in minor units (cents). */
  box1AmountMinor: number;
  /** Box 4 federal income tax withheld (backup withholding), in minor units (cents). */
  box4BackupWithholdingMinor: number;
  /**
   * Combined Federal/State Filing (CFSF) state code for a participating state,
   * e.g. `'GA'`. Written into the payee B-record.
   */
  cfsfStateCode: string;
}

/** Input to {@link buildIrisXml}. */
export interface IrisSubmissionInput {
  /** Filing tax year, e.g. `2026`. */
  taxYear: number;
  schemaVersion: IrisSchemaVersion;
  payer: IrisPayer;
  payees: IrisPayee[];
}

/** Withholding agent on a 1042-S. Their own EIN appears in full on the return. */
export interface Iris1042SWithholdingAgent {
  /** Withholding agent EIN (9 digits, the agent's own identifier). */
  tin: string;
  name: string;
}

/**
 * 1042-S recipient record.
 *
 * The 1042-S is a distinct IRS schema (Publication 1187) from the 1099 series —
 * chapter 3/4 status codes, income codes, and treaty fields — so it uses a
 * sibling record shape rather than the 1099 payee.
 *
 * `recipientFtin` is the already-masked value (last-4 only, e.g. `'XXX-XX-4821'`).
 * The full foreign TIN MUST NOT be passed here or emitted — only the masked form
 * survives into the payload.
 */
export interface Iris1042SRecipient {
  /** Masked recipient foreign TIN — last-4 only (e.g. `'XXX-XX-4821'`). Never the full FTIN. */
  recipientFtin: string;
  recipientName: string;
  /** Income code (box 1; i1042s Appendix B), e.g. `'17'`. */
  incomeCode: string;
  /** Box 2 gross income, in minor units (cents). */
  grossIncomeBox2Minor: number;
  /** Chapter 3 exemption code (box 3a; i1042s Appendix B). */
  chap3ExemptionCode: string;
  /** Chapter 3 withholding rate, in basis points (`1500` = 15.00%). */
  chap3RateBp: number;
  /** Chapter 4 exemption code (box 4a; i1042s Appendix C). */
  chap4ExemptionCode: string;
  /** Chapter 4 withholding rate, in basis points. */
  chap4RateBp: number;
  /** Box 7 federal tax withheld, in minor units (cents). */
  federalTaxWithheldBox7Minor: number;
  /** Recipient chapter-3 status code (box 13j). */
  recipientChap3StatusCode: string;
  /** Recipient chapter-4 status code (box 13k). */
  recipientChap4StatusCode: string;
  /** Limitation on Benefits (LOB) code (box 13n). */
  recipientLobCode: string;
  /** Treaty article claimed, e.g. `'Article 7'`. */
  treatyArticle: string;
}

/** Input to {@link buildIris1042SXml}. */
export interface Iris1042SSubmissionInput {
  /** Filing tax year, e.g. `2026`. */
  taxYear: number;
  schemaVersion: IrisSchemaVersion;
  withholdingAgent: Iris1042SWithholdingAgent;
  recipients: Iris1042SRecipient[];
}

/** A single XSD validation problem. */
export interface IrisValidationError {
  code: string;
  message: string;
  /** XPath/location of the problem when libxml2 reports one. */
  path?: string;
  severity: 'error' | 'fatal';
}

/**
 * Result of validating an IRIS XML document against the bundled IRS XSD.
 *
 * Mirrors the packages/einvoice layer-1 report shape: `VALID` only when the
 * instance round-trips the schema with zero errors; `INVALID` when the schema
 * genuinely rejects the instance. `BUNDLE_UNAVAILABLE` is a distinct,
 * non-throwing outcome for the pre-enablement state where the IRS IRIS XSD
 * bundle has not been placed yet (IRS SOR login required — see
 * src/schema-bundle/README.md): validation could not run, so the instance is
 * neither proven valid nor genuinely rejected. Callers MUST treat
 * `BUNDLE_UNAVAILABLE` as "do not file" (validity unproven), never as VALID.
 */
export interface IrisValidationReport {
  status: 'VALID' | 'INVALID' | 'BUNDLE_UNAVAILABLE';
  errors: IrisValidationError[];
}
