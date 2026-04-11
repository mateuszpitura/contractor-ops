// ---------------------------------------------------------------------------
// PINT-AE UBL 2.1 XML Parser
// ---------------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser";
import type { EInvoice, EInvoiceLine, EInvoiceTaxSubtotal, EInvoiceParty } from "../../types/invoice.js";
import { dig, toMinorUnits } from "../../engine/xml-utils.js";
import { UAE_SCHEME_ID } from "./constants.js";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseAttributeValue: false,
  isArray: (name) =>
    ["cac:InvoiceLine", "cac:TaxSubtotal"].includes(name),
});

/**
 * Extract text content from a node that may be a string or an object with #text.
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
 * Parse a UBL party element into an EInvoiceParty.
 */
function parseParty(partyNode: Record<string, unknown>): EInvoiceParty {
  const party = dig(partyNode, "cac:Party") as Record<string, unknown> | undefined;
  if (!party) {
    return { id: "", name: "" };
  }

  const idNode = dig(party, "cac:PartyIdentification", "cbc:ID");
  const id = text(idNode);

  const name = text(
    dig(party, "cac:PartyLegalEntity", "cbc:RegistrationName") ??
    dig(party, "cac:PartyName", "cbc:Name"),
  );

  const address = text(
    dig(party, "cac:PostalAddress", "cbc:StreetName"),
  );

  const country = text(
    dig(party, "cac:PostalAddress", "cac:Country", "cbc:IdentificationCode"),
  );

  const tradeLicense = text(
    dig(party, "cac:PartyLegalEntity", "cbc:CompanyID"),
  );

  const additionalIds: Record<string, string> = {};
  if (tradeLicense) {
    additionalIds.tradeLicense = tradeLicense;
  }

  const schemeId = typeof idNode === "object" && idNode !== null
    ? text((idNode as Record<string, unknown>)["@_schemeID"])
    : "";
  if (schemeId) {
    additionalIds.schemeID = schemeId;
  }

  return {
    id,
    name,
    ...(address ? { address } : {}),
    ...(country ? { country } : {}),
    ...(Object.keys(additionalIds).length > 0 ? { additionalIds } : {}),
  };
}

/**
 * Parses a PINT-AE UBL 2.1 Invoice XML into a canonical EInvoice.
 */
export function parsePintAeXml(
  xml: string,
  metadata?: Record<string, unknown>,
): EInvoice {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const inv = (parsed.Invoice ?? parsed["Invoice"]) as Record<string, unknown>;
  if (!inv) {
    throw new Error("Invalid PINT-AE XML: missing Invoice root element");
  }

  const supplier = parseParty(
    (dig(inv, "cac:AccountingSupplierParty") as Record<string, unknown>) ?? {},
  );
  const customer = parseParty(
    (dig(inv, "cac:AccountingCustomerParty") as Record<string, unknown>) ?? {},
  );

  // Parse invoice lines
  const rawLines = dig(inv, "cac:InvoiceLine") as Record<string, unknown>[] | undefined;
  const lines: EInvoiceLine[] = (rawLines ?? []).map((line, idx) => ({
    lineNumber: parseInt(text(dig(line, "cbc:ID")), 10) || idx + 1,
    description: text(dig(line, "cac:Item", "cbc:Name")),
    quantity: parseFloat(text(dig(line, "cbc:InvoicedQuantity"))) || undefined,
    unit: text((dig(line, "cbc:InvoicedQuantity") as Record<string, unknown> | undefined)?.["@_unitCode"]) || undefined,
    unitPriceMinor: toMinorUnits(text(dig(line, "cac:Price", "cbc:PriceAmount"))),
    netAmountMinor: toMinorUnits(text(dig(line, "cbc:LineExtensionAmount"))),
    vatRate: text(dig(line, "cac:Item", "cac:ClassifiedTaxCategory", "cbc:ID")) || undefined,
  }));

  // Parse tax subtotals
  const rawTaxSubtotals = dig(inv, "cac:TaxTotal", "cac:TaxSubtotal") as Record<string, unknown>[] | undefined;
  const taxBreakdown: EInvoiceTaxSubtotal[] = (rawTaxSubtotals ?? []).map((sub) => ({
    taxableAmountMinor: toMinorUnits(text(dig(sub, "cbc:TaxableAmount"))),
    taxAmountMinor: toMinorUnits(text(dig(sub, "cbc:TaxAmount"))),
    taxCategory: text(dig(sub, "cac:TaxCategory", "cbc:ID")),
    percent: dig(sub, "cac:TaxCategory", "cbc:Percent") != null
      ? parseFloat(text(dig(sub, "cac:TaxCategory", "cbc:Percent")))
      : undefined,
  }));

  const taxExclusiveAmount = toMinorUnits(
    text(dig(inv, "cac:LegalMonetaryTotal", "cbc:TaxExclusiveAmount")),
  );
  const taxInclusiveAmount = toMinorUnits(
    text(dig(inv, "cac:LegalMonetaryTotal", "cbc:TaxInclusiveAmount")),
  );
  const payableAmount = toMinorUnits(
    text(dig(inv, "cac:LegalMonetaryTotal", "cbc:PayableAmount")),
  );

  return {
    id: text(dig(inv, "cbc:ID")),
    issueDate: text(dig(inv, "cbc:IssueDate")),
    dueDate: text(dig(inv, "cbc:DueDate")) || undefined,
    invoiceTypeCode: text(dig(inv, "cbc:InvoiceTypeCode")),
    currencyCode: text(dig(inv, "cbc:DocumentCurrencyCode")),
    supplier,
    customer,
    lines,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    taxBreakdown,
    profileId: "peppol-ae",
    externalReference: (metadata?.transmissionId as string) ?? undefined,
    extensions: {
      customizationId: text(dig(inv, "cbc:CustomizationID")),
      profileIdUrn: text(dig(inv, "cbc:ProfileID")),
      buyerReference: text(dig(inv, "cbc:BuyerReference")),
    },
  };
}
