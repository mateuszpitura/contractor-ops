// ---------------------------------------------------------------------------
// PINT-AE Validator
// ---------------------------------------------------------------------------

import { XMLParser } from 'fast-xml-parser';
import { dig } from '../../engine/xml-utils.js';
import type { ValidationError, ValidationResult } from '../../types/validation.js';
import { PINT_AE_CUSTOMIZATION_ID, UAE_SCHEME_ID } from './constants.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseAttributeValue: false,
  isArray: name => ['cac:InvoiceLine', 'cac:TaxSubtotal'].includes(name),
});

/**
 * Extract text content from a node.
 */
function text(node: unknown): string {
  if (node === undefined || node === null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (typeof node === 'object' && '#text' in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)['#text']);
  }
  return String(node);
}

/**
 * Check if a party has a TRN identifier with the UAE Peppol scheme ID.
 */
function hasTrnIdentifier(partyNode: Record<string, unknown>): boolean {
  const idNode = dig(partyNode, 'cac:Party', 'cac:PartyIdentification', 'cbc:ID');
  if (!idNode || typeof idNode !== 'object') return false;
  const schemeId = text((idNode as Record<string, unknown>)['@_schemeID']);
  return schemeId === UAE_SCHEME_ID;
}

/**
 * Parse XML and extract the Invoice root element, or return an early error result.
 */
function parseInvoiceRoot(
  xml: string,
): { ok: true; inv: Record<string, unknown> } | { ok: false; result: ValidationResult } {
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const inv = (parsed.Invoice ?? parsed.Invoice) as Record<string, unknown>;
    if (!inv) {
      return {
        ok: false,
        result: {
          valid: false,
          errors: [
            { code: 'MISSING_ROOT', message: 'Missing Invoice root element', severity: 'error' },
          ],
          warnings: [],
          profileId: 'peppol-ae',
        },
      };
    }
    return { ok: true, inv };
  } catch (err) {
    return {
      ok: false,
      result: {
        valid: false,
        errors: [
          {
            code: 'PARSE_ERROR',
            message: err instanceof Error ? err.message : String(err),
            severity: 'error',
          },
        ],
        warnings: [],
        profileId: 'peppol-ae',
      },
    };
  }
}

function validateCustomizationId(inv: Record<string, unknown>): ValidationError | null {
  const customizationId = text(dig(inv, 'cbc:CustomizationID'));
  if (customizationId !== PINT_AE_CUSTOMIZATION_ID) {
    return {
      code: 'WRONG_CUSTOMIZATION_ID',
      message: `CustomizationID must be "${PINT_AE_CUSTOMIZATION_ID}", got "${customizationId}"`,
      path: 'cbc:CustomizationID',
      severity: 'error',
    };
  }
  return null;
}

function validateRequiredTextField(
  inv: Record<string, unknown>,
  path: string,
  code: string,
  message: string,
): ValidationError | null {
  const value = text(dig(inv, path));
  if (!value) {
    return { code, message, path, severity: 'error' };
  }
  return null;
}

function validateSupplierTrn(inv: Record<string, unknown>): ValidationError | null {
  const supplierParty = dig(inv, 'cac:AccountingSupplierParty') as
    | Record<string, unknown>
    | undefined;
  if (!(supplierParty && hasTrnIdentifier(supplierParty))) {
    return {
      code: 'MISSING_SUPPLIER_TRN',
      message: `Supplier must have PartyIdentification with schemeID="${UAE_SCHEME_ID}" (UAE TRN)`,
      path: 'cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification',
      severity: 'error',
    };
  }
  return null;
}

function validateCustomerTrn(inv: Record<string, unknown>): ValidationError | null {
  const customerParty = dig(inv, 'cac:AccountingCustomerParty') as
    | Record<string, unknown>
    | undefined;
  if (customerParty && !hasTrnIdentifier(customerParty)) {
    return {
      code: 'MISSING_CUSTOMER_TRN',
      message: `Customer does not have PartyIdentification with schemeID="${UAE_SCHEME_ID}". Required for domestic UAE invoices.`,
      path: 'cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification',
      severity: 'warning',
    };
  }
  return null;
}

function validateTaxSubtotals(inv: Record<string, unknown>): ValidationError | null {
  const taxSubtotals = dig(inv, 'cac:TaxTotal', 'cac:TaxSubtotal');
  if (!taxSubtotals || (Array.isArray(taxSubtotals) && taxSubtotals.length === 0)) {
    return {
      code: 'MISSING_TAX_SUBTOTAL',
      message: 'At least one TaxSubtotal is required',
      path: 'cac:TaxTotal/cac:TaxSubtotal',
      severity: 'error',
    };
  }
  return null;
}

function validateLineAmounts(inv: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];
  const rawLines = dig(inv, 'cac:InvoiceLine') as Record<string, unknown>[] | undefined;
  if (rawLines) {
    for (let idx = 0; idx < rawLines.length; idx++) {
      const amount = dig(rawLines[idx] as Record<string, unknown>, 'cbc:LineExtensionAmount');
      if (!amount) {
        errors.push({
          code: 'MISSING_LINE_AMOUNT',
          message: `InvoiceLine ${idx + 1} missing LineExtensionAmount`,
          path: `cac:InvoiceLine[${idx + 1}]/cbc:LineExtensionAmount`,
          severity: 'error',
        });
      }
    }
  }
  return errors;
}

/**
 * Validates a PINT-AE UBL 2.1 XML document against UAE business rules.
 */
export function validatePintAeXml(xml: string): ValidationResult {
  const parsed = parseInvoiceRoot(xml);
  if (!parsed.ok) return parsed.result;
  const inv = parsed.inv;

  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const checks: Array<ValidationError | null> = [
    validateCustomizationId(inv),
    validateRequiredTextField(
      inv,
      'cbc:BuyerReference',
      'MISSING_BUYER_REFERENCE',
      'BuyerReference is mandatory for UAE PINT-AE invoices',
    ),
    validateRequiredTextField(
      inv,
      'cbc:DocumentCurrencyCode',
      'MISSING_CURRENCY_CODE',
      'DocumentCurrencyCode is required',
    ),
    validateSupplierTrn(inv),
    validateTaxSubtotals(inv),
  ];

  for (const err of checks) {
    if (err) errors.push(err);
  }

  const customerWarning = validateCustomerTrn(inv);
  if (customerWarning) warnings.push(customerWarning);

  errors.push(...validateLineAmounts(inv));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    profileId: 'peppol-ae',
  };
}
