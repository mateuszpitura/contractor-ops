// XRechnung CII inbound parser.
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
//   - XSD shape violations are not this parser's job — the KoSIT validator
//     owns layer-1 XSD. We do, however, emit `CII_PARSE_FAILED` when the XML
//     itself is malformed (fast-xml-parser throws during tree construction).
//   - Logging uses the shared Pino root logger via `.child({ module: ... })`.
//     Never `console.*` — enforced by repo-wide guard.
//
// Security:
//   - Round-trip parity: `parse(generate(invoice))` returns a JSON-equal envelope.
//   - Unsupported-level passthrough prevented by hard throw + typed error.
//   - UTF-8 BOM is stripped before parsing to prevent parse failures.

import { createLogger } from '@contractor-ops/logger';
import { XMLParser } from 'fast-xml-parser';

import { InvalidMinorUnitsValueError, toMinorUnits } from '../../engine/xml-utils.js';
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
 * Discriminated union of typed errors thrown by the parser. Retained as a
 * type alias for callers that pattern-match on `.code` — kept structurally
 * compatible with the {@link CIIParserError} class instances now thrown.
 */
export type ParserError =
  | { code: 'CII_PARSE_FAILED'; message: string }
  | { code: 'ZUGFERD_LEVEL_UNSUPPORTED'; level: string };

/**
 * Class-form of {@link ParserError}. Subclasses `Error` so callers retain a
 * stack trace AND `error instanceof Error === true` (the previous plain-object
 * throws produced `[object Object]` in catch sites that defaulted to
 * `String(err)` — see bug-hunt 2026-04-27 [MEDIUM]).
 *
 * Discriminated by `.code`; callers should still
 * `if (err instanceof CIIParserError && err.code === 'CII_PARSE_FAILED') { ... }`
 * style narrow.
 */
export class CIIParserError extends Error {
  readonly code: 'CII_PARSE_FAILED' | 'ZUGFERD_LEVEL_UNSUPPORTED';
  /** Present only when code === 'ZUGFERD_LEVEL_UNSUPPORTED'. */
  readonly level?: string;

  constructor(
    code: 'CII_PARSE_FAILED' | 'ZUGFERD_LEVEL_UNSUPPORTED',
    message: string,
    level?: string,
  ) {
    super(message);
    this.code = code;
    this.level = level;
    this.name = 'CIIParserError';
  }
}

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

/**
 * Parse a CII BigDecimal string (e.g. "1190.00") to integer minor units,
 * delegating to the shared precision-safe helper. Wraps the shared
 * {@link InvalidMinorUnitsValueError} in a CII-typed error so callers that
 * already pattern-match on `CII_PARSE_FAILED` keep working.
 */
function ciiToMinorUnits(value: unknown): number {
  try {
    return toMinorUnits(value);
  } catch (err) {
    if (err instanceof InvalidMinorUnitsValueError) {
      throw new CIIParserError(
        'CII_PARSE_FAILED',
        `Invalid decimal value in CII document: "${err.raw}"`,
      );
    }
    throw err;
  }
}

/** Convert a CII format="102" YYYYMMDD date string to ISO YYYY-MM-DD. */
function fromCiiDate(value: unknown): string {
  if (value == null) {
    throw new CIIParserError('CII_PARSE_FAILED', 'Missing date value in CII document');
  }
  const str = typeof value === 'string' ? value.trim() : String(value);
  if (/^\d{8}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  throw new CIIParserError(
    'CII_PARSE_FAILED',
    `Unrecognised CII date format: "${str}" (expected YYYYMMDD)`,
  );
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
  const unitPriceMinor = unitPriceText == null ? undefined : ciiToMinorUnits(unitPriceText);

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
  const netAmountMinor = lineTotalText == null ? undefined : ciiToMinorUnits(lineTotalText);

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
    taxableAmountMinor: taxableText == null ? 0 : ciiToMinorUnits(taxableText),
    taxAmountMinor: taxText == null ? 0 : ciiToMinorUnits(taxText),
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
    const level = '(missing GuidelineSpecifiedDocumentContextParameter/ram:ID)';
    throw new CIIParserError(
      'ZUGFERD_LEVEL_UNSUPPORTED',
      `Unsupported ZUGFeRD profile level: ${level}`,
      level,
    );
  }

  if (UNSUPPORTED_GUIDELINE_URNS.has(guidelineUrn)) {
    throw new CIIParserError(
      'ZUGFERD_LEVEL_UNSUPPORTED',
      `Unsupported ZUGFeRD profile level: ${guidelineUrn}`,
      guidelineUrn,
    );
  }

  const level = GUIDELINE_URN_TO_LEVEL[guidelineUrn];
  if (level == null) {
    throw new CIIParserError(
      'ZUGFERD_LEVEL_UNSUPPORTED',
      `Unsupported ZUGFeRD profile level: ${guidelineUrn}`,
      guidelineUrn,
    );
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
    throw new CIIParserError('CII_PARSE_FAILED', err instanceof Error ? err.message : String(err));
  }

  const root = tree['rsm:CrossIndustryInvoice'] as Record<string, unknown> | undefined;
  if (!root) {
    throw new CIIParserError('CII_PARSE_FAILED', 'Missing rsm:CrossIndustryInvoice root element');
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
    throw new CIIParserError('CII_PARSE_FAILED', 'Missing rsm:ExchangedDocument/ram:IssueDateTime');
  }

  // --- Trade transaction --------------------------------------------------
  const trade = root['rsm:SupplyChainTradeTransaction'] as Record<string, unknown> | undefined;
  if (!trade) {
    throw new CIIParserError('CII_PARSE_FAILED', 'Missing rsm:SupplyChainTradeTransaction');
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
    throw new CIIParserError('CII_PARSE_FAILED', 'Missing ram:ApplicableHeaderTradeSettlement');
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
    ? ciiToMinorUnits(nodeText(monSum['ram:TaxBasisTotalAmount']) ?? '0')
    : 0;
  const taxInclusiveAmount = monSum
    ? ciiToMinorUnits(nodeText(monSum['ram:GrandTotalAmount']) ?? '0')
    : 0;
  const payableAmount = monSum
    ? ciiToMinorUnits(nodeText(monSum['ram:DuePayableAmount']) ?? '0')
    : 0;

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
