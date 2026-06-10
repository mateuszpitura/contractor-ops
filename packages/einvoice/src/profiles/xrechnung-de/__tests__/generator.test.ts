// packages/einvoice/src/profiles/xrechnung-de/__tests__/generator.test.ts
//
// TDD tests for the XRechnung 3.0.2 CII generator.
//
// The generator is intentionally deterministic: given the same EInvoice
// and the same leitwegId, byte-for-byte identical XML is produced. This is
// what makes content-addressed R2 storage + validation-report dedup work.

import libxmljs from 'libxmljs2';
import { describe, expect, it } from 'vitest';
import type { EInvoice } from '../../../types/invoice.js';
import {
  RAM_NS,
  RSM_NS,
  XRECHNUNG_CUSTOMIZATION_ID,
  XRECHNUNG_DE_PROFILE_ID,
  XRECHNUNG_KLEINUNTERNEHMER_REASON,
  XRECHNUNG_PROFILE_ID,
  XRECHNUNG_REVERSE_CHARGE_REASON,
} from '../constants.js';
import { generateXRechnungCii } from '../generator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMinimalInvoice(overrides: Partial<EInvoice> = {}): EInvoice {
  return {
    id: 'INV-2026-0001',
    issueDate: '2026-04-14',
    dueDate: '2026-05-14',
    invoiceTypeCode: '380',
    currencyCode: 'EUR',
    profileId: XRECHNUNG_DE_PROFILE_ID,
    supplier: {
      id: 'DE123456789',
      name: 'Example GmbH',
      address: 'Alexanderplatz 1, 10178 Berlin',
      country: 'DE',
    },
    customer: {
      id: 'DE987654321',
      name: 'Bundesamt für Beispiel',
      address: 'Friedrichstraße 50, 10117 Berlin',
      country: 'DE',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Consulting services',
        quantity: 10,
        unit: 'HUR',
        unitPriceMinor: 10000,
        netAmountMinor: 100000,
        vatRate: '19',
        vatAmountMinor: 19000,
      },
    ],
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 119000,
    payableAmount: 119000,
    taxBreakdown: [
      {
        taxableAmountMinor: 100000,
        taxAmountMinor: 19000,
        taxCategory: 'S',
        percent: 19,
      },
    ],
    ...overrides,
  };
}

function makeReverseChargeInvoice(): EInvoice {
  return makeMinimalInvoice({
    customer: {
      id: 'FR12345678901',
      name: 'Exemple SAS',
      country: 'FR',
    },
    lines: [
      {
        lineNumber: 1,
        description: 'Consulting services',
        quantity: 10,
        unit: 'HUR',
        unitPriceMinor: 10000,
        netAmountMinor: 100000,
        vatRate: '0',
        vatAmountMinor: 0,
      },
    ],
    taxExclusiveAmount: 100000,
    taxInclusiveAmount: 100000,
    payableAmount: 100000,
    taxBreakdown: [
      {
        taxableAmountMinor: 100000,
        taxAmountMinor: 0,
        taxCategory: 'AE',
        percent: 0,
      },
    ],
  });
}

function makeKleinunternehmerInvoice(): EInvoice {
  return makeMinimalInvoice({
    lines: [
      {
        lineNumber: 1,
        description: 'Freelance service',
        quantity: 1,
        unit: 'C62',
        unitPriceMinor: 50000,
        netAmountMinor: 50000,
        vatRate: '0',
        vatAmountMinor: 0,
      },
    ],
    taxExclusiveAmount: 50000,
    taxInclusiveAmount: 50000,
    payableAmount: 50000,
    taxBreakdown: [
      {
        taxableAmountMinor: 50000,
        taxAmountMinor: 0,
        taxCategory: 'E',
        percent: 0,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// 1. Minimal valid invoice — well-formed CII, customization pair locked
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — minimal valid invoice produces parseable CII', () => {
  it('emits XML prolog + rsm:CrossIndustryInvoice root with all four namespaces', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rsm:CrossIndustryInvoice');
    expect(xml).toContain(`xmlns:rsm="${RSM_NS}"`);
    expect(xml).toContain(`xmlns:ram="${RAM_NS}"`);
    expect(xml).toContain('xmlns:udt=');
    expect(xml).toContain('xmlns:qdt=');
  });

  it('is well-formed XML (libxmljs2 parseXml succeeds)', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    const doc = libxmljs.parseXml(xml);
    expect(doc.errors).toEqual([]);
    expect(doc.root()?.name()).toBe('CrossIndustryInvoice');
  });

  it('embeds XRECHNUNG_CUSTOMIZATION_ID literal at GuidelineSpecifiedDocumentContextParameter/ID', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    expect(xml).toContain(`<ram:ID>${XRECHNUNG_CUSTOMIZATION_ID}</ram:ID>`);
  });

  it('embeds XRECHNUNG_PROFILE_ID at BusinessProcessSpecifiedDocumentContextParameter/ID', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    expect(xml).toContain(`<ram:ID>${XRECHNUNG_PROFILE_ID}</ram:ID>`);
  });

  it('emits the invoice id inside rsm:ExchangedDocument/ram:ID', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice({ id: 'INV-42' }), null);
    const doc = libxmljs.parseXml(xml);
    const ns = { rsm: RSM_NS, ram: RAM_NS };
    const idNode = doc.get('/rsm:CrossIndustryInvoice/rsm:ExchangedDocument/ram:ID', ns);
    expect((idNode as libxmljs.Element | null)?.text()).toBe('INV-42');
  });

  it('formats the issue date as YYYYMMDD with format="102"', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice({ issueDate: '2026-04-14' }), null);
    expect(xml).toContain('format="102"');
    expect(xml).toContain('>20260414<');
  });
});

// ---------------------------------------------------------------------------
// 2. Leitweg-ID embedded at BT-10 when supplied
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — Leitweg-ID embedding (BT-10)', () => {
  it('embeds <ram:BuyerReference> under ApplicableHeaderTradeAgreement when leitwegId is supplied', () => {
    const leitwegId = '991-33333TEST-33';
    const xml = generateXRechnungCii(makeMinimalInvoice(), leitwegId);

    expect(xml).toContain(`<ram:BuyerReference>${leitwegId}</ram:BuyerReference>`);

    const doc = libxmljs.parseXml(xml);
    const node = doc.get(
      '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerReference',
      { rsm: RSM_NS, ram: RAM_NS },
    );
    expect((node as libxmljs.Element | null)?.text()).toBe(leitwegId);
  });

  it('does not transform the Leitweg-ID value (exact string round-trip)', () => {
    const leitwegId = '04011000-1234512345-06';
    const xml = generateXRechnungCii(makeMinimalInvoice(), leitwegId);
    const doc = libxmljs.parseXml(xml);
    const node = doc.get(
      '/rsm:CrossIndustryInvoice/rsm:SupplyChainTradeTransaction/ram:ApplicableHeaderTradeAgreement/ram:BuyerReference',
      { rsm: RSM_NS, ram: RAM_NS },
    );
    expect((node as libxmljs.Element | null)?.text()).toBe(leitwegId);
  });
});

// ---------------------------------------------------------------------------
// 3. Leitweg-ID omitted when null
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — Leitweg-ID omitted when null', () => {
  it('emits no <ram:BuyerReference> element when leitwegId is null', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    expect(xml).not.toContain('<ram:BuyerReference>');
  });
});

// ---------------------------------------------------------------------------
// 4. Reverse-charge (§13b UStG) — CategoryCode "AE" + locked phrase
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — reverse-charge (§13b UStG)', () => {
  it('maps taxCategory "AE" rows to CategoryCode=AE with the Phase-56 locked §13b phrase', () => {
    const xml = generateXRechnungCii(makeReverseChargeInvoice(), null);

    expect(xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
    expect(xml).toContain(
      `<ram:ExemptionReason>${XRECHNUNG_REVERSE_CHARGE_REASON}</ram:ExemptionReason>`,
    );
  });

  it('uses the exact Phase-56 constant value (no string-literal drift)', () => {
    const xml = generateXRechnungCii(makeReverseChargeInvoice(), null);
    // The constant MUST be the source of truth — any deviation breaks BR-DE.
    expect(xml).toContain(XRECHNUNG_REVERSE_CHARGE_REASON);
  });
});

// ---------------------------------------------------------------------------
// 5. Kleinunternehmer (§19 UStG) — CategoryCode "E" + locked phrase
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — Kleinunternehmer (§19 UStG)', () => {
  it('maps taxCategory "E" rows to CategoryCode=E with the Phase-56 locked §19 UStG phrase', () => {
    const xml = generateXRechnungCii(makeKleinunternehmerInvoice(), null);

    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
    expect(xml).toContain(
      `<ram:ExemptionReason>${XRECHNUNG_KLEINUNTERNEHMER_REASON}</ram:ExemptionReason>`,
    );
  });

  it('imports the §19 phrase from the validators legal module (no hard-coded German)', () => {
    // Documents the invariant: XRECHNUNG_KLEINUNTERNEHMER_REASON is imported at the
    // top of this file from the Phase-56 constants module.
    expect(XRECHNUNG_KLEINUNTERNEHMER_REASON).toBe(
      'Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen',
    );
    const xml = generateXRechnungCii(makeKleinunternehmerInvoice(), null);
    expect(xml).toContain(XRECHNUNG_KLEINUNTERNEHMER_REASON);
  });
});

// ---------------------------------------------------------------------------
// 6. Standard VAT row — CategoryCode "S" + RateApplicablePercent
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — standard VAT row', () => {
  it('maps taxCategory "S" rows to CategoryCode=S with RateApplicablePercent', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    expect(xml).toContain('<ram:CategoryCode>S</ram:CategoryCode>');
    expect(xml).toContain('<ram:RateApplicablePercent>19</ram:RateApplicablePercent>');
  });

  it('does not emit ExemptionReason for standard-VAT rows', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    // Standard rows must NOT carry the §13b/§19 phrases.
    expect(xml).not.toContain(XRECHNUNG_REVERSE_CHARGE_REASON);
    expect(xml).not.toContain(XRECHNUNG_KLEINUNTERNEHMER_REASON);
  });
});

// ---------------------------------------------------------------------------
// 7. Monetary summation — BigDecimal strings with 2 decimals
// ---------------------------------------------------------------------------

describe('generateXRechnungCii — monetary summation', () => {
  it('emits LineTotalAmount / TaxBasisTotalAmount / TaxTotalAmount / GrandTotalAmount / DuePayableAmount', () => {
    const xml = generateXRechnungCii(makeMinimalInvoice(), null);
    expect(xml).toContain('<ram:LineTotalAmount>1000.00</ram:LineTotalAmount>');
    expect(xml).toContain('<ram:TaxBasisTotalAmount>1000.00</ram:TaxBasisTotalAmount>');
    expect(xml).toContain('currencyID="EUR"');
    expect(xml).toContain('<ram:GrandTotalAmount>1190.00</ram:GrandTotalAmount>');
    expect(xml).toContain('<ram:DuePayableAmount>1190.00</ram:DuePayableAmount>');
  });

  it('preserves exact 2-decimal format for large amounts', () => {
    const invoice = makeMinimalInvoice({
      taxExclusiveAmount: 999999999, // €9,999,999.99
      taxInclusiveAmount: 1189999999,
      payableAmount: 1189999999,
      lines: [
        {
          lineNumber: 1,
          description: 'Big-ticket item',
          quantity: 1,
          unit: 'C62',
          unitPriceMinor: 999999999,
          netAmountMinor: 999999999,
          vatRate: '19',
          vatAmountMinor: 190000000,
        },
      ],
      taxBreakdown: [
        {
          taxableAmountMinor: 999999999,
          taxAmountMinor: 190000000,
          taxCategory: 'S',
          percent: 19,
        },
      ],
    });
    const xml = generateXRechnungCii(invoice, null);
    expect(xml).toContain('9999999.99');
  });
});

// ---------------------------------------------------------------------------
// BG-20 Skonto Payment Terms
// ---------------------------------------------------------------------------

describe('XRechnung CII generator — Skonto BG-20 Payment Terms', () => {
  const skontoTerm = {
    discountPercent: 3,
    discountPeriodDays: 7,
    netPeriodDays: 30,
  };

  it('emits structured Skonto string in ram:Description when skontoTerm is provided', () => {
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null, skontoTerm);

    // Structured Skonto per XRechnung 3.0.2 Anhang E
    expect(xml).toContain('#SKONTO#TAGE=7#PROZENT=3.00#BASISBETRAG=');
  });

  it('emits human-readable German description with Skonto parameters', () => {
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null, skontoTerm);

    expect(xml).toContain('3.00% Skonto bei Zahlung innerhalb von 7 Tagen, sonst netto 30 Tage');
  });

  it('emits BASISBETRAG from payableAmount', () => {
    const invoice = makeMinimalInvoice({ payableAmount: 119000 });
    const xml = generateXRechnungCii(invoice, null, skontoTerm);

    expect(xml).toContain('#BASISBETRAG=1190.00#');
  });

  it('emits due date as issueDate + netPeriodDays when Skonto is present', () => {
    // issueDate = 2026-04-14, netPeriodDays = 30 => due 2026-05-14
    const invoice = makeMinimalInvoice({ issueDate: '2026-04-14' });
    const xml = generateXRechnungCii(invoice, null, skontoTerm);

    expect(xml).toContain('20260514');
  });

  it('does NOT emit #SKONTO# for non-Skonto invoice', () => {
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null);

    expect(xml).not.toContain('#SKONTO#');
  });

  it('does NOT emit #SKONTO# when skontoTerm is null', () => {
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null, null);

    expect(xml).not.toContain('#SKONTO#');
  });

  it('emits ram:SpecifiedTradePaymentTerms with Skonto', () => {
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null, skontoTerm);

    expect(xml).toContain('ram:SpecifiedTradePaymentTerms');
    expect(xml).toContain('ram:Description');
  });

  it('handles non-round discount percentages correctly', () => {
    const term = { discountPercent: 2.5, discountPeriodDays: 14, netPeriodDays: 60 };
    const invoice = makeMinimalInvoice();
    const xml = generateXRechnungCii(invoice, null, term);

    expect(xml).toContain('#PROZENT=2.50#');
    expect(xml).toContain('2.50% Skonto bei Zahlung innerhalb von 14 Tagen, sonst netto 60 Tage');
  });
});
