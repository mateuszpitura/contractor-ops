// ---------------------------------------------------------------------------
// PINT-AE Constants
// ---------------------------------------------------------------------------

/** PINT-AE customization ID for UAE invoices */
export const PINT_AE_CUSTOMIZATION_ID = 'urn:peppol:pint:billing-1@uae-1.0';

/** Standard Peppol BIS Billing 3.0 profile ID */
export const PINT_AE_PROFILE_ID = 'urn:peppol:bis:billing';

/** ISO 6523 ICD for UAE Tax Registration Number */
export const UAE_SCHEME_ID = '0192';

/** Full Peppol document type identifier for PINT-AE invoices */
export const PINT_AE_DOCUMENT_TYPE_ID =
  'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@uae-1.0::2.1';

/** UAE VAT tax scheme identifier */
export const UAE_TAX_SCHEME_ID = 'VAT';

/** UAE tax category codes */
export const UAE_TAX_CATEGORIES: Record<string, string> = {
  S: 'Standard rate',
  Z: 'Zero rated',
  E: 'Exempt',
  AE: 'Reverse charge',
  O: 'Out of scope',
};

// UBL 2.1 namespace constants
export const UBL_INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
export const CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
export const CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
