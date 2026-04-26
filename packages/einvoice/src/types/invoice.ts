// ---------------------------------------------------------------------------
// E-Invoice Core Types
// ---------------------------------------------------------------------------

/**
 * Party in an e-invoice (supplier or customer).
 */
export interface EInvoiceParty {
  /** Tax identifier (NIP, TIN, VAT number) */
  id: string;
  /** Legal name */
  name: string;
  /** Formatted address */
  address?: string;
  /** ISO 3166-1 alpha-2 country code */
  country?: string;
  /** Additional identifiers keyed by scheme (e.g., { schemeID: "0088", value: "..." }) */
  additionalIds?: Record<string, string>;
}

/**
 * Single line item on an e-invoice.
 * All monetary amounts are in minor units (integer).
 */
export interface EInvoiceLine {
  lineNumber: number;
  description: string;
  quantity?: number;
  unit?: string;
  unitPriceMinor?: number;
  netAmountMinor?: number;
  vatRate?: string;
  vatAmountMinor?: number;
  grossAmountMinor?: number;
}

/**
 * Tax breakdown subtotal.
 */
export interface EInvoiceTaxSubtotal {
  taxableAmountMinor: number;
  taxAmountMinor: number;
  /** UBL tax category code: S=standard, Z=zero, E=exempt, AE=reverse charge */
  taxCategory: string;
  percent?: number;
}

/**
 * Payment means information.
 */
export interface EInvoicePaymentMeans {
  /** UNCL 4461 payment means code */
  code?: string;
  dueDate?: string;
  bankAccount?: string;
  bankName?: string;
  paymentReference?: string;
}

/**
 * Canonical e-invoice type. Country profiles map to/from this model.
 *
 * Covers ~15-20 common fields across all profiles per D-06.
 * Profile-specific extensions go in the `extensions` field.
 * All monetary amounts are in minor units (integer).
 */
export interface EInvoice {
  /** Invoice number / document ID */
  id: string;
  /** ISO 8601 date string */
  issueDate: string;
  /** ISO 8601 date string */
  dueDate?: string;
  /** UBL invoice type code: "380" = commercial invoice, "381" = credit note */
  invoiceTypeCode: string;
  /** ISO 4217 currency code */
  currencyCode: string;
  supplier: EInvoiceParty;
  customer: EInvoiceParty;
  lines: EInvoiceLine[];
  /** Net total in minor units */
  taxExclusiveAmount: number;
  /** Gross total in minor units */
  taxInclusiveAmount: number;
  /** Amount to pay in minor units */
  payableAmount: number;
  taxBreakdown: EInvoiceTaxSubtotal[];
  paymentMeans?: EInvoicePaymentMeans;
  /** Profile-specific extension data */
  extensions?: Record<string, unknown>;
  /** Profile that generated/parsed this invoice (e.g., "ksef", "zatca", "peppol-ae") */
  profileId: string;
  /** External system reference (e.g., KSeF reference number, ZATCA UUID) */
  externalReference?: string;
}
