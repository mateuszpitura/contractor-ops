// XRechnung 3.0.2 CII generator.
//
// Produces an EN-16931-shaped Cross Industry Invoice (UN/CEFACT D16B) from the
// canonical `EInvoice` envelope. Uses `fast-xml-parser` XMLBuilder (never
// string templates — concat XML produces entity-escape bugs that surface as
// unhelpful layer-1 XSD failures).
//
// Dual-profile customization pair:
//   * CustomizationID = XRechnung CIUS 3.0 urn
//   * ProfileID       = Peppol BIS 3.0 billing urn
// The same XML validates against KoSIT + routes through Peppol to UK B2G.
//
// Locked legal phrases come from `packages/validators/src/legal/de.ts` via a
// relative source-path import. The validators package depends on einvoice
// (zatca re-exports), so a reverse `@contractor-ops/validators` dep would
// create a cycle; importing the leaf `legal/de.ts` file directly keeps the
// constant-by-name invariant without the cycle.
//
// BigInt safety: amounts travel as `number` minor units on the `EInvoice`
// envelope (types/invoice.ts). For the values we persist in CII (2-decimal
// BigDecimal strings), splitting on the last two digits via string math is
// precision-safe for any JS-representable integer minor-unit value. Anything
// larger than Number.MAX_SAFE_INTEGER would have already failed in the
// envelope layer (no precision retrieved == no precision emitted).

import { XMLBuilder } from 'fast-xml-parser';
import type { EInvoice, EInvoiceLine, EInvoiceTaxSubtotal } from '../../types/invoice.js';
import {
  CII_DOCUMENT_TYPE_COMMERCIAL_INVOICE,
  QDT_NS,
  RAM_NS,
  RSM_NS,
  UDT_NS,
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_KLEINUNTERNEHMER_REASON,
  XRECHNUNG_PROFILE_ID,
  XRECHNUNG_REVERSE_CHARGE_REASON,
} from './constants.js';

// ---------------------------------------------------------------------------
// Skonto term type (mirrors the service type — no cross-package import needed)
// ---------------------------------------------------------------------------

export interface SkontoTermInput {
  discountPercent: number;
  discountPeriodDays: number;
  netPeriodDays: number;
}

// ---------------------------------------------------------------------------
// Structural type used by fast-xml-parser builder + the embed helper.
//
// We model only the branches the generator + helper need to navigate. The
// `unknown` indirections are deliberate: CII carries deeply nested aggregates
// that the embed helper never touches, so widening the type beyond the BT-10
// path keeps the contract honest without ballooning the type surface.
// ---------------------------------------------------------------------------

export interface CiiDocShape {
  'rsm:CrossIndustryInvoice': {
    '@_xmlns:rsm': string;
    '@_xmlns:ram': string;
    '@_xmlns:udt': string;
    '@_xmlns:qdt': string;
    'rsm:ExchangedDocumentContext': Record<string, unknown>;
    'rsm:ExchangedDocument': Record<string, unknown>;
    'rsm:SupplyChainTradeTransaction': {
      'ram:IncludedSupplyChainTradeLineItem': unknown[];
      'ram:ApplicableHeaderTradeAgreement': {
        'ram:BuyerReference'?: string;
        [key: string]: unknown;
      };
      'ram:ApplicableHeaderTradeDelivery': Record<string, unknown>;
      'ram:ApplicableHeaderTradeSettlement': Record<string, unknown>;
    };
  };
}

// ---------------------------------------------------------------------------
// Builder — shared singleton. format:true emits human-readable XML; KoSIT
// accepts either, but readable XML keeps fixtures + error reports diffable.
// ---------------------------------------------------------------------------

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  format: true,
  suppressBooleanAttributes: false,
});

// ---------------------------------------------------------------------------
// Small helpers — precision-safe minor->major, YYYYMMDD date, tax mapping.
// ---------------------------------------------------------------------------

/**
 * Convert a minor-unit integer (e.g. cents) to a BigDecimal string with
 * exactly 2 fraction digits. Uses integer-string splicing so representations
 * stay exact for any JS-safe integer.
 *
 * Examples:
 *   fromMinor(0)       → "0.00"
 *   fromMinor(100)     → "1.00"
 *   fromMinor(119000)  → "1190.00"
 *   fromMinor(-1)      → "-0.01"
 */
function fromMinor(minor: number): string {
  if (!(Number.isFinite(minor) && Number.isInteger(minor))) {
    throw new Error(`Invalid minor-unit amount: ${String(minor)} (expected integer)`);
  }
  const negative = minor < 0;
  const abs = Math.abs(minor).toString();
  const padded = abs.padStart(3, '0');
  const intPart = padded.slice(0, -2);
  const fracPart = padded.slice(-2);
  const sign = negative ? '-' : '';
  return `${sign}${intPart}.${fracPart}`;
}

/** BT-2 ISO 8601 date → CII format="102" string (YYYYMMDD). */
function toCiiDate(isoDate: string): string {
  // Accept 'YYYY-MM-DD' (envelope convention) or a pass-through already-formatted value.
  if (/^\d{8}$/.test(isoDate)) return isoDate;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid issueDate for CII: "${isoDate}" (expected YYYY-MM-DD)`);
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

/**
 * Add `days` to a `YYYY-MM-DD` ISO date and return CII format="102"
 * (YYYYMMDD), using UTC arithmetic only — no `Date` getters that would
 * shift across local-TZ boundaries (`getDate()` etc.). Mirrors the
 * `toCiiDate` regex parse so the input shape contract is identical.
 */
function addDaysUtcCii(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid date for UTC arithmetic: "${isoDate}" (expected YYYY-MM-DD)`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12
  const day = Number(match[3]);
  // Date.UTC normalises overflow (e.g. month=12 + day+50 wraps to next year).
  const utcMs = Date.UTC(year, month - 1, day) + days * 86400000;
  const out = new Date(utcMs);
  const y = String(out.getUTCFullYear()).padStart(4, '0');
  const m = String(out.getUTCMonth() + 1).padStart(2, '0');
  const d = String(out.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

interface CiiTradeTax {
  'ram:CalculatedAmount': string;
  'ram:TypeCode': string;
  'ram:ExemptionReason'?: string;
  'ram:BasisAmount': string;
  'ram:CategoryCode': string;
  'ram:RateApplicablePercent'?: string;
}

interface ParsedDeAddress {
  lineOne?: string;
  postcode?: string;
  city?: string;
}

/** Split "Street, 10115 Berlin" style DE addresses used on the EInvoice envelope. */
function parseDeAddress(address: string): ParsedDeAddress {
  const postcodeMatch = /\b(\d{5})\b/.exec(address);
  if (!postcodeMatch) {
    return { lineOne: address.trim() || undefined };
  }
  const postcode = postcodeMatch[1];
  if (!postcode) {
    return { lineOne: address.trim() || undefined };
  }
  const afterPostcode = address.slice((postcodeMatch.index ?? 0) + postcode.length).trim();
  const beforePostcode = address
    .slice(0, postcodeMatch.index)
    .replace(/[,\s]+$/, '')
    .trim();
  return {
    lineOne: beforePostcode || undefined,
    postcode,
    city: afterPostcode.replace(/^[, ]+/, '') || undefined,
  };
}

function isVatIdentifier(id: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]+$/i.test(id.trim());
}

function resolveLineTaxCategory(line: EInvoiceLine, taxBreakdown: EInvoiceTaxSubtotal[]): string {
  if (taxBreakdown.length === 1) {
    return taxBreakdown[0]!.taxCategory;
  }
  const rate = line.vatRate == null ? null : Number(line.vatRate);
  const matched = taxBreakdown.find(t => t.percent === rate);
  return matched?.taxCategory ?? taxBreakdown[0]?.taxCategory ?? 'S';
}

/**
 * Map a canonical tax subtotal to a CII `<ram:ApplicableTradeTax>` block.
 *
 * Category-code semantics (UNCL 5305 / EN 16931):
 *   S   - standard rate       → RateApplicablePercent
 *   AE  - reverse charge      → ExemptionReason = §13b UStG locked phrase
 *   E   - exempt (Kleinunt.)  → ExemptionReason = §19 UStG locked phrase
 *   Z   - zero-rated          → (no exemption reason; consumer's choice)
 */
function toCiiTax(tax: EInvoiceTaxSubtotal, _currencyCode: string): CiiTradeTax {
  if (tax.taxCategory === 'S' && tax.percent == null) {
    throw new Error('XRechnung CII: standard-rate (S) tax subtotal requires a percent value');
  }

  const taxBlock: CiiTradeTax = {
    'ram:CalculatedAmount': fromMinor(tax.taxAmountMinor),
    'ram:TypeCode': 'VAT',
    'ram:BasisAmount': fromMinor(tax.taxableAmountMinor),
    'ram:CategoryCode': tax.taxCategory,
  };

  if (tax.taxCategory === 'AE') {
    taxBlock['ram:ExemptionReason'] = XRECHNUNG_REVERSE_CHARGE_REASON;
  } else if (tax.taxCategory === 'E') {
    taxBlock['ram:ExemptionReason'] = XRECHNUNG_KLEINUNTERNEHMER_REASON;
  }

  if (tax.taxCategory !== 'AE' && tax.taxCategory !== 'E' && tax.percent != null) {
    taxBlock['ram:RateApplicablePercent'] = String(tax.percent);
  }

  return taxBlock;
}

/** Line-item mapping — minimal BT-levels needed for layer-1 XSD + BR core rules. */
function toLineItem(
  line: EInvoiceLine,
  currencyCode: string,
  taxBreakdown: EInvoiceTaxSubtotal[],
): Record<string, unknown> {
  const lineTaxCategory = resolveLineTaxCategory(line, taxBreakdown);
  const lineTax: Record<string, unknown> = {
    'ram:TypeCode': 'VAT',
    'ram:CategoryCode': lineTaxCategory,
  };
  if (lineTaxCategory === 'S' && line.vatRate != null) {
    lineTax['ram:RateApplicablePercent'] = line.vatRate;
  }

  return {
    'ram:AssociatedDocumentLineDocument': {
      'ram:LineID': String(line.lineNumber),
    },
    'ram:SpecifiedTradeProduct': {
      'ram:Name': line.description,
    },
    'ram:SpecifiedLineTradeAgreement': {
      'ram:NetPriceProductTradePrice': {
        'ram:ChargeAmount': fromMinor(line.unitPriceMinor ?? line.netAmountMinor ?? 0),
      },
    },
    'ram:SpecifiedLineTradeDelivery': {
      'ram:BilledQuantity': {
        '@_unitCode': line.unit ?? 'C62',
        '#text': String(line.quantity ?? 1),
      },
    },
    'ram:SpecifiedLineTradeSettlement': {
      'ram:ApplicableTradeTax': lineTax,
      'ram:SpecifiedTradeSettlementLineMonetarySummation': {
        'ram:LineTotalAmount': fromMinor(line.netAmountMinor ?? 0),
      },
    },
  };
}

/** BT-106/107/110/112/115 monetary summation. */
function buildMonetarySummation(invoice: EInvoice): Record<string, unknown> {
  const { currencyCode } = invoice;
  const lineTotal = invoice.lines.reduce((sum, l) => sum + (l.netAmountMinor ?? 0), 0);
  const taxTotal = invoice.taxBreakdown.reduce((sum, t) => sum + t.taxAmountMinor, 0);

  return {
    'ram:LineTotalAmount': fromMinor(lineTotal),
    'ram:TaxBasisTotalAmount': fromMinor(invoice.taxExclusiveAmount),
    'ram:TaxTotalAmount': {
      '@_currencyID': currencyCode,
      '#text': fromMinor(taxTotal),
    },
    'ram:GrandTotalAmount': fromMinor(invoice.taxInclusiveAmount),
    'ram:DuePayableAmount': fromMinor(invoice.payableAmount),
  };
}

/** Minimal CII trade party — BR-Core + BR-DE seller/buyer address and contact fields. */
function buildCiiParty(
  party: EInvoice['supplier'],
  role: 'seller' | 'buyer',
  leitwegId?: string | null,
): Record<string, unknown> {
  const parsedAddress = party.address ? parseDeAddress(party.address) : {};
  const contactName = party.additionalIds?.contactName ?? party.name;
  const contactPhone = party.additionalIds?.phone;
  const contactEmail = party.additionalIds?.email;

  const partyNode: Record<string, unknown> = {
    'ram:Name': party.name,
  };

  if (party.id && !isVatIdentifier(party.id)) {
    partyNode['ram:SpecifiedLegalOrganization'] = {
      'ram:ID': party.id,
    };
  }

  if (role === 'seller' && contactName && contactPhone && contactEmail) {
    partyNode['ram:DefinedTradeContact'] = {
      'ram:PersonName': contactName,
      'ram:TelephoneUniversalCommunication': {
        'ram:CompleteNumber': contactPhone,
      },
      'ram:EmailURIUniversalCommunication': {
        'ram:URIID': contactEmail,
      },
    };
  }

  if (party.address || party.country || parsedAddress.postcode || parsedAddress.city) {
    const postalAddress: Record<string, unknown> = {};
    if (parsedAddress.postcode) postalAddress['ram:PostcodeCode'] = parsedAddress.postcode;
    if (parsedAddress.lineOne) postalAddress['ram:LineOne'] = parsedAddress.lineOne;
    if (parsedAddress.city) postalAddress['ram:CityName'] = parsedAddress.city;
    if (party.country) postalAddress['ram:CountryID'] = party.country;
    partyNode['ram:PostalTradeAddress'] = postalAddress;
  }

  const sellerEmail = party.additionalIds?.email;
  if (role === 'seller' && sellerEmail) {
    partyNode['ram:URIUniversalCommunication'] = {
      'ram:URIID': {
        '@_schemeID': 'EM',
        '#text': sellerEmail,
      },
    };
  } else if (role === 'buyer') {
    const buyerEmail = party.additionalIds?.email;
    if (buyerEmail) {
      partyNode['ram:URIUniversalCommunication'] = {
        'ram:URIID': {
          '@_schemeID': 'EM',
          '#text': buyerEmail,
        },
      };
    } else if (leitwegId) {
      partyNode['ram:URIUniversalCommunication'] = {
        'ram:URIID': {
          '@_schemeID': '0204',
          '#text': leitwegId,
        },
      };
    }
  }

  if (party.id && isVatIdentifier(party.id)) {
    partyNode['ram:SpecifiedTaxRegistration'] = {
      'ram:ID': {
        '@_schemeID': 'VA',
        '#text': party.id.toUpperCase(),
      },
    };
  }

  return partyNode;
}

/** BG-16 payment instructions — required by BR-DE-1 for German B2G invoices. */
function buildPaymentMeans(invoice: EInvoice): Record<string, unknown> {
  const means = invoice.paymentMeans;
  if (!means?.bankAccount) return {};

  return {
    'ram:SpecifiedTradeSettlementPaymentMeans': {
      'ram:TypeCode': means.code ?? '58',
      'ram:PayeePartyCreditorFinancialAccount': {
        'ram:IBANID': means.bankAccount,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// BG-20 Payment Terms — with optional Skonto extension (XRechnung 3.0.2 Anhang E)
// ---------------------------------------------------------------------------

/**
 * Build the `ram:SpecifiedTradePaymentTerms` block.
 *
 * When a Skonto term is provided, the Description contains:
 *   1. Human-readable German text from the locked phrase template
 *   2. Structured Skonto string per XRechnung 3.0.2 Anhang E:
 *      `#SKONTO#TAGE={days}#PROZENT={pct}#BASISBETRAG={amount}#`
 *
 * The structured string goes in the TEXT content of `ram:Description` via
 * fast-xml-parser's `#text` property — NOT in an XML attribute. This ensures
 * `#` and decimal numbers appear literally without XML escaping issues
 * Using `#text` avoids XML attribute escaping issues with `#` and decimal numbers.
 *
 * Due date is set to `issueDate + netPeriodDays` when Skonto is present.
 */
function buildPaymentTerms(
  invoice: EInvoice,
  skontoTerm?: SkontoTermInput | null,
): Record<string, unknown> {
  if (skontoTerm) {
    // Compute due date from issue date + net period in UTC. Using
    // `new Date(YYYY-MM-DD).setDate(...)` would parse as UTC midnight then
    // mutate via local-TZ accessors — for negative-offset TZs (e.g. PST)
    // `getDate()` returns the previous calendar day, shifting the legally-
    // binding Skonto window by 1 day around month boundaries (bug-hunt
    // 2026-04-27 [HIGH]).
    const dueDateCii = addDaysUtcCii(invoice.issueDate, skontoTerm.netPeriodDays);

    const basisBetrag = fromMinor(invoice.payableAmount);
    const structuredSkonto =
      `#SKONTO#TAGE=${skontoTerm.discountPeriodDays}` +
      `#PROZENT=${skontoTerm.discountPercent.toFixed(2)}` +
      `#BASISBETRAG=${basisBetrag}#`;

    return {
      'ram:SpecifiedTradePaymentTerms': {
        'ram:Description': {
          '#text': `${structuredSkonto}\n`,
        },
        'ram:DueDateDateTime': {
          'udt:DateTimeString': {
            '@_format': '102',
            '#text': dueDateCii,
          },
        },
      },
    };
  }

  if (invoice.dueDate) {
    return {
      'ram:SpecifiedTradePaymentTerms': {
        'ram:Description': `Zahlbar bis ${invoice.dueDate}`,
        'ram:DueDateDateTime': {
          'udt:DateTimeString': {
            '@_format': '102',
            '#text': toCiiDate(invoice.dueDate),
          },
        },
      },
    };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an XRechnung 3.0.2 CII (Cross Industry Invoice) XML string from
 * the canonical `EInvoice` envelope.
 *
 * @param invoice   Canonical EInvoice envelope (lines + taxBreakdown + parties).
 * @param leitwegId Resolved BT-10 value, or `null` to omit `<ram:BuyerReference>`
 *                  entirely (soft-gate path — Plan 04 resolver decides).
 * @param skontoTerm Optional Skonto term for BG-20 structured payment terms
 *                   per XRechnung 3.0.2 Anhang E.
 * @returns         UTF-8 CII XML, always prefixed with `<?xml ... ?>`.
 */
export function generateXRechnungCii(
  invoice: EInvoice,
  leitwegId: string | null,
  skontoTerm?: SkontoTermInput | null,
): string {
  const { currencyCode } = invoice;

  const agreement: CiiDocShape['rsm:CrossIndustryInvoice']['rsm:SupplyChainTradeTransaction']['ram:ApplicableHeaderTradeAgreement'] =
    {
      ...(leitwegId ? { 'ram:BuyerReference': leitwegId } : {}),
      'ram:SellerTradeParty': buildCiiParty(invoice.supplier, 'seller'),
      'ram:BuyerTradeParty': buildCiiParty(invoice.customer, 'buyer', leitwegId),
    };

  const doc: CiiDocShape = {
    'rsm:CrossIndustryInvoice': {
      '@_xmlns:rsm': RSM_NS,
      '@_xmlns:ram': RAM_NS,
      '@_xmlns:udt': UDT_NS,
      '@_xmlns:qdt': QDT_NS,
      'rsm:ExchangedDocumentContext': {
        'ram:BusinessProcessSpecifiedDocumentContextParameter': {
          'ram:ID': XRECHNUNG_PROFILE_ID,
        },
        'ram:GuidelineSpecifiedDocumentContextParameter': {
          'ram:ID': XRECHNUNG_CUSTOMIZATION_ID,
        },
      },
      'rsm:ExchangedDocument': {
        'ram:ID': invoice.id,
        'ram:TypeCode': invoice.invoiceTypeCode || CII_DOCUMENT_TYPE_COMMERCIAL_INVOICE,
        'ram:IssueDateTime': {
          'udt:DateTimeString': {
            '@_format': '102',
            '#text': toCiiDate(invoice.issueDate),
          },
        },
      },
      'rsm:SupplyChainTradeTransaction': {
        'ram:IncludedSupplyChainTradeLineItem': invoice.lines.map(line =>
          toLineItem(line, currencyCode, invoice.taxBreakdown),
        ),
        'ram:ApplicableHeaderTradeAgreement': agreement,
        'ram:ApplicableHeaderTradeDelivery': {},
        'ram:ApplicableHeaderTradeSettlement': {
          'ram:InvoiceCurrencyCode': currencyCode,
          ...buildPaymentMeans(invoice),
          'ram:ApplicableTradeTax': invoice.taxBreakdown.map(t => toCiiTax(t, currencyCode)),
          ...buildPaymentTerms(invoice, skontoTerm),
          'ram:SpecifiedTradeSettlementHeaderMonetarySummation': buildMonetarySummation(invoice),
        },
      },
    },
  };

  const body = builder.build(doc) as string;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
