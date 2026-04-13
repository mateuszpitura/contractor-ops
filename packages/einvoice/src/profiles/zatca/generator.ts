// ---------------------------------------------------------------------------
// ZATCA UBL 2.1 XML Generator with Saudi-specific Extensions
// ---------------------------------------------------------------------------

import { XMLBuilder } from 'fast-xml-parser';
import type { EInvoice } from '../../types/invoice.js';
import type { ZatcaInvoiceType, ZatcaProfileId } from './types.js';

// ---------------------------------------------------------------------------
// XML Namespaces
// ---------------------------------------------------------------------------

const UBL_INVOICE_NS = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
const CBC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
const CAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
const EXT_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';
const SIG_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2';
const SAC_NS = 'urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2';
const DS_NS = 'http://www.w3.org/2000/09/xmldsig#';
const XADES_NS = 'http://uri.etsi.org/01903/v1.3.2#';

const ZATCA_TAX_SCHEME_ID = 'VAT';

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  suppressBooleanAttributes: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert minor units (integer) to decimal string with 2 decimal places.
 */
function fromMinor(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Determine ZATCA ProfileID based on invoice type.
 * - standard (B2B) -> clearance:1.0
 * - simplified (B2C) -> reporting:1.0
 */
function resolveProfileId(invoiceType: ZatcaInvoiceType): ZatcaProfileId {
  return invoiceType === 'simplified' ? 'reporting:1.0' : 'clearance:1.0';
}

/**
 * Extract issue time from an ISO 8601 date string, defaulting to midnight.
 */
function extractIssueTime(issueDate: string): string {
  if (issueDate.includes('T')) {
    const timePart = issueDate.split('T')[1];
    return timePart ? timePart.replace('Z', '') : '00:00:00';
  }
  return '00:00:00';
}

/**
 * Build a UBL party structure for ZATCA.
 */
function buildParty(party: EInvoice['supplier'], _currencyCode: string) {
  return {
    'cac:Party': {
      'cac:PartyIdentification': {
        'cbc:ID': {
          '@_schemeID': 'CRN',
          '#text': party.additionalIds?.crn ?? party.id,
        },
      },
      'cac:PostalAddress': {
        ...(party.address ? { 'cbc:StreetName': party.address } : {}),
        ...(party.country
          ? {
              'cac:Country': {
                'cbc:IdentificationCode': party.country,
              },
            }
          : {}),
      },
      'cac:PartyTaxScheme': {
        'cbc:CompanyID': party.id,
        'cac:TaxScheme': {
          'cbc:ID': ZATCA_TAX_SCHEME_ID,
        },
      },
      'cac:PartyLegalEntity': {
        'cbc:RegistrationName': party.name,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Section builders (reduce cognitive complexity of generateZatcaXml)
// ---------------------------------------------------------------------------

/**
 * Build UBL TaxSubtotal elements from the canonical tax breakdown.
 */
function buildTaxSubtotals(invoice: EInvoice) {
  return invoice.taxBreakdown.map(tax => ({
    'cbc:TaxableAmount': {
      '@_currencyID': invoice.currencyCode,
      '#text': fromMinor(tax.taxableAmountMinor),
    },
    'cbc:TaxAmount': {
      '@_currencyID': invoice.currencyCode,
      '#text': fromMinor(tax.taxAmountMinor),
    },
    'cac:TaxCategory': {
      'cbc:ID': tax.taxCategory,
      ...(tax.percent == null ? {} : { 'cbc:Percent': tax.percent.toString() }),
      'cac:TaxScheme': { 'cbc:ID': ZATCA_TAX_SCHEME_ID },
    },
  }));
}

/**
 * Build UBL InvoiceLine elements from the canonical line items.
 */
function buildInvoiceLines(invoice: EInvoice) {
  return invoice.lines.map(line => ({
    'cbc:ID': String(line.lineNumber),
    'cbc:InvoicedQuantity': {
      '@_unitCode': line.unit ?? 'EA',
      '#text': String(line.quantity ?? 1),
    },
    'cbc:LineExtensionAmount': {
      '@_currencyID': invoice.currencyCode,
      '#text': fromMinor(line.netAmountMinor ?? 0),
    },
    'cac:TaxTotal': {
      'cbc:TaxAmount': {
        '@_currencyID': invoice.currencyCode,
        '#text': fromMinor(line.vatAmountMinor ?? 0),
      },
      'cbc:RoundingAmount': {
        '@_currencyID': invoice.currencyCode,
        '#text': fromMinor(line.grossAmountMinor ?? 0),
      },
    },
    'cac:Item': {
      'cbc:Name': line.description,
      ...(line.vatRate
        ? {
            'cac:ClassifiedTaxCategory': {
              'cbc:ID': line.vatRate,
              ...(line.vatRate === 'S' ? { 'cbc:Percent': '15' } : {}),
              'cac:TaxScheme': { 'cbc:ID': ZATCA_TAX_SCHEME_ID },
            },
          }
        : {}),
    },
    'cac:Price': {
      'cbc:PriceAmount': {
        '@_currencyID': invoice.currencyCode,
        '#text': fromMinor(line.unitPriceMinor ?? line.netAmountMinor ?? 0),
      },
    },
  }));
}

/**
 * Build UBL PaymentMeans element, or empty object if no payment means provided.
 */
function buildPaymentMeans(invoice: EInvoice): Record<string, unknown> {
  if (!invoice.paymentMeans) return {};

  const pm = invoice.paymentMeans;
  const node: Record<string, unknown> = {};
  if (pm.code) node['cbc:PaymentMeansCode'] = pm.code;
  if (pm.dueDate) node['cbc:PaymentDueDate'] = pm.dueDate;
  if (pm.bankAccount) {
    const account: Record<string, unknown> = { 'cbc:ID': pm.bankAccount };
    if (pm.bankName) {
      account['cac:FinancialInstitutionBranch'] = { 'cbc:Name': pm.bankName };
    }
    node['cac:PayeeFinancialAccount'] = account;
  }

  return { 'cac:PaymentMeans': node };
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generates a ZATCA-compliant UBL 2.1 Invoice XML from a canonical EInvoice.
 *
 * The invoice.extensions field MUST contain:
 * - invoiceType: "standard" | "simplified"
 * - invoiceSubtype: string (e.g., "0100000")
 * - icv: number (Invoice Counter Value)
 * - pih: string (Previous Invoice Hash, hex SHA-256)
 * - uuid: string (UUID v4)
 *
 * The generated XML is unsigned — Plan 02 wires XAdES signing.
 */
export function generateZatcaXml(invoice: EInvoice): string {
  const ext = (invoice.extensions ?? {}) as Record<string, unknown>;
  const invoiceType = (ext.invoiceType as ZatcaInvoiceType) ?? 'standard';
  const invoiceSubtype = (ext.invoiceSubtype as string) ?? '0100000';
  const icv = (ext.icv as number) ?? 1;
  const pih = (ext.pih as string) ?? '';
  const uuid = (ext.uuid as string) ?? '';

  const profileId = resolveProfileId(invoiceType);
  const issueTime = extractIssueTime(invoice.issueDate);
  const issueDate = invoice.issueDate.split('T')[0] ?? invoice.issueDate;
  const pihBase64 = Buffer.from(pih, 'hex').toString('base64');

  const totalTaxAmount = invoice.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0);

  const doc = {
    Invoice: {
      '@_xmlns': UBL_INVOICE_NS,
      '@_xmlns:cac': CAC_NS,
      '@_xmlns:cbc': CBC_NS,
      '@_xmlns:ext': EXT_NS,
      '@_xmlns:sig': SIG_NS,
      '@_xmlns:sac': SAC_NS,
      '@_xmlns:ds': DS_NS,
      '@_xmlns:xades': XADES_NS,

      // UBL Extensions — placeholder for XAdES signature (Plan 02)
      'ext:UBLExtensions': {
        'ext:UBLExtension': {
          'ext:ExtensionURI': 'urn:oasis:names:specification:ubl:dsig:enveloped:xades',
          'ext:ExtensionContent': {},
        },
      },

      'cbc:ProfileID': profileId,
      'cbc:ID': invoice.id,
      'cbc:UUID': uuid,
      'cbc:IssueDate': issueDate,
      'cbc:IssueTime': issueTime,
      'cbc:InvoiceTypeCode': {
        '@_name': invoiceSubtype,
        '#text': invoice.invoiceTypeCode,
      },
      'cbc:DocumentCurrencyCode': invoice.currencyCode,

      'cac:AdditionalDocumentReference': [
        { 'cbc:ID': 'ICV', 'cbc:UUID': String(icv) },
        {
          'cbc:ID': 'PIH',
          'cac:Attachment': {
            'cbc:EmbeddedDocumentBinaryObject': { '@_mimeCode': 'text/plain', '#text': pihBase64 },
          },
        },
        { 'cbc:ID': 'QR' },
      ],

      'cac:AccountingSupplierParty': buildParty(invoice.supplier, invoice.currencyCode),
      'cac:AccountingCustomerParty': buildParty(invoice.customer, invoice.currencyCode),

      ...buildPaymentMeans(invoice),

      'cac:TaxTotal': {
        'cbc:TaxAmount': {
          '@_currencyID': invoice.currencyCode,
          '#text': fromMinor(totalTaxAmount),
        },
        'cac:TaxSubtotal': buildTaxSubtotals(invoice),
      },

      'cac:LegalMonetaryTotal': {
        'cbc:TaxExclusiveAmount': {
          '@_currencyID': invoice.currencyCode,
          '#text': fromMinor(invoice.taxExclusiveAmount),
        },
        'cbc:TaxInclusiveAmount': {
          '@_currencyID': invoice.currencyCode,
          '#text': fromMinor(invoice.taxInclusiveAmount),
        },
        'cbc:PayableAmount': {
          '@_currencyID': invoice.currencyCode,
          '#text': fromMinor(invoice.payableAmount),
        },
      },

      'cac:InvoiceLine': buildInvoiceLines(invoice),
    },
  };

  return builder.build(doc) as string;
}
