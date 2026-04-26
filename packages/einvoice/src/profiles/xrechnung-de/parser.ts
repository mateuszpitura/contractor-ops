// Phase 62 · Plan 62-02 Task 4 — XRechnung CII inbound parser.
//
// Inverse of generator.ts: walks a CII Cross-Industry-Invoice document and
// maps it back into the canonical `EInvoice` envelope plus a typed
// `ParsedXrechnung` wrapper carrying profile-level detection + warnings +
// unmapped-field paths.
//
// Called by:
//   * `profiles/xrechnung-de/index.ts::XRechnungDEProfile.parse()` — directly
//     returns the `.invoice` half for the EInvoiceProfile contract.
//   * `profiles/zugferd-de/parser.ts::parseZugferdPdf()` — delegates the XML
//     extracted from `factur-x.xml` into this parser, surfacing the full
//     typed wrapper (profile level + warnings) to the intake pipeline.
//
// Design notes:
//   - fast-xml-parser is used with `removeNSPrefix: false` so the CII tree is
//     navigated by the exact `rsm:` / `ram:` / `udt:` prefix shapes the
//     generator emits. This keeps parser ↔ generator symmetry obvious at the
//     call-site level and is the only way to disambiguate aggregates that
//     share local names across namespaces.
//   - We hard-fail on any URN the ZUGFeRD level map does not recognise
//     (`ZUGFERD_LEVEL_UNSUPPORTED`). This prevents silently round-tripping a
//     MINIMUM or BASIC-WL ZUGFeRD invoice through our COMFORT-shaped envelope
//     and writing lossy data into the intake staging table.
//   - XSD shape violations are *not* this parser's job — Phase 61's
//     KoSIT validator owns layer-1 XSD. We do, however, emit
//     `CII_PARSE_FAILED` when the XML itself is malformed (fast-xml-parser
//     throws during tree construction).
//   - Logging uses the shared Pino root logger via `.child({ module: ... })`.
//     Never `console.*` — enforced by repo-wide guard.
//
// Threats mitigated:
//   * T-62-02-01 (semantic drift on round-trip): round-trip test asserts
//     `parse(generate(invoice))` returns a JSON-equal envelope.
//   * T-62-02-02 (unsupported-level passthrough): hard throw + typed error.
//   * T-62-02-03 (BOM parse failure): UTF-8 BOM is stripped before parsing.

import { createLogger } from '@contractor-ops/logger';
import { XMLParser } from 'fast-xml-parser';

import type {
  EInvoice,
  EInvoiceLine,
  EInvoiceParty,
  EInvoiceTaxSubtotal,
} from '../../types/invoice.js';
import type { ZugferdConformanceLevel } from '../zugferd-de/constants.js';
import {
  GUIDELINE_URN_TO_LEVEL,
  UNSUPPORTED_GUIDELINE_URNS,
  ZUGFERD_DE_PROFILE_ID,
} from '../zugferd-de/constants.js';
import { XRECHNUNG_DE_PROFILE_ID } from './constants.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Non-fatal diagnostic surfaced during parsing. */
export interface ParserWarning {
  code: 'LEVEL_EXTENDED_BEST_EFFORT' | 'UNMAPPED_FIELD' | 'AMBIGUOUS_TAX_CATEGORY';
  message: string;
  path?: string;
}

/** Return shape of `parseXrechnungCii`. */
export interface ParsedXrechnung {
  invoice: EInvoice;
  profileLevel: ZugferdConformanceLevel;
  warnings: ParserWarning[];
  unmappedFields: string[];
}

/**
 * Discriminated union of typed errors thrown by the parser.
 * Callers should inspect `.code` and react accordingly.
 */
export type ParserError =
  | { code: 'CII_PARSE_FAILED'; message: string }
  | { code: 'ZUGFERD_LEVEL_UNSUPPORTED'; level: string };

// ---------------------------------------------------------------------------
// XMLParser configuration
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false, // keep all values as strings — we coerce explicitly
  trimValues: true,
  removeNSPrefix: false,
  // Force these aggregates to be arrays even when only one element exists.
  // CII allows 1..N IncludedSupplyChainTradeLineItem and 0..N ApplicableTradeTax;
  // fast-xml-parser otherwise collapses a single child into a scalar object.
  isArray: (name: string) => {
    return name === 'ram:IncludedSupplyChainTradeLineItem' || name === 'ram:ApplicableTradeTax';
  },
});

const log = createLogger({ module: 'xrechnung-de/parser' });

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Strip UTF-8 (BOM 0xFEFF as string codepoint \uFEFF) prefix. */
function stripBom(input: string): string {
  if (input.length === 0) return input;
  // UTF-8 BOM decodes to \uFEFF when the source bytes were 0xEF 0xBB 0xBF.
  if (input.charCodeAt(0) === 0xfeff) return input.slice(1);
  return input;
}

/** Parse a BigDecimal string (e.g. "1190.00") back to an integer minor-units value. */
function toMinorUnits(value: unknown): number {
  if (value == null) return 0;
  const str = typeof value === 'string' ? value : String(value);
  const trimmed = str.trim();
  if (trimmed === '') return 0;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: `Invalid decimal value in CII document: "${trimmed}"`,
    } satisfies ParserError;
  }
  // Integer-string round: split on decimal point so precision is preserved.
  const negative = trimmed.startsWith('-');
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPart = '0', fracPartRaw = ''] = abs.split('.');
  const fracPart = `${fracPartRaw}00`.slice(0, 2);
  const minor = Number(intPart) * 100 + Number(fracPart);
  return negative ? -minor : minor;
}

/** Convert a CII format="102" YYYYMMDD date string to ISO YYYY-MM-DD. */
function fromCiiDate(value: unknown): string {
  if (value == null) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: 'Missing date value in CII document',
    } satisfies ParserError;
  }
  const str = typeof value === 'string' ? value.trim() : String(value);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  throw {
    code: 'CII_PARSE_FAILED',
    message: `Unrecognised CII date format: "${str}" (expected YYYYMMDD)`,
  } satisfies ParserError;
}

/**
 * Extract the text content of a node that may be either a string or an
 * aggregate that wraps its text in `#text` (when attributes are present).
 */
function nodeText(value: unknown): string | undefined {
  if (value == null) return;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (typeof rec['#text'] === 'string') return rec['#text'];
    if (typeof rec['#text'] === 'number') return String(rec['#text']);
  }
  return;
}

/** Read `udt:DateTimeString` inside a date wrapper element. */
function readDate(wrapper: Record<string, unknown> | undefined): string | undefined {
  if (!wrapper) return;
  const udt = wrapper['udt:DateTimeString'];
  if (!udt) return;
  const text = nodeText(udt);
  if (text == null) return;
  return fromCiiDate(text);
}

// ---------------------------------------------------------------------------
// Party mapping
// ---------------------------------------------------------------------------

function parseParty(
  raw: Record<string, unknown> | undefined,
  unmapped: Set<string>,
  basePath: string,
): EInvoiceParty {
  if (!raw) {
    return { id: '', name: '' };
  }
  const name = nodeText(raw['ram:Name']) ?? '';
  const legalOrg = raw['ram:SpecifiedLegalOrganization'] as Record<string, unknown> | undefined;
  const id = nodeText(legalOrg?.['ram:ID']) ?? '';

  const postal = raw['ram:PostalTradeAddress'] as Record<string, unknown> | undefined;
  const address = postal ? nodeText(postal['ram:LineOne']) : undefined;
  const country = postal ? nodeText(postal['ram:CountryID']) : undefined;

  // Note any sibling keys we don't map so callers can surface them.
  const mappedKeys = new Set([
    'ram:Name',
    'ram:SpecifiedLegalOrganization',
    'ram:PostalTradeAddress',
    // Non-canonical decoration we intentionally ignore on round-trip:
    'ram:DefinedTradeContact',
    'ram:URIUniversalCommunication',
    'ram:SpecifiedTaxRegistration',
  ]);
  for (const key of Object.keys(raw)) {
    if (!mappedKeys.has(key)) unmapped.add(`${basePath}/${key}`);
  }

  return {
    id,
    name,
    ...(address == null ? {} : { address }),
    ...(country == null ? {} : { country }),
  };
}

// ---------------------------------------------------------------------------
// Line-item mapping
// ---------------------------------------------------------------------------

function parseLine(
  raw: Record<string, unknown>,
  unmapped: Set<string>,
  basePath: string,
): EInvoiceLine {
  const assoc = raw['ram:AssociatedDocumentLineDocument'] as Record<string, unknown> | undefined;
  const lineIdText = nodeText(assoc?.['ram:LineID']);
  const lineNumber = lineIdText == null ? 0 : Number(lineIdText);

  const product = raw['ram:SpecifiedTradeProduct'] as Record<string, unknown> | undefined;
  const description = nodeText(product?.['ram:Name']) ?? '';

  const lineAgreement = raw['ram:SpecifiedLineTradeAgreement'] as
    | Record<string, unknown>
    | undefined;
  const netPrice = lineAgreement?.['ram:NetPriceProductTradePrice'] as
    | Record<string, unknown>
    | undefined;
  const unitPriceText = netPrice ? nodeText(netPrice['ram:ChargeAmount']) : undefined;
  const unitPriceMinor = unitPriceText == null ? undefined : toMinorUnits(unitPriceText);

  const lineDelivery = raw['ram:SpecifiedLineTradeDelivery'] as Record<string, unknown> | undefined;
  const billedQty = lineDelivery?.['ram:BilledQuantity'] as
    | Record<string, unknown>
    | string
    | undefined;
  let quantity: number | undefined;
  let unit: string | undefined;
  if (typeof billedQty === 'object' && billedQty != null) {
    const qtyText = nodeText(billedQty);
    if (qtyText != null) quantity = Number(qtyText);
    const unitCode = (billedQty as Record<string, unknown>)['@_unitCode'];
    if (typeof unitCode === 'string') unit = unitCode;
  } else if (billedQty != null) {
    quantity = Number(billedQty);
  }

  const lineSettlement = raw['ram:SpecifiedLineTradeSettlement'] as
    | Record<string, unknown>
    | undefined;
  const tradeTax = lineSettlement?.['ram:ApplicableTradeTax'] as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const firstTax = Array.isArray(tradeTax) ? tradeTax[0] : tradeTax;
  const vatRate = firstTax ? nodeText(firstTax['ram:RateApplicablePercent']) : undefined;

  const lineMonSum = lineSettlement?.['ram:SpecifiedTradeSettlementLineMonetarySummation'] as
    | Record<string, unknown>
    | undefined;
  const lineTotalText = lineMonSum ? nodeText(lineMonSum['ram:LineTotalAmount']) : undefined;
  const netAmountMinor = lineTotalText == null ? undefined : toMinorUnits(lineTotalText);

  // Record unmapped sibling paths for downstream surface.
  const mappedTopKeys = new Set([
    'ram:AssociatedDocumentLineDocument',
    'ram:SpecifiedTradeProduct',
    'ram:SpecifiedLineTradeAgreement',
    'ram:SpecifiedLineTradeDelivery',
    'ram:SpecifiedLineTradeSettlement',
  ]);
  for (const key of Object.keys(raw)) {
    if (!mappedTopKeys.has(key)) unmapped.add(`${basePath}/${key}`);
  }

  return {
    lineNumber,
    description,
    ...(quantity == null ? {} : { quantity }),
    ...(unit == null ? {} : { unit }),
    ...(unitPriceMinor == null ? {} : { unitPriceMinor }),
    ...(netAmountMinor == null ? {} : { netAmountMinor }),
    ...(vatRate == null ? {} : { vatRate }),
  };
}

// ---------------------------------------------------------------------------
// Tax breakdown mapping
// ---------------------------------------------------------------------------

function parseTaxSubtotal(raw: Record<string, unknown>): EInvoiceTaxSubtotal {
  const taxableText = nodeText(raw['ram:BasisAmount']);
  const taxText = nodeText(raw['ram:CalculatedAmount']);
  const categoryCode = nodeText(raw['ram:CategoryCode']) ?? 'S';
  const percentText = nodeText(raw['ram:RateApplicablePercent']);

  const base: EInvoiceTaxSubtotal = {
    taxableAmountMinor: taxableText == null ? 0 : toMinorUnits(taxableText),
    taxAmountMinor: taxText == null ? 0 : toMinorUnits(taxText),
    taxCategory: categoryCode,
  };

  if (percentText != null && percentText !== '') {
    const percent = Number(percentText);
    if (Number.isFinite(percent)) base.percent = percent;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Profile level detection
// ---------------------------------------------------------------------------

function detectProfileLevel(guidelineUrn: string | undefined): ZugferdConformanceLevel {
  if (guidelineUrn == null || guidelineUrn === '') {
    throw {
      code: 'ZUGFERD_LEVEL_UNSUPPORTED',
      level: '(missing GuidelineSpecifiedDocumentContextParameter/ram:ID)',
    } satisfies ParserError;
  }

  if (UNSUPPORTED_GUIDELINE_URNS.has(guidelineUrn)) {
    throw {
      code: 'ZUGFERD_LEVEL_UNSUPPORTED',
      level: guidelineUrn,
    } satisfies ParserError;
  }

  const level = GUIDELINE_URN_TO_LEVEL[guidelineUrn];
  if (level == null) {
    throw {
      code: 'ZUGFERD_LEVEL_UNSUPPORTED',
      level: guidelineUrn,
    } satisfies ParserError;
  }

  return level;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an XRechnung / ZUGFeRD Cross-Industry-Invoice XML string into the
 * canonical `EInvoice` envelope plus a profile-level + warnings wrapper.
 *
 * @throws {ParserError} When XML is malformed (`CII_PARSE_FAILED`) or when
 *   the declared guideline URN is in the unsupported-levels set
 *   (`ZUGFERD_LEVEL_UNSUPPORTED`). The thrown object is a plain JSON shape;
 *   callers must `try/catch` and inspect `.code`.
 */
export function parseXrechnungCii(xml: string): ParsedXrechnung {
  const stripped = stripBom(xml);

  let tree: Record<string, unknown>;
  try {
    tree = xmlParser.parse(stripped) as Record<string, unknown>;
  } catch (err) {
    log.warn({ err }, 'Failed to parse CII XML');
    throw {
      code: 'CII_PARSE_FAILED',
      message: err instanceof Error ? err.message : String(err),
    } satisfies ParserError;
  }

  const root = tree['rsm:CrossIndustryInvoice'] as Record<string, unknown> | undefined;
  if (!root) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: 'Missing rsm:CrossIndustryInvoice root element',
    } satisfies ParserError;
  }

  // --- Context: guideline URN → profile level -----------------------------
  const context = root['rsm:ExchangedDocumentContext'] as Record<string, unknown> | undefined;
  const guideline = context?.['ram:GuidelineSpecifiedDocumentContextParameter'] as
    | Record<string, unknown>
    | undefined;
  const guidelineUrn = nodeText(guideline?.['ram:ID']);
  const profileLevel = detectProfileLevel(guidelineUrn);

  const warnings: ParserWarning[] = [];
  const unmapped = new Set<string>();

  if (profileLevel === 'EXTENDED') {
    warnings.push({
      code: 'LEVEL_EXTENDED_BEST_EFFORT',
      message:
        'EXTENDED profile — some fields may be unmapped (best-effort mapping to canonical envelope)',
    });
  }

  // --- Exchanged document header ------------------------------------------
  const exchanged = root['rsm:ExchangedDocument'] as Record<string, unknown> | undefined;
  const invoiceId = nodeText(exchanged?.['ram:ID']) ?? '';
  const invoiceTypeCode = nodeText(exchanged?.['ram:TypeCode']) ?? '380';
  const issueDate = readDate(
    exchanged?.['ram:IssueDateTime'] as Record<string, unknown> | undefined,
  );
  if (issueDate == null) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: 'Missing rsm:ExchangedDocument/ram:IssueDateTime',
    } satisfies ParserError;
  }

  // --- Trade transaction --------------------------------------------------
  const trade = root['rsm:SupplyChainTradeTransaction'] as Record<string, unknown> | undefined;
  if (!trade) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: 'Missing rsm:SupplyChainTradeTransaction',
    } satisfies ParserError;
  }

  const agreement = trade['ram:ApplicableHeaderTradeAgreement'] as
    | Record<string, unknown>
    | undefined;
  const supplierRaw = agreement?.['ram:SellerTradeParty'] as Record<string, unknown> | undefined;
  const customerRaw = agreement?.['ram:BuyerTradeParty'] as Record<string, unknown> | undefined;

  const supplier = parseParty(
    supplierRaw,
    unmapped,
    '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:SellerTradeParty',
  );
  const customer = parseParty(
    customerRaw,
    unmapped,
    '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerTradeParty',
  );

  // --- Settlement header (currency, taxes, monetary summation, due date) --
  const settlement = trade['ram:ApplicableHeaderTradeSettlement'] as
    | Record<string, unknown>
    | undefined;
  if (!settlement) {
    throw {
      code: 'CII_PARSE_FAILED',
      message: 'Missing ram:ApplicableHeaderTradeSettlement',
    } satisfies ParserError;
  }
  const currencyCode = nodeText(settlement['ram:InvoiceCurrencyCode']) ?? 'EUR';

  const taxRows = settlement['ram:ApplicableTradeTax'] as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const taxRowArray: Record<string, unknown>[] = Array.isArray(taxRows)
    ? taxRows
    : taxRows
      ? [taxRows]
      : [];
  const taxBreakdown: EInvoiceTaxSubtotal[] = taxRowArray.map(parseTaxSubtotal);

  const paymentTerms = settlement['ram:SpecifiedTradePaymentTerms'] as
    | Record<string, unknown>
    | undefined;
  const dueDate = readDate(
    paymentTerms?.['ram:DueDateDateTime'] as Record<string, unknown> | undefined,
  );

  const monSum = settlement['ram:SpecifiedTradeSettlementHeaderMonetarySummation'] as
    | Record<string, unknown>
    | undefined;
  const taxExclusiveAmount = monSum
    ? toMinorUnits(nodeText(monSum['ram:TaxBasisTotalAmount']) ?? '0')
    : 0;
  const taxInclusiveAmount = monSum
    ? toMinorUnits(nodeText(monSum['ram:GrandTotalAmount']) ?? '0')
    : 0;
  const payableAmount = monSum ? toMinorUnits(nodeText(monSum['ram:DuePayableAmount']) ?? '0') : 0;

  // --- Lines --------------------------------------------------------------
  const rawLines = trade['ram:IncludedSupplyChainTradeLineItem'] as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const rawLineArray: Record<string, unknown>[] = Array.isArray(rawLines)
    ? rawLines
    : rawLines
      ? [rawLines]
      : [];
  const lines: EInvoiceLine[] = rawLineArray.map((line, idx) =>
    parseLine(
      line,
      unmapped,
      `/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:IncludedSupplyChainTradeLineItem[${idx}]`,
    ),
  );

  // --- Emit one UNMAPPED_FIELD warning per unique path --------------------
  for (const path of unmapped) {
    warnings.push({
      code: 'UNMAPPED_FIELD',
      message: `Field not mapped to canonical envelope (preserved in source XML only)`,
      path,
    });
  }

  const invoice: EInvoice = {
    id: invoiceId,
    issueDate,
    ...(dueDate == null ? {} : { dueDate }),
    invoiceTypeCode,
    currencyCode,
    supplier,
    customer,
    lines,
    taxExclusiveAmount,
    taxInclusiveAmount,
    payableAmount,
    taxBreakdown,
    profileId: profileLevel === 'XRECHNUNG' ? XRECHNUNG_DE_PROFILE_ID : ZUGFERD_DE_PROFILE_ID,
  };

  return {
    invoice,
    profileLevel,
    warnings,
    unmappedFields: Array.from(unmapped),
  };
}

// ---------------------------------------------------------------------------
// Back-compat alias
// ---------------------------------------------------------------------------

/**
 * Back-compat thin wrapper for `EInvoiceProfile.parse()` callers that want
 * only the envelope. Unwraps `.invoice` from the richer `parseXrechnungCii`
 * return shape. Retained at the old PascalCase name (`parseXRechnungCii`)
 * because the `XRechnungDEProfile` class in `index.ts` already imports it.
 */
export function parseXRechnungCii(xml: string): EInvoice {
  return parseXrechnungCii(xml).invoice;
}
