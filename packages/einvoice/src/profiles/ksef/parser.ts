import { XMLParser } from 'fast-xml-parser';
import { dig, toMinorUnits } from '../../engine/xml-utils.js';
import type { KsefParsedInvoice } from './schemas.js';
import { ksefParsedInvoiceSchema } from './schemas.js';

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

// ---------------------------------------------------------------------------
// Per-field helpers
// ---------------------------------------------------------------------------

function computeVatFromRate(
  netAmountMinor: number,
  vatRateStr: string | undefined,
): number | undefined {
  if (!vatRateStr || Number.isNaN(parseFloat(vatRateStr))) return;
  return Math.round(netAmountMinor * (parseFloat(vatRateStr) / 100));
}

/**
 * FA(3) line amounts: P_11 = net, P_11A = gross (kwota brutto), P_11Vat = VAT when present.
 * P_11A is NOT a VAT amount — treating it as VAT double-counts on inbound KSeF sync.
 */
function parseFa3Line(line: Record<string, unknown>) {
  const netAmount = toMinorUnits(line.P_11);
  const vatRateStr = line.P_12 == null ? undefined : String(line.P_12);
  const grossFromField = line.P_11A == null ? undefined : toMinorUnits(line.P_11A);
  const vatFromField = line.P_11Vat == null ? undefined : toMinorUnits(line.P_11Vat);

  let vatAmount: number | undefined;
  let grossAmount: number | undefined;

  if (vatFromField != null) {
    vatAmount = vatFromField;
    grossAmount = grossFromField ?? (netAmount ? netAmount + vatFromField : undefined);
  } else if (grossFromField != null && netAmount) {
    const derived = grossFromField - netAmount;
    // KOR lines are negative throughout, so VAT must carry the net's sign; a sign
    // mismatch means P_11A held something other than gross (legacy emitters put VAT there).
    if (derived === 0 || Math.sign(derived) === Math.sign(netAmount)) {
      grossAmount = grossFromField;
      vatAmount = derived;
    } else {
      vatAmount = computeVatFromRate(netAmount, vatRateStr);
      grossAmount = vatAmount === undefined ? undefined : netAmount + vatAmount;
    }
  } else {
    vatAmount = computeVatFromRate(netAmount, vatRateStr);
    grossAmount = vatAmount === undefined ? undefined : netAmount + vatAmount;
  }

  return {
    lineNumber: Number(line.NrWierszaFa ?? 0),
    description: String(line.P_7 ?? ''),
    quantity: line.P_8B == null ? undefined : Number(line.P_8B),
    unit: line.P_8A == null ? undefined : String(line.P_8A),
    unitPriceMinor: line.P_9A == null ? undefined : toMinorUnits(line.P_9A),
    netAmountMinor: netAmount || undefined,
    vatRate: vatRateStr,
    vatAmountMinor: vatAmount,
    grossAmountMinor: grossAmount,
  };
}

function parseFa3Payment(platnosc: Record<string, unknown> | undefined) {
  if (!platnosc) return;

  const bankAccountRaw =
    platnosc.NrRB ?? dig(platnosc as Record<string, unknown>, 'RachunekBankowy', 'NrRB');

  return {
    dueDate: platnosc.TerminPlatnosci == null ? undefined : String(platnosc.TerminPlatnosci),
    bankAccount: bankAccountRaw == null ? undefined : String(bankAccountRaw),
    method: platnosc.FormaPlatnosci == null ? undefined : String(platnosc.FormaPlatnosci),
  };
}

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

function sumFaHeaderMinor(
  fa: Record<string, unknown>,
  prefix: 'P_13' | 'P_14',
): number | undefined {
  let sum = 0;
  let found = false;
  for (let band = 1; band <= 5; band += 1) {
    const key = `${prefix}_${band}`;
    if (fa[key] != null) {
      sum += toMinorUnits(fa[key]);
      found = true;
    }
  }
  return found ? sum : undefined;
}

function computeTotals(
  fa: Record<string, unknown>,
  lines: Array<{ netAmountMinor?: number; vatAmountMinor?: number }>,
) {
  const netTotal =
    sumFaHeaderMinor(fa, 'P_13') ?? lines.reduce((s, l) => s + (l.netAmountMinor ?? 0), 0);
  const vatTotal =
    sumFaHeaderMinor(fa, 'P_14') ?? lines.reduce((s, l) => s + (l.vatAmountMinor ?? 0), 0);
  const grossTotal = fa.P_15 == null ? netTotal + vatTotal : toMinorUnits(fa.P_15);
  return { netMinor: netTotal, vatMinor: vatTotal, grossMinor: grossTotal };
}

/**
 * Parses a KSeF FA(3) XML string into a validated, typed invoice structure.
 *
 * All monetary amounts are converted from PLN to minor units (integer, 1/100 PLN).
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
