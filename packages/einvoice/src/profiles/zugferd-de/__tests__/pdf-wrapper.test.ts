// Phase 62 · Plan 62-03 Task 2 — PDF/A-3 wrapper tests.
//
// Covers the 6 acceptance-criteria assertions:
//   1. Wrapped PDF reloads cleanly via PDFDocument.load.
//   2. Catalog /Metadata contains pdfaid:part>3 substring.
//   3. /Names /EmbeddedFiles contains factur-x.xml entry.
//   4. /OutputIntents array has /S=/GTS_PDFA1.
//   5. DestOutputProfile bytes sha256 === bundled sRGB2014.icc sha256.
//   6. /Info /Producer === opts.creatorTool.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  PDFDocument,
  PDFDict,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import { wrapToPdfA3 } from '../pdf-wrapper.js';

const ICC_PATH = fileURLToPath(
  new URL('../assets/sRGB2014.icc', import.meta.url),
);

const TRIVIAL_CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <rsm:ExchangedDocument><ram:ID>TEST-001</ram:ID></rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>`;

const BASE_OPTS = {
  conformanceLevel: 'COMFORT' as const,
  documentTitle: 'Invoice TEST-001',
  creatorTool: '@contractor-ops/einvoice 5.0',
  producedAt: new Date('2026-04-15T10:00:00Z'),
};

async function buildMinimalPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawText('Invoice', { x: 72, y: 770 });
  return doc.save({ useObjectStreams: false });
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('wrapToPdfA3', () => {
  let basePdf: Uint8Array;
  let wrapped: Uint8Array;
  let wrappedDoc: PDFDocument;
  let iccSha: string;

  beforeAll(async () => {
    basePdf = await buildMinimalPdf();
    wrapped = await wrapToPdfA3(basePdf, TRIVIAL_CII, BASE_OPTS);
    wrappedDoc = await PDFDocument.load(wrapped, { updateMetadata: false });
    const iccBytes = new Uint8Array(await fs.readFile(ICC_PATH));
    iccSha = sha256(iccBytes);
  });

  it('wrapped output reloads via PDFDocument.load without throwing', async () => {
    await expect(
      PDFDocument.load(wrapped, { updateMetadata: false }),
    ).resolves.toBeDefined();
  });

  it('catalog /Metadata stream bytes contain pdfaid:part>3', () => {
    const catalog = wrappedDoc.catalog;
    const metaRef = catalog.get(PDFName.of('Metadata'));
    expect(metaRef).toBeDefined();
    const metaStream = wrappedDoc.context.lookup(metaRef!);
    expect(metaStream).toBeInstanceOf(PDFRawStream);
    const metaBytes = decodePDFRawStream(metaStream as PDFRawStream).decode();
    const xml = new TextDecoder().decode(metaBytes);
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
  });

  it('catalog /Names /EmbeddedFiles contains factur-x.xml entry', () => {
    const catalog = wrappedDoc.catalog;
    const namesRef = catalog.get(PDFName.of('Names'));
    expect(namesRef).toBeDefined();
    const names = wrappedDoc.context.lookup(namesRef!, PDFDict);
    const embedded = names.get(PDFName.of('EmbeddedFiles'));
    expect(embedded).toBeDefined();
    // Walk the first-level /Names array to find factur-x.xml
    const tree = wrappedDoc.context.lookup(embedded!, PDFDict);
    const entries = collectNameTreeNames(wrappedDoc, tree);
    expect(entries).toContain('factur-x.xml');
  });

  it('/OutputIntents is a non-empty array whose first entry has /S=/GTS_PDFA1', () => {
    const catalog = wrappedDoc.catalog;
    const outputIntentsRef = catalog.get(PDFName.of('OutputIntents'));
    expect(outputIntentsRef).toBeDefined();
    const outputIntents = wrappedDoc.context.lookup(outputIntentsRef!);
    // Could be an indirect array ref or a direct array.
    const arr = outputIntents as unknown as { asArray?: () => unknown[] };
    const items = arr.asArray ? arr.asArray() : [];
    expect(items.length).toBeGreaterThanOrEqual(1);
    const first = wrappedDoc.context.lookup(items[0] as never, PDFDict);
    const s = first.get(PDFName.of('S'));
    expect(s?.toString()).toBe('/GTS_PDFA1');
  });

  it('DestOutputProfile bytes sha256 matches bundled sRGB2014.icc', () => {
    const catalog = wrappedDoc.catalog;
    const outputIntentsRef = catalog.get(PDFName.of('OutputIntents'));
    const outputIntents = wrappedDoc.context.lookup(outputIntentsRef!);
    const arr = outputIntents as unknown as { asArray?: () => unknown[] };
    const items = arr.asArray ? arr.asArray() : [];
    const first = wrappedDoc.context.lookup(items[0] as never, PDFDict);
    const profileRef = first.get(PDFName.of('DestOutputProfile'));
    const profileStream = wrappedDoc.context.lookup(profileRef!, PDFStream) as unknown as PDFRawStream;
    const profileBytes = decodePDFRawStream(profileStream).decode();
    expect(sha256(profileBytes)).toBe(iccSha);
  });

  it('/Info /Producer matches opts.creatorTool', () => {
    const info = wrappedDoc.getProducer();
    expect(info).toBe(BASE_OPTS.creatorTool);
  });

  it('/Info /Title matches opts.documentTitle', () => {
    expect(wrappedDoc.getTitle()).toBe(BASE_OPTS.documentTitle);
  });

  it('deterministic: same input → same bytes (modulo pdf-lib nondeterminism)', async () => {
    const a = await wrapToPdfA3(basePdf, TRIVIAL_CII, BASE_OPTS);
    const b = await wrapToPdfA3(basePdf, TRIVIAL_CII, BASE_OPTS);
    expect(a).toEqual(b);
  });
});

// Walk a /Names tree (which is a nested dict with /Names + /Kids) and
// collect all string name keys. PDFs from pdf-lib with a single attachment
// produce a flat /Names array at the root.
function collectNameTreeNames(doc: PDFDocument, node: PDFDict): string[] {
  const out: string[] = [];
  const namesRef = node.get(PDFName.of('Names'));
  if (namesRef) {
    const namesArr = doc.context.lookup(namesRef) as unknown as {
      asArray?: () => unknown[];
    };
    const items = namesArr.asArray ? namesArr.asArray() : [];
    for (let i = 0; i < items.length; i += 2) {
      const key = items[i];
      // Prefer decodeText (PDFHexString with UTF-16BE BOM) over asString
      // (PDFString, Latin-1). pdf-lib attach() emits hex strings.
      const keyVal = key as PDFString | PDFHexString;
      if (typeof (keyVal as PDFHexString).decodeText === 'function') {
        out.push((keyVal as PDFHexString).decodeText());
      } else if (typeof (keyVal as PDFString).asString === 'function') {
        out.push((keyVal as PDFString).asString());
      }
    }
  }
  const kidsRef = node.get(PDFName.of('Kids'));
  if (kidsRef) {
    const kidsArr = doc.context.lookup(kidsRef) as unknown as {
      asArray?: () => unknown[];
    };
    const items = kidsArr.asArray ? kidsArr.asArray() : [];
    for (const kidRef of items) {
      const kid = doc.context.lookup(kidRef as never, PDFDict);
      out.push(...collectNameTreeNames(doc, kid));
    }
  }
  return out;
}
