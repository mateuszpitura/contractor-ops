import type { KsefParsedInvoice } from '@contractor-ops/einvoice';
import { ksefParsedInvoiceSchema } from '@contractor-ops/einvoice';
import { XMLParser } from 'fast-xml-parser';

// ---------------------------------------------------------------------------
// FA(3) XML Parser
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
  isArray: name => name === 'FaWiersz',
});

/**
 * Converts a PLN amount (float or string) to minor units (integer).
 * Handles missing/undefined values by returning 0.
 */
function toMinor(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  return Math.round(parseFloat(String(value)) * 100);
}

/**
 * Safely navigates a nested object path, returning undefined if any
 * segment is missing.
 */
function dig(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function computeVatAmount(
  netAmount: number,
  rawVat: unknown,
  vatRateStr: string | undefined,
): number | undefined {
  if (rawVat != null) return toMinor(rawVat);
  if (vatRateStr && !Number.isNaN(parseFloat(vatRateStr))) {
    return Math.round(netAmount * (parseFloat(vatRateStr) / 100));
  }
  return;
}

function parseFa3Line(line: Record<string, unknown>) {
  const netAmount = toMinor(line.P_11);
  const vatRateStr = line.P_12 == null ? undefined : String(line.P_12);
  const vatAmount = computeVatAmount(netAmount, line.P_11A, vatRateStr);
  const grossAmount = vatAmount === undefined ? undefined : netAmount + vatAmount;

  return {
    lineNumber: Number(line.NrWierszaFa ?? 0),
    description: String(line.P_7 ?? ''),
    quantity: line.P_8B == null ? undefined : Number(line.P_8B),
    unit: line.P_8A == null ? undefined : String(line.P_8A),
    unitPriceMinor: line.P_9A == null ? undefined : toMinor(line.P_9A),
    netAmountMinor: netAmount || undefined,
    vatRate: vatRateStr,
    vatAmountMinor: vatAmount,
    grossAmountMinor: grossAmount,
  };
}

function parseFa3Payment(platnosc: Record<string, unknown> | undefined) {
  if (!platnosc) return;

  const bankAccountRaw = platnosc.NrRB ?? dig(platnosc, 'RachunekBankowy', 'NrRB');

  return {
    dueDate: platnosc.TerminPlatnosci == null ? undefined : String(platnosc.TerminPlatnosci),
    bankAccount: bankAccountRaw == null ? undefined : String(bankAccountRaw),
    method: platnosc.FormaPlatnosci == null ? undefined : String(platnosc.FormaPlatnosci),
  };
}

/**
 * Parses a KSeF FA(3) XML string into a validated, typed invoice structure.
 *
 * All monetary amounts are converted to minor units (integer, 1/100 PLN).
 *
 * @param xmlString - Raw FA(3) XML string from KSeF
 * @param ksefReferenceNumber - KSeF reference number from query metadata
 * @param upoNumber - Optional UPO receipt number
 * @returns Zod-validated KsefParsedInvoice
 * @throws ZodError if parsed structure does not match expected schema
 */
function formatAddress(adres: Record<string, unknown> | undefined): string | undefined {
  if (!adres) return;
  return (
    [adres.Ulica, adres.NrDomu, adres.NrLokalu, adres.KodPocztowy, adres.Miejscowosc]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function parsePartyIdent(podmiot: Record<string, unknown>) {
  const ident = (podmiot.DaneIdentyfikacyjne ?? {}) as Record<string, unknown>;
  return {
    nip: String(ident.NIP ?? ''),
    name: String(ident.Nazwa ?? ident.PelnaNazwa ?? ''),
  };
}

function ensureArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw;
  if (raw != null) return [raw as Record<string, unknown>];
  return [];
}

function computeTotals(
  fa: Record<string, unknown>,
  lines: Array<{ netAmountMinor?: number; vatAmountMinor?: number }>,
) {
  const netTotal =
    fa.P_13_1 == null ? lines.reduce((s, l) => s + (l.netAmountMinor ?? 0), 0) : toMinor(fa.P_13_1);
  const vatTotal =
    fa.P_14_1 == null ? lines.reduce((s, l) => s + (l.vatAmountMinor ?? 0), 0) : toMinor(fa.P_14_1);
  const grossTotal = fa.P_15 == null ? netTotal + vatTotal : toMinor(fa.P_15);
  return { netMinor: netTotal, vatMinor: vatTotal, grossMinor: grossTotal };
}

export function parseFa3Xml(
  xmlString: string,
  ksefReferenceNumber: string,
  upoNumber?: string,
): KsefParsedInvoice {
  const parsed = parser.parse(xmlString) as Record<string, unknown>;

  const faktura = (parsed.Faktura ?? parsed['tns:Faktura'] ?? parsed) as Record<string, unknown>;
  const fa = (faktura.Fa ?? {}) as Record<string, unknown>;
  const podmiot1 = (faktura.Podmiot1 ?? {}) as Record<string, unknown>;
  const podmiot2 = (faktura.Podmiot2 ?? {}) as Record<string, unknown>;

  const seller = {
    ...parsePartyIdent(podmiot1),
    address: formatAddress(podmiot1.Adres as Record<string, unknown> | undefined),
  };
  const buyer = parsePartyIdent(podmiot2);
  const lines = ensureArray(fa.FaWiersz).map(parseFa3Line);
  const totals = computeTotals(fa, lines);
  const payment = parseFa3Payment(fa.Platnosc as Record<string, unknown> | undefined);

  return ksefParsedInvoiceSchema.parse({
    invoiceNumber: String(fa.P_2 ?? ''),
    issueDate: String(fa.P_1 ?? ''),
    invoiceType: String(fa.RodzajFaktury ?? 'VAT'),
    currency: String(fa.KodWaluty ?? 'PLN'),
    seller,
    buyer,
    lines,
    totals,
    payment,
    ksefReferenceNumber,
    upoNumber,
  });
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
    source: 'KSEF' as const,
    sourceReference: parsed.upoNumber ?? null,
    issueDate: new Date(parsed.issueDate),
    dueDate: parsed.payment?.dueDate ? new Date(parsed.payment.dueDate) : null,
    currency: parsed.currency,
    subtotalMinor: parsed.totals.netMinor,
    vatRate: primaryVatRate,
    vatAmountMinor: parsed.totals.vatMinor,
    totalMinor: parsed.totals.grossMinor,
    amountToPayMinor: parsed.totals.grossMinor,
    sellerTaxId: parsed.seller.nip,
    sellerName: parsed.seller.name,
    sellerBankAccount: parsed.payment?.bankAccount ?? null,
    buyerTaxId: parsed.buyer.nip,
  };

  const lines = parsed.lines.map(line => ({
    lineNumber: line.lineNumber,
    description: line.description,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    unitPriceMinor: line.unitPriceMinor ?? null,
    netAmountMinor: line.netAmountMinor ?? null,
    vatRate: line.vatRate ?? null,
    vatAmountMinor: line.vatAmountMinor ?? null,
    grossAmountMinor: line.grossAmountMinor ?? null,
  }));

  return { invoice, lines };
}
