// ---------------------------------------------------------------------------
// PINT-AE UBL 2.1 XML Generator
// ---------------------------------------------------------------------------

import { XMLBuilder } from "fast-xml-parser";
import type { EInvoice } from "../../types/invoice.js";
import {
  PINT_AE_CUSTOMIZATION_ID,
  PINT_AE_PROFILE_ID,
  UAE_SCHEME_ID,
  UBL_INVOICE_NS,
  CBC_NS,
  CAC_NS,
  UAE_TAX_SCHEME_ID,
} from "./constants.js";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  format: true,
  suppressBooleanAttributes: false,
});

/**
 * Convert minor units (integer) to amount string with 2 decimal places.
 */
function fromMinor(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Build a UBL party structure for PINT-AE.
 */
function buildParty(
  party: EInvoice["supplier"],
  currencyCode: string,
) {
  return {
    "cac:Party": {
      "cac:PartyIdentification": {
        "cbc:ID": {
          "@_schemeID": UAE_SCHEME_ID,
          "#text": party.id,
        },
      },
      ...(party.additionalIds?.tradeLicense
        ? {
            "cac:PartyLegalEntity": {
              "cbc:RegistrationName": party.name,
              "cbc:CompanyID": party.additionalIds.tradeLicense,
            },
          }
        : {
            "cac:PartyLegalEntity": {
              "cbc:RegistrationName": party.name,
            },
          }),
      "cac:PartyName": {
        "cbc:Name": party.name,
      },
      ...(party.address || party.country
        ? {
            "cac:PostalAddress": {
              ...(party.address
                ? { "cbc:StreetName": party.address }
                : {}),
              ...(party.country
                ? {
                    "cac:Country": {
                      "cbc:IdentificationCode": party.country,
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
  };
}

/**
 * Generates a PINT-AE compliant UBL 2.1 Invoice XML from a canonical EInvoice.
 */
export function generatePintAeXml(invoice: EInvoice): string {
  const taxSubtotals = invoice.taxBreakdown.map((tax) => ({
    "cbc:TaxableAmount": {
      "@_currencyID": invoice.currencyCode,
      "#text": fromMinor(tax.taxableAmountMinor),
    },
    "cbc:TaxAmount": {
      "@_currencyID": invoice.currencyCode,
      "#text": fromMinor(tax.taxAmountMinor),
    },
    "cac:TaxCategory": {
      "cbc:ID": tax.taxCategory,
      ...(tax.percent != null
        ? { "cbc:Percent": tax.percent.toString() }
        : {}),
      "cac:TaxScheme": {
        "cbc:ID": UAE_TAX_SCHEME_ID,
      },
    },
  }));

  const totalTaxAmount = invoice.taxBreakdown.reduce(
    (sum, t) => sum + t.taxAmountMinor,
    0,
  );

  const invoiceLines = invoice.lines.map((line) => ({
    "cbc:ID": String(line.lineNumber),
    "cbc:InvoicedQuantity": {
      "@_unitCode": line.unit ?? "EA",
      "#text": String(line.quantity ?? 1),
    },
    "cbc:LineExtensionAmount": {
      "@_currencyID": invoice.currencyCode,
      "#text": fromMinor(line.netAmountMinor ?? 0),
    },
    "cac:Item": {
      "cbc:Name": line.description,
      ...(line.vatRate
        ? {
            "cac:ClassifiedTaxCategory": {
              "cbc:ID": line.vatRate,
              "cac:TaxScheme": {
                "cbc:ID": UAE_TAX_SCHEME_ID,
              },
            },
          }
        : {}),
    },
    "cac:Price": {
      "cbc:PriceAmount": {
        "@_currencyID": invoice.currencyCode,
        "#text": fromMinor(line.unitPriceMinor ?? line.netAmountMinor ?? 0),
      },
    },
  }));

  const buyerReference =
    (invoice.extensions?.buyerReference as string) ?? invoice.customer.id;

  const doc = {
    Invoice: {
      "@_xmlns": UBL_INVOICE_NS,
      "@_xmlns:cac": CAC_NS,
      "@_xmlns:cbc": CBC_NS,
      "cbc:CustomizationID": PINT_AE_CUSTOMIZATION_ID,
      "cbc:ProfileID": PINT_AE_PROFILE_ID,
      "cbc:ID": invoice.id,
      "cbc:IssueDate": invoice.issueDate,
      ...(invoice.dueDate
        ? { "cbc:DueDate": invoice.dueDate }
        : {}),
      "cbc:InvoiceTypeCode": invoice.invoiceTypeCode,
      "cbc:DocumentCurrencyCode": invoice.currencyCode,
      "cbc:BuyerReference": buyerReference,
      "cac:AccountingSupplierParty": buildParty(
        invoice.supplier,
        invoice.currencyCode,
      ),
      "cac:AccountingCustomerParty": buildParty(
        invoice.customer,
        invoice.currencyCode,
      ),
      ...(invoice.paymentMeans
        ? {
            "cac:PaymentMeans": {
              ...(invoice.paymentMeans.code
                ? { "cbc:PaymentMeansCode": invoice.paymentMeans.code }
                : {}),
              ...(invoice.paymentMeans.dueDate
                ? {
                    "cbc:PaymentDueDate":
                      invoice.paymentMeans.dueDate,
                  }
                : {}),
              ...(invoice.paymentMeans.paymentReference
                ? {
                    "cbc:PaymentID":
                      invoice.paymentMeans.paymentReference,
                  }
                : {}),
              ...(invoice.paymentMeans.bankAccount
                ? {
                    "cac:PayeeFinancialAccount": {
                      "cbc:ID": invoice.paymentMeans.bankAccount,
                      ...(invoice.paymentMeans.bankName
                        ? {
                            "cac:FinancialInstitutionBranch": {
                              "cbc:Name":
                                invoice.paymentMeans.bankName,
                            },
                          }
                        : {}),
                    },
                  }
                : {}),
            },
          }
        : {}),
      "cac:TaxTotal": {
        "cbc:TaxAmount": {
          "@_currencyID": invoice.currencyCode,
          "#text": fromMinor(totalTaxAmount),
        },
        "cac:TaxSubtotal": taxSubtotals,
      },
      "cac:LegalMonetaryTotal": {
        "cbc:TaxExclusiveAmount": {
          "@_currencyID": invoice.currencyCode,
          "#text": fromMinor(invoice.taxExclusiveAmount),
        },
        "cbc:TaxInclusiveAmount": {
          "@_currencyID": invoice.currencyCode,
          "#text": fromMinor(invoice.taxInclusiveAmount),
        },
        "cbc:PayableAmount": {
          "@_currencyID": invoice.currencyCode,
          "#text": fromMinor(invoice.payableAmount),
        },
      },
      "cac:InvoiceLine": invoiceLines,
    },
  };

  return builder.build(doc) as string;
}
