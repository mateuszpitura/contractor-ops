// ---------------------------------------------------------------------------
// E-Invoice Profile Interface
// ---------------------------------------------------------------------------

import type { ComplianceStatus } from './compliance.js';
import type { EInvoice } from './invoice.js';
import type { ValidationResult } from './validation.js';

/**
 * Certificate information for digital signing operations.
 */
export interface CertificateInfo {
  /** Base64-encoded X.509 certificate */
  certificate: string;
  /** Base64-encoded private key (if separate from certificate) */
  privateKey?: string;
  /** PKCS12 password */
  password?: string;
}

/**
 * Result of verifying an XML digital signature.
 */
export interface SignatureVerificationResult {
  valid: boolean;
  signerName?: string;
  signedAt?: Date;
  errors?: string[];
}

/**
 * Capability hook for XML digital signing (XML DSig / XAdES).
 * Profiles implement this if their country requires signed invoices.
 * Abstracted as a profile-level capability, not hardcoded to any country.
 */
export interface Signable {
  sign(xml: string, certificate: CertificateInfo): Promise<string>;
  verify(xml: string): Promise<SignatureVerificationResult>;
}

/**
 * Capability hook for QR code generation on invoices.
 * Profiles implement this if their country requires QR codes.
 * Abstracted as a profile-level capability, not hardcoded to any country.
 */
export interface QRCodeable {
  generateQR(invoice: EInvoice): Promise<Buffer>;
  parseQR(data: Buffer): Promise<Partial<EInvoice>>;
}

/**
 * Country profile interface for the pluggable e-invoicing engine.
 *
 * Each country (KSeF, ZATCA, Peppol, etc.) implements this interface.
 * The engine orchestrates profiles; profiles provide country-specific logic.
 * New profiles can be added by implementing this interface without modifying
 * the engine core.
 */
export interface EInvoiceProfile {
  /** Unique profile identifier (e.g., "ksef", "zatca", "peppol-ae") */
  readonly profileId: string;
  /** ISO 3166-1 alpha-2 country code */
  readonly country: string;
  /** Human-readable name (e.g., "KSeF (Poland)") */
  readonly displayName: string;

  /**
   * Generate country-specific XML from canonical EInvoice.
   *
   * `opts` is intentionally `unknown` at the shared-interface level: each
   * country profile narrows it to its own domain-specific options type at
   * the implementation signature (e.g. `XRechnungGenerateOptions`,
   * `GenerateZugferdInput` shape). Callers working through the
   * `EInvoiceProfile` reference must type-assert before passing options;
   * direct callers (`new XRechnungDEProfile().generate(invoice, { ... })`)
   * get full type-safety from the narrowed signature.
   *
   * Widened from `(invoice) => Promise<string>` so each profile can extend
   * its own opts type (e.g. Skonto terms for XRechnung / ZUGFeRD) without
   * forcing every other profile (KSeF / ZATCA / Peppol-AE) to acknowledge
   * a profile-specific param.
   */
  generate(invoice: EInvoice, opts?: unknown): Promise<string>;
  /** Parse country-specific XML into canonical EInvoice */
  parse(xml: string, metadata?: Record<string, unknown>): Promise<EInvoice>;
  /** Validate XML against country-specific rules */
  validate(xml: string): Promise<ValidationResult>;
  /** Get compliance status for an organization */
  getComplianceStatus(organizationId: string): Promise<ComplianceStatus>;

  /** Digital signature capability (undefined if profile doesn't require signing) */
  readonly sign?: Signable;
  /** QR code capability (undefined if profile doesn't require QR codes) */
  readonly qrCode?: QRCodeable;
}
