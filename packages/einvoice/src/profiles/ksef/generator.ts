import { XMLBuilder } from "fast-xml-parser";
import type { EInvoice } from "../../types/invoice.js";

// ---------------------------------------------------------------------------
// FA(3) XML Generator
// ---------------------------------------------------------------------------

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  format: true,
  suppressBooleanAttributes: false,
});

/**
 * Map UBL invoice type code back to KSeF type string.
 */
function mapInvoiceType(code: string): string {
  switch (code) {
    case "381":
      return "KOR";
    case "380":
    default:
      return "VAT";
  }
}

/**
 * Convert minor units (integer) to PLN amount string with 2 decimal places.
 */
function fromMinorUnits(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

/**
 * Generates a KSeF FA(3) XML string from a canonical EInvoice.
 *
 * This is the reverse of parseFa3Xml — converts the engine's
 * country-agnostic model back to KSeF's FA(3) schema.
 *
 * @param invoice - Canonical EInvoice to convert
 * @returns Well-formed FA(3) XML string
 */
export function generateFa3Xml(invoice: EInvoice): string {
  const lines = invoice.lines.map((line) => ({
    NrWierszaFa: line.lineNumber,
    P_7: line.description,
    ...(line.quantity != null ? { P_8B: line.quantity } : {}),
    ...(line.unit != null ? { P_8A: line.unit } : {}),
    ...(line.unitPriceMinor != null
      ? { P_9A: fromMinorUnits(line.unitPriceMinor) }
      : {}),
    ...(line.netAmountMinor != null
      ? { P_11: fromMinorUnits(line.netAmountMinor) }
      : {}),
    ...(line.vatRate != null ? { P_12: line.vatRate } : {}),
    ...(line.vatAmountMinor != null
      ? { P_11A: fromMinorUnits(line.vatAmountMinor) }
      : {}),
  }));

  const faktura = {
    Faktura: {
      Podmiot1: {
        DaneIdentyfikacyjne: {
          NIP: invoice.supplier.id,
          Nazwa: invoice.supplier.name,
        },
        ...(invoice.supplier.address
          ? {
              Adres: {
                Ulica: invoice.supplier.address,
              },
            }
          : {}),
      },
      Podmiot2: {
        DaneIdentyfikacyjne: {
          NIP: invoice.customer.id,
          Nazwa: invoice.customer.name,
        },
      },
      Fa: {
        P_1: invoice.issueDate,
        P_2: invoice.id,
        RodzajFaktury: mapInvoiceType(invoice.invoiceTypeCode),
        KodWaluty: invoice.currencyCode,
        FaWiersz: lines,
        P_13_1: fromMinorUnits(invoice.taxExclusiveAmount),
        P_14_1: fromMinorUnits(
          invoice.taxInclusiveAmount - invoice.taxExclusiveAmount,
        ),
        P_15: fromMinorUnits(invoice.taxInclusiveAmount),
        ...(invoice.paymentMeans
          ? {
              Platnosc: {
                ...(invoice.paymentMeans.dueDate
                  ? { TerminPlatnosci: invoice.paymentMeans.dueDate }
                  : {}),
                ...(invoice.paymentMeans.bankAccount
                  ? { NrRB: invoice.paymentMeans.bankAccount }
                  : {}),
              },
            }
          : {}),
      },
    },
  };

  return builder.build(faktura) as string;
}
