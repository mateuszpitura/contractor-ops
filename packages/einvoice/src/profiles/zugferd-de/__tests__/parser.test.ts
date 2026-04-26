// Phase 62 · Plan 62-02 Task 5 — ZUGFeRD PDF parser unit tests.
//
// Fixtures are generated deterministically at test-time via pdf-lib + the
// existing XRechnung CII generator — this keeps fixture bytes out of version
// control (no binary churn) while still exercising the full PDF → CII
// pipeline end-to-end.
//
// Five branches (matching plan):
//   1. Happy path: factur-x.xml attachment → COMFORT level + correct invoice.
//   2. No attachment: plain PDF → ZUGFERD_NO_XML_ATTACHMENT.
//   3. Unsupported level propagation: MINIMUM URN inside PDF → ZUGFERD_LEVEL_UNSUPPORTED.
//   4. Malformed PDF: random bytes → ZUGFERD_PDF_UNREADABLE.
//   5. AFRelationship fallback: embedded file named `invoice.xml` with
//      AFRelationship=Alternative still resolves.

import { AFRelationship, PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import type { EInvoice } from '../../../types/invoice.js';
import { XRECHNUNG_DE_PROFILE_ID } from '../../xrechnung-de/constants.js';
import { generateXRechnungCii } from '../../xrechnung-de/generator.js';
import type { ZugferdParserError } from '../parser.js';
import { parseZugferdPdf } from '../parser.js';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeMinimalInvoice(overrides: Partial<EInvoice> = {}): EInvoice {
  return {
    id: 'ZF-2026-0001',
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

/** Generate CII XML, then wrap it into a blank PDF with the given attachment name + relationship. */
async function buildZugferdPdf(options: {
  invoice?: EInvoice;
  guidelineUrn?: string;
  attachmentName?: string;
  afRelationship?: AFRelationship;
}): Promise<Uint8Array> {
  const invoice = options.invoice ?? makeMinimalInvoice();
  let xml = generateXRechnungCii(invoice, null);
  if (options.guidelineUrn) {
    xml = xml.replace(
      /(<ram:GuidelineSpecifiedDocumentContextParameter>\s*<ram:ID>)[^<]+(<\/ram:ID>)/,
      `$1${options.guidelineUrn}$2`,
    );
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]);

  const xmlBytes = new TextEncoder().encode(xml);
  await pdfDoc.attach(xmlBytes, options.attachmentName ?? 'factur-x.xml', {
    mimeType: 'application/xml',
    description: 'ZUGFeRD CII invoice payload',
    afRelationship: options.afRelationship ?? AFRelationship.Alternative,
    creationDate: new Date('2026-04-14T00:00:00Z'),
    modificationDate: new Date('2026-04-14T00:00:00Z'),
  });

  return pdfDoc.save();
}

/** Build a blank PDF with no attachments. */
async function buildPlainPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]);
  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// Pre-computed fixtures (generated once per test run)
// ---------------------------------------------------------------------------

let happyPathPdf: Uint8Array;
let plainPdf: Uint8Array;
let minimumProfilePdf: Uint8Array;
let fallbackNamePdf: Uint8Array;

beforeAll(async () => {
  happyPathPdf = await buildZugferdPdf({});
  plainPdf = await buildPlainPdf();
  minimumProfilePdf = await buildZugferdPdf({
    guidelineUrn: 'urn:factur-x.eu:1p0:minimum',
  });
  fallbackNamePdf = await buildZugferdPdf({
    attachmentName: 'invoice.xml',
    afRelationship: AFRelationship.Alternative,
  });
});

// ---------------------------------------------------------------------------
// 1. Happy path — factur-x.xml → COMFORT + correct invoice fields
// ---------------------------------------------------------------------------

describe('parseZugferdPdf — happy path (factur-x.xml attachment)', () => {
  it('extracts the embedded XML and returns XRECHNUNG level + invoice', async () => {
    const parsed = await parseZugferdPdf(happyPathPdf);

    expect(parsed.profileLevel).toBe('XRECHNUNG');
    expect(parsed.invoice.id).toBe('ZF-2026-0001');
    expect(parsed.invoice.currencyCode).toBe('EUR');
    expect(parsed.invoice.supplier.id).toBe('DE123456789');
  });

  it('exposes rawPdfBuffer === input bytes + non-empty extractedXml', async () => {
    const parsed = await parseZugferdPdf(happyPathPdf);

    expect(parsed.rawPdfBuffer).toBe(happyPathPdf);
    expect(parsed.extractedXml.length).toBeGreaterThan(0);
    expect(parsed.extractedXml).toContain('<rsm:CrossIndustryInvoice');
  });
});

// ---------------------------------------------------------------------------
// 2. No attachment → ZUGFERD_NO_XML_ATTACHMENT
// ---------------------------------------------------------------------------

describe('parseZugferdPdf — no XML attachment', () => {
  it('throws ZUGFERD_NO_XML_ATTACHMENT on a plain blank PDF', async () => {
    let thrown: unknown;
    try {
      await parseZugferdPdf(plainPdf);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as ZugferdParserError;
    expect(err.code).toBe('ZUGFERD_NO_XML_ATTACHMENT');
    if (err.code === 'ZUGFERD_NO_XML_ATTACHMENT') {
      expect(err.message).toContain('factur-x.xml');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Unsupported level → ZUGFERD_LEVEL_UNSUPPORTED bubbles from inner parser
// ---------------------------------------------------------------------------

describe('parseZugferdPdf — unsupported MINIMUM level propagation', () => {
  it('throws ZUGFERD_LEVEL_UNSUPPORTED when embedded XML is MINIMUM profile', async () => {
    let thrown: unknown;
    try {
      await parseZugferdPdf(minimumProfilePdf);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as { code?: string; level?: string };
    expect(err.code).toBe('ZUGFERD_LEVEL_UNSUPPORTED');
    expect(err.level).toBe('urn:factur-x.eu:1p0:minimum');
  });
});

// ---------------------------------------------------------------------------
// 4. Malformed PDF → ZUGFERD_PDF_UNREADABLE
// ---------------------------------------------------------------------------

describe('parseZugferdPdf — malformed PDF', () => {
  it('throws ZUGFERD_PDF_UNREADABLE on random bytes', async () => {
    const randomBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

    let thrown: unknown;
    try {
      await parseZugferdPdf(randomBytes);
    } catch (e) {
      thrown = e;
    }

    const err = thrown as ZugferdParserError;
    expect(err.code).toBe('ZUGFERD_PDF_UNREADABLE');
  });
});

// ---------------------------------------------------------------------------
// 5. AFRelationship fallback — different filename accepted
// ---------------------------------------------------------------------------

describe('parseZugferdPdf — AFRelationship fallback', () => {
  it('accepts an attachment named invoice.xml when AFRelationship=Alternative', async () => {
    const parsed = await parseZugferdPdf(fallbackNamePdf);

    expect(parsed.profileLevel).toBe('XRECHNUNG');
    expect(parsed.invoice.id).toBe('ZF-2026-0001');
    expect(parsed.extractedXml).toContain('<rsm:CrossIndustryInvoice');
  });
});
