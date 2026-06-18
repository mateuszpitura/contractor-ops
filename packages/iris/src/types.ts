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
 * instance round-trips the schema with zero errors.
 */
export interface IrisValidationReport {
  status: 'VALID' | 'INVALID';
  errors: IrisValidationError[];
}
