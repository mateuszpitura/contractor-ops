// ---------------------------------------------------------------------------
// PINT-AE Validator
// ---------------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser";
import { dig } from "../../engine/xml-utils.js";
import type { ValidationError, ValidationResult } from "../../types/validation.js";
import { PINT_AE_CUSTOMIZATION_ID, UAE_SCHEME_ID } from "./constants.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  isArray: (name) => ["cac:InvoiceLine", "cac:TaxSubtotal"].includes(name),
});

/**
 * Extract text content from a node.
 */
function text(node: unknown): string {
  if (node === undefined || node === null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"]);
  }
  return String(node);
}

/**
 * Check if a party has a TRN identifier with schemeID 0192.
 */
function hasTrnIdentifier(partyNode: Record<string, unknown>): boolean {
  const idNode = dig(partyNode, "cac:Party", "cac:PartyIdentification", "cbc:ID");
  if (!idNode || typeof idNode !== "object") return false;
  const schemeId = text((idNode as Record<string, unknown>)["@_schemeID"]);
  return schemeId === UAE_SCHEME_ID;
}

/**
 * Validates a PINT-AE UBL 2.1 XML document against UAE business rules.
 */
export function validatePintAeXml(xml: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  let inv: Record<string, unknown>;
  try {
    const parsed = parser.parse(xml) as Record<string, unknown>;
    inv = (parsed.Invoice ?? parsed.Invoice) as Record<string, unknown>;
    if (!inv) {
      return {
        valid: false,
        errors: [
          {
            code: "MISSING_ROOT",
            message: "Missing Invoice root element",
            severity: "error",
          },
        ],
        warnings: [],
        profileId: "peppol-ae",
      };
    }
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          code: "PARSE_ERROR",
          message: err instanceof Error ? err.message : String(err),
          severity: "error",
        },
      ],
      warnings: [],
      profileId: "peppol-ae",
    };
  }

  // Check CustomizationID
  const customizationId = text(dig(inv, "cbc:CustomizationID"));
  if (customizationId !== PINT_AE_CUSTOMIZATION_ID) {
    errors.push({
      code: "WRONG_CUSTOMIZATION_ID",
      message: `CustomizationID must be "${PINT_AE_CUSTOMIZATION_ID}", got "${customizationId}"`,
      path: "cbc:CustomizationID",
      severity: "error",
    });
  }

  // Check BuyerReference (mandatory for UAE)
  const buyerRef = text(dig(inv, "cbc:BuyerReference"));
  if (!buyerRef) {
    errors.push({
      code: "MISSING_BUYER_REFERENCE",
      message: "BuyerReference is mandatory for UAE PINT-AE invoices",
      path: "cbc:BuyerReference",
      severity: "error",
    });
  }

  // Check DocumentCurrencyCode
  const currencyCode = text(dig(inv, "cbc:DocumentCurrencyCode"));
  if (!currencyCode) {
    errors.push({
      code: "MISSING_CURRENCY_CODE",
      message: "DocumentCurrencyCode is required",
      path: "cbc:DocumentCurrencyCode",
      severity: "error",
    });
  }

  // Check supplier TRN
  const supplierParty = dig(inv, "cac:AccountingSupplierParty") as
    | Record<string, unknown>
    | undefined;
  if (!(supplierParty && hasTrnIdentifier(supplierParty))) {
    errors.push({
      code: "MISSING_SUPPLIER_TRN",
      message: `Supplier must have PartyIdentification with schemeID="${UAE_SCHEME_ID}" (UAE TRN)`,
      path: "cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification",
      severity: "error",
    });
  }

  // Check customer TRN (warning for cross-border)
  const customerParty = dig(inv, "cac:AccountingCustomerParty") as
    | Record<string, unknown>
    | undefined;
  if (customerParty && !hasTrnIdentifier(customerParty)) {
    warnings.push({
      code: "MISSING_CUSTOMER_TRN",
      message: `Customer does not have PartyIdentification with schemeID="${UAE_SCHEME_ID}". Required for domestic UAE invoices.`,
      path: "cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification",
      severity: "warning",
    });
  }

  // Check tax subtotals exist
  const taxSubtotals = dig(inv, "cac:TaxTotal", "cac:TaxSubtotal");
  if (!taxSubtotals || (Array.isArray(taxSubtotals) && taxSubtotals.length === 0)) {
    errors.push({
      code: "MISSING_TAX_SUBTOTAL",
      message: "At least one TaxSubtotal is required",
      path: "cac:TaxTotal/cac:TaxSubtotal",
      severity: "error",
    });
  }

  // Check invoice lines have LineExtensionAmount
  const rawLines = dig(inv, "cac:InvoiceLine") as Record<string, unknown>[] | undefined;
  if (rawLines) {
    rawLines.forEach((line, idx) => {
      const amount = dig(line, "cbc:LineExtensionAmount");
      if (!amount) {
        errors.push({
          code: "MISSING_LINE_AMOUNT",
          message: `InvoiceLine ${idx + 1} missing LineExtensionAmount`,
          path: `cac:InvoiceLine[${idx + 1}]/cbc:LineExtensionAmount`,
          severity: "error",
        });
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    profileId: "peppol-ae",
  };
}
