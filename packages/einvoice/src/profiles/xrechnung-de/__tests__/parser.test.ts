// XRechnung CII inbound parser unit tests.
//
// Six branches:
//   1. Round-trip: parse(generate(invoice)).invoice preserves key fields.
//   2. KoSIT positive minimal fixture parses as XRECHNUNG, zero warnings.
//   3. Minimum-profile guideline URN is hard-rejected.
//   4. Extended-profile guideline URN emits LEVEL_EXTENDED_BEST_EFFORT warning.
//   5. Malformed XML throws CII_PARSE_FAILED.
//   6. UTF-8 BOM is stripped before parsing.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { EInvoice } from '../../../types/invoice.js';
import { XRECHNUNG_DE_PROFILE_ID, XRECHNUNG_KLEINUNTERNEHMER_REASON } from '../constants.js';
import { generateXRechnungCii } from '../generator.js';
import type { ParserError } from '../parser.js';
import { parseXrechnungCii } from '../parser.js';

const Dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Fixture helpers
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

/**
 * Replace the CustomizationID (GuidelineSpecifiedDocumentContextParameter/ID)
 * in a generator-produced CII XML so we can synthesise fixtures for the
 * unsupported-level + extended-level branches without hand-writing XML.
 */
function replaceGuidelineUrn(xml: string, newUrn: string): string {
  // Match the second <ram:ID> inside <ram:GuidelineSpecifiedDocumentContextParameter>.
  // The generator emits:
  //   <ram:GuidelineSpecifiedDocumentContextParameter>
  //     <ram:ID>urn:cen.eu:en16931:2017#compliant#...</ram:ID>
  //   </ram:GuidelineSpecifiedDocumentContextParameter>
  return xml.replace(
    /(<ram:GuidelineSpecifiedDocumentContextParameter>\s*<ram:ID>)[^<]+(<\/ram:ID>)/,
    `$1${newUrn}$2`,
  );
}

// ---------------------------------------------------------------------------
// 1. Round-trip
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — round-trip through generator', () => {
  it('preserves header fields through generate → parse', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { invoice, profileLevel } = parseXrechnungCii(xml);

    expect(profileLevel).toBe('XRECHNUNG');
    expect(invoice.id).toBe(original.id);
    expect(invoice.issueDate).toBe(original.issueDate);
    expect(invoice.dueDate).toBe(original.dueDate);
    expect(invoice.invoiceTypeCode).toBe(original.invoiceTypeCode);
    expect(invoice.currencyCode).toBe(original.currencyCode);
  });

  it('preserves monetary totals through generate → parse', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { invoice } = parseXrechnungCii(xml);

    expect(invoice.taxExclusiveAmount).toBe(original.taxExclusiveAmount);
    expect(invoice.taxInclusiveAmount).toBe(original.taxInclusiveAmount);
    expect(invoice.payableAmount).toBe(original.payableAmount);
  });

  it('preserves party name + id + country through generate → parse', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { invoice } = parseXrechnungCii(xml);

    expect(invoice.supplier.name).toBe(original.supplier.name);
    expect(invoice.supplier.id).toBe(original.supplier.id);
    expect(invoice.supplier.country).toBe(original.supplier.country);
    expect(invoice.customer.name).toBe(original.customer.name);
    expect(invoice.customer.country).toBe(original.customer.country);
  });

  it('preserves line items (lineNumber + description + net total)', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { invoice } = parseXrechnungCii(xml);

    expect(invoice.lines).toHaveLength(1);
    expect(invoice.lines[0].lineNumber).toBe(1);
    expect(invoice.lines[0].description).toBe('Consulting services');
    expect(invoice.lines[0].netAmountMinor).toBe(100000);
    expect(invoice.lines[0].unit).toBe('HUR');
    expect(invoice.lines[0].quantity).toBe(10);
  });

  it('preserves tax breakdown (category, taxable, tax, percent)', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { invoice } = parseXrechnungCii(xml);

    expect(invoice.taxBreakdown).toHaveLength(1);
    expect(invoice.taxBreakdown[0].taxCategory).toBe('S');
    expect(invoice.taxBreakdown[0].taxableAmountMinor).toBe(100000);
    expect(invoice.taxBreakdown[0].taxAmountMinor).toBe(19000);
    expect(invoice.taxBreakdown[0].percent).toBe(19);
  });

  it('does not emit warnings on a clean round-trip of an XRECHNUNG invoice', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const { warnings } = parseXrechnungCii(xml);

    // Zero warnings — no unmapped keys, no extended flag.
    expect(warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. KoSIT positive minimal fixture
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — KoSIT positive-minimal fixture', () => {
  it('parses fixture as XRECHNUNG with zero error warnings', () => {
    const fixturePath = path.join(Dirname, 'fixtures', 'kosit-positive-minimal.xml');
    const xml = readFileSync(fixturePath, 'utf8');
    const { invoice, profileLevel, warnings } = parseXrechnungCii(xml);

    expect(profileLevel).toBe('XRECHNUNG');
    expect(invoice.id).toBe('INV-2026-0001');
    expect(invoice.currencyCode).toBe('EUR');
    // Fixture has extra CII decoration (DefinedTradeContact, IBAN, etc.)
    // that we ship as UNMAPPED_FIELD warnings; assert none of them are the
    // best-effort-extended flag (which would mean we mis-detected level).
    expect(warnings.some(w => w.code === 'LEVEL_EXTENDED_BEST_EFFORT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. MINIMUM profile → ZUGFERD_LEVEL_UNSUPPORTED
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — unsupported MINIMUM profile', () => {
  it('throws ZUGFERD_LEVEL_UNSUPPORTED for Factur-X MINIMUM guideline URN', () => {
    const xml = replaceGuidelineUrn(
      generateXRechnungCii(makeMinimalInvoice(), null),
      'urn:factur-x.eu:1p0:minimum',
    );

    let thrown: unknown;
    try {
      parseXrechnungCii(xml);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeDefined();
    const err = thrown as ParserError;
    expect(err.code).toBe('ZUGFERD_LEVEL_UNSUPPORTED');
    if (err.code === 'ZUGFERD_LEVEL_UNSUPPORTED') {
      expect(err.level).toBe('urn:factur-x.eu:1p0:minimum');
    }
  });

  it('throws ZUGFERD_LEVEL_UNSUPPORTED for ZUGFeRD 2p1 basicwl guideline URN', () => {
    const xml = replaceGuidelineUrn(
      generateXRechnungCii(makeMinimalInvoice(), null),
      'urn:zugferd.de:2p1:basicwl',
    );

    let thrown: unknown;
    try {
      parseXrechnungCii(xml);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as ParserError;
    expect(err.code).toBe('ZUGFERD_LEVEL_UNSUPPORTED');
  });
});

// ---------------------------------------------------------------------------
// 4. EXTENDED profile → LEVEL_EXTENDED_BEST_EFFORT warning
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — EXTENDED profile best-effort warning', () => {
  it('returns profileLevel=EXTENDED with exactly one LEVEL_EXTENDED_BEST_EFFORT warning', () => {
    const xml = replaceGuidelineUrn(
      generateXRechnungCii(makeMinimalInvoice(), null),
      'urn:factur-x.eu:1p0:extended',
    );
    const { profileLevel, warnings } = parseXrechnungCii(xml);

    expect(profileLevel).toBe('EXTENDED');
    const extendedWarnings = warnings.filter(w => w.code === 'LEVEL_EXTENDED_BEST_EFFORT');
    expect(extendedWarnings).toHaveLength(1);
    expect(extendedWarnings[0].message).toMatch(/EXTENDED/i);
  });
});

// ---------------------------------------------------------------------------
// 5. Malformed XML → CII_PARSE_FAILED
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — malformed XML', () => {
  it('throws CII_PARSE_FAILED on unclosed tag', () => {
    // fast-xml-parser's default mode is lenient; when there is no valid CII
    // root at all we still throw CII_PARSE_FAILED because the tree lacks
    // <rsm:CrossIndustryInvoice>.
    const malformed = '<not-cii><nope';

    let thrown: unknown;
    try {
      parseXrechnungCii(malformed);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as ParserError;
    expect(err.code).toBe('CII_PARSE_FAILED');
  });

  it('throws CII_PARSE_FAILED on missing CII root element', () => {
    const notCii =
      '<?xml version="1.0" encoding="UTF-8"?>\n<someOtherRoot><child/></someOtherRoot>';

    let thrown: unknown;
    try {
      parseXrechnungCii(notCii);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as ParserError;
    expect(err.code).toBe('CII_PARSE_FAILED');
    if (err.code === 'CII_PARSE_FAILED') {
      expect(err.message).toMatch(/CrossIndustryInvoice/);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. UTF-8 BOM handling
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — UTF-8 BOM stripping', () => {
  it('parses a BOM-prefixed CII XML successfully', () => {
    const original = makeMinimalInvoice();
    const xml = generateXRechnungCii(original, null);
    const withBom = `\uFEFF${xml}`;
    const { invoice, profileLevel } = parseXrechnungCii(withBom);

    expect(profileLevel).toBe('XRECHNUNG');
    expect(invoice.id).toBe(original.id);
  });
});

// ---------------------------------------------------------------------------
// 7. Kleinunternehmer (§19 UStG) — tax category E round-trip
//    (supplementary coverage — not counted in the 6 mandated branches)
// ---------------------------------------------------------------------------

describe('parseXrechnungCii — Kleinunternehmer (§19) tax category', () => {
  it('round-trips tax category E with ExemptionReason preserved in source XML', () => {
    const original = makeMinimalInvoice({
      lines: [
        {
          lineNumber: 1,
          description: 'Freelance service',
          quantity: 1,
          unit: 'C62',
          unitPriceMinor: 50000,
          netAmountMinor: 50000,
          vatRate: '0',
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
    const xml = generateXRechnungCii(original, null);
    // Source XML must carry the §19 locked phrase
    expect(xml).toContain(XRECHNUNG_KLEINUNTERNEHMER_REASON);
    const { invoice } = parseXrechnungCii(xml);
    expect(invoice.taxBreakdown[0].taxCategory).toBe('E');
  });
});
