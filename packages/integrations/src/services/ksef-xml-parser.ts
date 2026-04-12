import type { KsefParsedInvoice } from "@contractor-ops/einvoice";
import { ksefParsedInvoiceSchema } from "@contractor-ops/einvoice";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// FA(3) XML Parser
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => name === "FaWiersz",
});

/**
 * Converts a PLN amount (float or string) to grosze (integer).
 * Handles missing/undefined values by returning 0.
 */
function toGrosze(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  return Math.round(parseFloat(String(value)) * 100);
}

/**
 * Safely navigates a nested object path, returning undefined if any
 * segment is missing.
 */
function dig(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Parses a KSeF FA(3) XML string into a validated, typed invoice structure.
 *
 * All monetary amounts are converted from PLN to grosze (integer, 1/100 PLN).
 *
 * @param xmlString - Raw FA(3) XML string from KSeF
 * @param ksefReferenceNumber - KSeF reference number from query metadata
 * @param upoNumber - Optional UPO receipt number
 * @returns Zod-validated KsefParsedInvoice
 * @throws ZodError if parsed structure does not match expected schema
 */
export function parseFa3Xml(
  xmlString: string,
  ksefReferenceNumber: string,
  upoNumber?: string,
): KsefParsedInvoice {
  const parsed = parser.parse(xmlString) as Record<string, unknown>;

  // Root element — handle namespace prefix variations
  const faktura = (parsed["Faktura"] ?? parsed["tns:Faktura"] ?? parsed) as Record<string, unknown>;
  const fa = (faktura["Fa"] ?? {}) as Record<string, unknown>;
  const podmiot1 = (faktura["Podmiot1"] ?? {}) as Record<string, unknown>;
  const podmiot2 = (faktura["Podmiot2"] ?? {}) as Record<string, unknown>;

  // Seller
  const sellerIdent = (podmiot1["DaneIdentyfikacyjne"] ?? {}) as Record<string, unknown>;
  const sellerAddress = podmiot1["Adres"] as Record<string, unknown> | undefined;
  const sellerAddressStr = sellerAddress
    ? [
        sellerAddress["Ulica"],
        sellerAddress["NrDomu"],
        sellerAddress["NrLokalu"],
        sellerAddress["KodPocztowy"],
        sellerAddress["Miejscowosc"],
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;

  // Buyer
  const buyerIdent = (podmiot2["DaneIdentyfikacyjne"] ?? {}) as Record<string, unknown>;

  // Line items — ensure array
  const rawLines = fa["FaWiersz"] as Record<string, unknown>[] | undefined;
  const linesArray = Array.isArray(rawLines) ? rawLines : rawLines ? [rawLines] : [];

  const lines = linesArray.map((line) => {
    const netAmount = toGrosze(line["P_11"]);
    const vatRateStr = line["P_12"] != null ? String(line["P_12"]) : undefined;
    const vatAmount =
      line["P_11A"] != null
        ? toGrosze(line["P_11A"])
        : vatRateStr && !Number.isNaN(parseFloat(vatRateStr))
          ? Math.round(netAmount * (parseFloat(vatRateStr) / 100))
          : undefined;
    const grossAmount = vatAmount !== undefined ? netAmount + vatAmount : undefined;

    return {
      lineNumber: Number(line["NrWierszaFa"] ?? 0),
      description: String(line["P_7"] ?? ""),
      quantity: line["P_8B"] != null ? Number(line["P_8B"]) : undefined,
      unit: line["P_8A"] != null ? String(line["P_8A"]) : undefined,
      unitPriceMinor: line["P_9A"] != null ? toGrosze(line["P_9A"]) : undefined,
      netAmountMinor: netAmount || undefined,
      vatRate: vatRateStr,
      vatAmountMinor: vatAmount,
      grossAmountMinor: grossAmount,
    };
  });

  // Totals
  const netTotal =
    fa["P_13_1"] != null
      ? toGrosze(fa["P_13_1"])
      : lines.reduce((s, l) => s + (l.netAmountGrosze ?? 0), 0);
  const vatTotal =
    fa["P_14_1"] != null
      ? toGrosze(fa["P_14_1"])
      : lines.reduce((s, l) => s + (l.vatAmountGrosze ?? 0), 0);
  const grossTotal = fa["P_15"] != null ? toGrosze(fa["P_15"]) : netTotal + vatTotal;

  // Payment info
  const platnosc = fa["Platnosc"] as Record<string, unknown> | undefined;
  const payment = platnosc
    ? {
        dueDate:
          platnosc["TerminPlatnosci"] != null ? String(platnosc["TerminPlatnosci"]) : undefined,
        bankAccount:
          (platnosc["NrRB"] ?? dig(platnosc, "RachunekBankowy", "NrRB")) != null
            ? String(platnosc["NrRB"] ?? dig(platnosc, "RachunekBankowy", "NrRB"))
            : undefined,
        method: platnosc["FormaPlatnosci"] != null ? String(platnosc["FormaPlatnosci"]) : undefined,
      }
    : undefined;

  const mapped = {
    invoiceNumber: String(fa["P_2"] ?? ""),
    issueDate: String(fa["P_1"] ?? ""),
    invoiceType: String(fa["RodzajFaktury"] ?? "VAT"),
    currency: String(fa["KodWaluty"] ?? "PLN"),
    seller: {
      nip: String(sellerIdent["NIP"] ?? ""),
      name: String(sellerIdent["Nazwa"] ?? sellerIdent["PelnaNazwa"] ?? ""),
      address: sellerAddressStr || undefined,
    },
    buyer: {
      nip: String(buyerIdent["NIP"] ?? ""),
      name: String(buyerIdent["Nazwa"] ?? buyerIdent["PelnaNazwa"] ?? ""),
    },
    lines,
    totals: {
      netMinor: netTotal,
      vatMinor: vatTotal,
      grossMinor: grossTotal,
    },
    payment,
    ksefReferenceNumber,
    upoNumber,
  };

  return ksefParsedInvoiceSchema.parse(mapped);
}

// ---------------------------------------------------------------------------
// Invoice Model Mapper
// ---------------------------------------------------------------------------

/**
 * Maps a parsed KSeF invoice to fields matching the Invoice/InvoiceLine
 * Prisma models for database insertion.
 */
export function mapKsefToInvoiceFields(parsed: KsefParsedInvoice) {
  // Derive primary VAT rate from lines (most common rate)
  const vatRateCounts = new Map<string, number>();
  for (const line of parsed.lines) {
    if (line.vatRate) {
      vatRateCounts.set(line.vatRate, (vatRateCounts.get(line.vatRate) ?? 0) + 1);
    }
  }
  let primaryVatRate: string | null = null;
  let maxCount = 0;
  for (const [rate, count] of vatRateCounts) {
    if (count > maxCount) {
      maxCount = count;
      primaryVatRate = rate;
    }
  }

  const invoice = {
    invoiceNumber: parsed.invoiceNumber,
    externalInvoiceId: parsed.ksefReferenceNumber,
    source: "KSEF" as const,
    sourceReference: parsed.upoNumber ?? null,
    issueDate: new Date(parsed.issueDate),
    dueDate: parsed.payment?.dueDate ? new Date(parsed.payment.dueDate) : null,
    currency: parsed.currency,
    subtotalGrosze: parsed.totals.netMinor,
    vatRate: primaryVatRate,
    vatAmountGrosze: parsed.totals.vatMinor,
    totalGrosze: parsed.totals.grossMinor,
    amountToPayGrosze: parsed.totals.grossMinor,
    sellerTaxId: parsed.seller.nip,
    sellerName: parsed.seller.name,
    sellerBankAccount: parsed.payment?.bankAccount ?? null,
    buyerTaxId: parsed.buyer.nip,
  };

  const lines = parsed.lines.map((line) => ({
    lineNumber: line.lineNumber,
    description: line.description,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unitPriceGrosze: line.unitPriceMinor ?? null,
    netAmountGrosze: line.netAmountMinor ?? null,
    vatRate: line.vatRate ?? null,
    vatAmountGrosze: line.vatAmountMinor ?? null,
    grossAmountGrosze: line.grossAmountMinor ?? null,
  }));

  return { invoice, lines };
}
