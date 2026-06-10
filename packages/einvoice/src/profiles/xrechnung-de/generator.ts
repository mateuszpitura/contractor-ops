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
  XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE,
} from './constants.js';
import { embedLeitwegIdIntoCii } from './leitweg-id-embed.js';

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
  'ram:TypeCode': string;
  'ram:CategoryCode': string;
  'ram:BasisAmount': { '@_currencyID': string; '#text': string };
  'ram:CalculatedAmount': { '@_currencyID': string; '#text': string };
  'ram:ExemptionReason'?: string;
  'ram:RateApplicablePercent'?: string;
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
function toCiiTax(tax: EInvoiceTaxSubtotal, currencyCode: string): CiiTradeTax {
  const base: CiiTradeTax = {
    'ram:TypeCode': 'VAT',
    'ram:CategoryCode': tax.taxCategory,
    'ram:BasisAmount': {
      '@_currencyID': currencyCode,
      '#text': fromMinor(tax.taxableAmountMinor),
    },
    'ram:CalculatedAmount': {
      '@_currencyID': currencyCode,
      '#text': fromMinor(tax.taxAmountMinor),
    },
  };

  switch (tax.taxCategory) {
    case 'AE':
      base['ram:ExemptionReason'] = XRECHNUNG_REVERSE_CHARGE_REASON;
      break;
    case 'E':
      base['ram:ExemptionReason'] = XRECHNUNG_KLEINUNTERNEHMER_REASON;
      break;
    default:
      if (tax.percent != null) {
        base['ram:RateApplicablePercent'] = String(tax.percent);
      }
      break;
  }
  if (tax.taxCategory === 'S' && tax.percent == null) {
    // Guard against silently emitting a category-S row with no rate, which
    // KoSIT would flag with an unhelpful layer-2 message.
    throw new Error('XRechnung CII: standard-rate (S) tax subtotal requires a percent value');
  }

  return base;
}

/** Line-item mapping — minimal BT-levels needed for layer-1 XSD + BR core rules. */
function toLineItem(line: EInvoiceLine, currencyCode: string): Record<string, unknown> {
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
      'ram:ApplicableTradeTax': {
        'ram:TypeCode': 'VAT',
        'ram:CategoryCode': 'S',
        ...(line.vatRate == null ? {} : { 'ram:RateApplicablePercent': line.vatRate }),
      },
      'ram:SpecifiedTradeSettlementLineMonetarySummation': {
        'ram:LineTotalAmount': {
          '@_currencyID': currencyCode,
          '#text': fromMinor(line.netAmountMinor ?? 0),
        },
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

/** Minimal CII trade party — BR-Core mandates Name + PostalAddress/Country. */
function buildCiiParty(party: EInvoice['supplier']): Record<string, unknown> {
  return {
    'ram:Name': party.name,
    'ram:SpecifiedLegalOrganization': {
      'ram:ID': party.id,
    },
    ...(party.address || party.country
      ? {
          'ram:PostalTradeAddress': {
            ...(party.address ? { 'ram:LineOne': party.address } : {}),
            ...(party.country ? { 'ram:CountryID': party.country } : {}),
          },
        }
      : {}),
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

    // Human-readable German description from mirrored locked phrase template
    const germanDescription = XRECHNUNG_SKONTO_DESCRIPTION_TEMPLATE.replace(
      '{percent}',
      skontoTerm.discountPercent.toFixed(2),
    )
      .replace('{discountDays}', String(skontoTerm.discountPeriodDays))
      .replace('{netDays}', String(skontoTerm.netPeriodDays));

    // Structured Skonto extension per XRechnung 3.0.2 Anhang E
    const basisBetrag = fromMinor(invoice.payableAmount);
    const structuredSkonto =
      `#SKONTO#TAGE=${skontoTerm.discountPeriodDays}` +
      `#PROZENT=${skontoTerm.discountPercent.toFixed(2)}` +
      `#BASISBETRAG=${basisBetrag}#`;

    return {
      'ram:SpecifiedTradePaymentTerms': {
        'ram:Description': {
          '#text': `${germanDescription}\n${structuredSkonto}`,
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

  // No Skonto — emit standard due date if present
  if (invoice.dueDate) {
    return {
      'ram:SpecifiedTradePaymentTerms': {
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
          toLineItem(line, currencyCode),
        ),
        'ram:ApplicableHeaderTradeAgreement': {
          'ram:SellerTradeParty': buildCiiParty(invoice.supplier),
          'ram:BuyerTradeParty': buildCiiParty(invoice.customer),
        },
        'ram:ApplicableHeaderTradeDelivery': {},
        'ram:ApplicableHeaderTradeSettlement': {
          'ram:InvoiceCurrencyCode': currencyCode,
          'ram:ApplicableTradeTax': invoice.taxBreakdown.map(t => toCiiTax(t, currencyCode)),
          ...buildPaymentTerms(invoice, skontoTerm),
          'ram:SpecifiedTradeSettlementHeaderMonetarySummation': buildMonetarySummation(invoice),
        },
      },
    },
  };

  const decorated = leitwegId === null ? doc : embedLeitwegIdIntoCii(doc, leitwegId);
  const body = builder.build(decorated) as string;
  return `<?xml version="1.0" encoding="UTF-8"?>\n${body}`;
}
