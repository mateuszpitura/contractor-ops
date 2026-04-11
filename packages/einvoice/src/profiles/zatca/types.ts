// ---------------------------------------------------------------------------
// ZATCA (Saudi Arabia) E-Invoicing Types
// ---------------------------------------------------------------------------

/** Standard (B2B clearance) or Simplified (B2C reporting) invoice type */
export type ZatcaInvoiceType = "standard" | "simplified";

/** UBL invoice type codes per ZATCA spec */
export type ZatcaInvoiceTypeCode = "388" | "381" | "383";

/**
 * Invoice subtype codes per ZATCA specification.
 * - 0100000: Standard tax invoice
 * - 0100001: Standard third-party invoice
 * - 0200000: Simplified tax invoice
 * - 0200001: Simplified third-party invoice
 */
export type ZatcaInvoiceSubtype =
  | "0100000"
  | "0100001"
  | "0200000"
  | "0200001";

/** ZATCA profile identifiers for B2B clearance and B2C reporting */
export type ZatcaProfileId = "reporting:1.0" | "clearance:1.0";

/** Steps in the ZATCA device onboarding flow */
export type ZatcaOnboardingStep =
  | "tax_details"
  | "csr_generation"
  | "compliance_csid"
  | "compliance_checks"
  | "production_certificate";

/** State tracked during ZATCA device onboarding */
export interface ZatcaOnboardingState {
  currentStep: ZatcaOnboardingStep;
  taxDetails?: boolean;
  csrGenerated?: boolean;
  complianceCsidReceived?: boolean;
  complianceChecksPassed?: boolean;
  productionCertActive?: boolean;
}

/**
 * TLV (Tag-Length-Value) tags for ZATCA QR code encoding.
 * Tags 1-5 are required for Phase 1 (B2C simplified).
 * Tags 6-8 are required for Phase 2 (B2B standard).
 */
export enum ZatcaTlvTag {
  SELLER_NAME = 1,
  VAT_NUMBER = 2,
  TIMESTAMP = 3,
  TOTAL_WITH_VAT = 4,
  VAT_AMOUNT = 5,
  INVOICE_HASH = 6,
  ECDSA_SIGNATURE = 7,
  PUBLIC_KEY = 8,
}

/** ZATCA-specific extension fields on an EInvoice */
export interface ZatcaInvoiceExtensions {
  invoiceType: ZatcaInvoiceType;
  invoiceSubtype: ZatcaInvoiceSubtype;
  icv: number;
  pih: string;
  uuid: string;
}
