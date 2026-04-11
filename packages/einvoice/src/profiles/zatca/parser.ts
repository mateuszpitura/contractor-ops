// ---------------------------------------------------------------------------
// ZATCA UBL 2.1 XML Parser
// ---------------------------------------------------------------------------

import { XMLParser } from "fast-xml-parser";
import type { EInvoice, EInvoiceParty, EInvoiceLine, EInvoiceTaxSubtotal } from "../../types/invoice.js";
import { toMinorUnits } from "../../engine/xml-utils.js";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) =>
    name === "cac:InvoiceLine" ||
    name === "cac:TaxSubtotal" ||
    name === "cac:AdditionalDocumentReference",
});

/**
 * Safely get text content from a parsed XML element that may be a string or an object with #text.
 */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in node) {
    return String((node as Record<string, unknown>)["#text"]);
  }
  return "";
}

/**
 * Parse a ZATCA-generated UBL 2.1 XML string into a canonical EInvoice.
 *
 * Extracts ICV, PIH, UUID from AdditionalDocumentReference into extensions.
 */
export function parseZatcaXml(
  xml: string,
  metadata?: Record<string, unknown>,
): EInvoice {
  const parsed = parser.parse(xml);
  const inv = parsed.Invoice ?? parsed["Invoice"];

  if (!inv) {
    throw new Error("Invalid ZATCA XML: no Invoice root element found");
  }

  // Extract basic fields
  const id = textOf(inv["cbc:ID"]);
  const uuid = textOf(inv["cbc:UUID"]);
  const issueDate = textOf(inv["cbc:IssueDate"]);
  const dueDate = textOf(inv["cbc:DueDate"]) || undefined;
  const invoiceTypeCode = textOf(inv["cbc:InvoiceTypeCode"]);
  const invoiceSubtype =
    inv["cbc:InvoiceTypeCode"]?.["@_name"] ?? undefined;
  const currencyCode = textOf(inv["cbc:DocumentCurrencyCode"]);
  const profileId = textOf(inv["cbc:ProfileID"]);

  // Determine invoice type from ProfileID
  const invoiceType = profileId.includes("reporting")
    ? "simplified"
    : "standard";

  // Extract ICV and PIH from AdditionalDocumentReference
  let icv: number | undefined;
  let pih: string | undefined;
  const additionalRefs = inv["cac:AdditionalDocumentReference"] ?? [];
  const refs = Array.isArray(additionalRefs)
    ? additionalRefs
    : [additionalRefs];

  for (const ref of refs) {
    const refId = textOf(ref["cbc:ID"]);
    if (refId === "ICV") {
      icv = Number(textOf(ref["cbc:UUID"]));
    } else if (refId === "PIH") {
      const encoded = textOf(
        ref["cac:Attachment"]?.["cbc:EmbeddedDocumentBinaryObject"],
      );
      if (encoded) {
        pih = Buffer.from(encoded, "base64").toString("hex");
      }
    }
  }

  // Parse parties
  const supplier = parseParty(inv["cac:AccountingSupplierParty"]);
  const customer = parseParty(inv["cac:AccountingCustomerParty"]);

  // Parse lines
  const rawLines = inv["cac:InvoiceLine"] ?? [];
  const lines: EInvoiceLine[] = (
    Array.isArray(rawLines) ? rawLines : [rawLines]
  ).map(parseLine);

  // Parse tax breakdown
  const taxTotal = inv["cac:TaxTotal"];
  const rawSubtotals = taxTotal?.["cac:TaxSubtotal"] ?? [];
  const taxBreakdown: EInvoiceTaxSubtotal[] = (
    Array.isArray(rawSubtotals) ? rawSubtotals : [rawSubtotals]
  ).map(parseTaxSubtotal);

  // Parse monetary totals
  const monetaryTotal = inv["cac:LegalMonetaryTotal"];
  const taxExclusiveAmount = toMinorUnits(
    textOf(monetaryTotal?.["cbc:TaxExclusiveAmount"]),
  );
  const taxInclusiveAmount = toMinorUnits(
    textOf(monetaryTotal?.["cbc:TaxInclusiveAmount"]),
  );
  const payableAmount = toMinorUnits(
    textOf(monetaryTotal?.["cbc:PayableAmount"]),
  );

  return {
    id,
    issueDate,
    dueDate,
    invoiceTypeCode,
    currencyCode,
    supplier,
    customer,
    lines,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    taxBreakdown,
    profileId: "zatca",
    externalReference: uuid,
    extensions: {
      invoiceType,
      invoiceSubtype,
      icv,
      pih,
      uuid,
      ...(metadata ?? {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseParty(partyWrapper: Record<string, unknown>): EInvoiceParty {
  const party = (partyWrapper as Record<string, unknown>)["cac:Party"] as
    | Record<string, unknown>
    | undefined;

  if (!party) {
    return { id: "", name: "" };
  }

  const taxScheme = party["cac:PartyTaxScheme"] as
    | Record<string, unknown>
    | undefined;
  const legalEntity = party["cac:PartyLegalEntity"] as
    | Record<string, unknown>
    | undefined;
  const postalAddress = party["cac:PostalAddress"] as
    | Record<string, unknown>
    | undefined;

  const id = textOf(taxScheme?.["cbc:CompanyID"]);
  const name = textOf(legalEntity?.["cbc:RegistrationName"]);
  const address = textOf(postalAddress?.["cbc:StreetName"]) || undefined;

  const countryNode = postalAddress?.["cac:Country"] as
    | Record<string, unknown>
    | undefined;
  const country = textOf(countryNode?.["cbc:IdentificationCode"]) || undefined;

  return { id, name, address, country };
}

function parseLine(line: Record<string, unknown>): EInvoiceLine {
  const lineNumber = Number(textOf(line["cbc:ID"]));
  const quantity = Number(textOf(line["cbc:InvoicedQuantity"])) || undefined;
  const unit =
    (line["cbc:InvoicedQuantity"] as Record<string, unknown>)?.["@_unitCode"] as
      | string
      | undefined;
  const netAmountMinor = toMinorUnits(textOf(line["cbc:LineExtensionAmount"]));

  const item = line["cac:Item"] as Record<string, unknown> | undefined;
  const description = textOf(item?.["cbc:Name"]);

  const taxCategory = item?.["cac:ClassifiedTaxCategory"] as
    | Record<string, unknown>
    | undefined;
  const vatRate = textOf(taxCategory?.["cbc:ID"]) || undefined;

  const price = line["cac:Price"] as Record<string, unknown> | undefined;
  const unitPriceMinor = toMinorUnits(textOf(price?.["cbc:PriceAmount"])) || undefined;

  const lineTax = line["cac:TaxTotal"] as Record<string, unknown> | undefined;
  const vatAmountMinor = lineTax
    ? toMinorUnits(textOf(lineTax["cbc:TaxAmount"]))
    : undefined;
  const grossAmountMinor = lineTax
    ? toMinorUnits(textOf(lineTax["cbc:RoundingAmount"])) || undefined
    : undefined;

  return {
    lineNumber,
    description,
    quantity,
    unit,
    unitPriceMinor,
    netAmountMinor,
    vatRate,
    vatAmountMinor,
    grossAmountMinor,
  };
}

function parseTaxSubtotal(sub: Record<string, unknown>): EInvoiceTaxSubtotal {
  const taxableAmountMinor = toMinorUnits(textOf(sub["cbc:TaxableAmount"]));
  const taxAmountMinor = toMinorUnits(textOf(sub["cbc:TaxAmount"]));

  const category = sub["cac:TaxCategory"] as
    | Record<string, unknown>
    | undefined;
  const taxCategory = textOf(category?.["cbc:ID"]);
  const percentStr = textOf(category?.["cbc:Percent"]);
  const percent = percentStr ? Number(percentStr) : undefined;

  return { taxableAmountMinor, taxAmountMinor, taxCategory, percent };
}
