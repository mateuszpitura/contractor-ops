// Phase 62 · Plan 62-03 Task 3 — Structural check tests.
//
// Covers the 5 acceptance-criteria scenarios:
//   1. Fully-wrapped PDF resolves without throw.
//   2. Plain PDF (no XMP/AF/OutputIntent) → MISSING_METADATA.
//   3. PDF with XMP but no /OutputIntents → MISSING_OUTPUT_INTENT.
//   4. PDF with XMP declaring pdfaid:part>1 → XMP_PDFA_PART_MISMATCH.
//   5. PDF with embedded invoice.xml (not factur-x.xml) → WRONG_EMBEDDED_FILENAME.

import {
  AFRelationship,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFString,
} from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import { wrapToPdfA3 } from '../pdf-wrapper.js';
import {
  ZugferdWrappingError,
  assertZugferdStructure,
} from '../zugferd-structural-check.js';

const TRIVIAL_CII = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <rsm:ExchangedDocument><ram:ID>TEST-001</ram:ID></rsm:ExchangedDocument>
</rsm:CrossIndustryInvoice>`;

const WRAP_OPTS = {
  conformanceLevel: 'COMFORT' as const,
  documentTitle: 'Invoice TEST-001',
  creatorTool: '@contractor-ops/einvoice 5.0',
  producedAt: new Date('2026-04-15T10:00:00Z'),
};

async function makeBasePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  return doc.save({ useObjectStreams: false });
}

describe('assertZugferdStructure', () => {
  let wrappedHappy: Uint8Array;

  beforeAll(async () => {
    const basePdf = await makeBasePdf();
    wrappedHappy = await wrapToPdfA3(basePdf, TRIVIAL_CII, WRAP_OPTS);
  });

  it('fully-wrapped PDF resolves without throwing', async () => {
    await expect(assertZugferdStructure(wrappedHappy)).resolves.toBeUndefined();
  });

  it('plain PDF with no XMP/AF/OutputIntent throws MISSING_METADATA', async () => {
    const plain = await makeBasePdf();
    const err = await assertZugferdStructure(plain).catch(e => e);
    expect(err).toBeInstanceOf(ZugferdWrappingError);
    expect((err as ZugferdWrappingError).code).toBe('ZUGFERD_WRAPPING_FAILED');
    expect((err as ZugferdWrappingError).subcode).toBe('MISSING_METADATA');
  });

  it('PDF with XMP but no /OutputIntents throws MISSING_OUTPUT_INTENT', async () => {
    // Manually craft a PDF with correct XMP metadata but no OutputIntents.
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const xmp = new TextEncoder().encode(
      `<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`,
    );
    const metaStream = doc.context.stream(xmp, {
      Type: PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
      Length: PDFNumber.of(xmp.length),
    });
    const metaRef = doc.context.register(metaStream);
    doc.catalog.set(PDFName.of('Metadata'), metaRef);
    // Attach a factur-x.xml so we don't trip the embedded-file check first.
    await doc.attach(new TextEncoder().encode('<x/>'), 'factur-x.xml', {
      afRelationship: AFRelationship.Alternative,
    });
    const bytes = await doc.save({ useObjectStreams: false });

    const err = await assertZugferdStructure(bytes).catch(e => e);
    expect(err).toBeInstanceOf(ZugferdWrappingError);
    expect((err as ZugferdWrappingError).subcode).toBe('MISSING_OUTPUT_INTENT');
  });

  it('PDF with XMP declaring pdfaid:part>1 throws XMP_PDFA_PART_MISMATCH', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    // Deliberately wrong: pdfaid:part is 1, not 3.
    const xmp = new TextEncoder().encode(
      `<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>1</pdfaid:part></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`,
    );
    const metaStream = doc.context.stream(xmp, {
      Type: PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
      Length: PDFNumber.of(xmp.length),
    });
    const metaRef = doc.context.register(metaStream);
    doc.catalog.set(PDFName.of('Metadata'), metaRef);
    const bytes = await doc.save({ useObjectStreams: false });

    const err = await assertZugferdStructure(bytes).catch(e => e);
    expect(err).toBeInstanceOf(ZugferdWrappingError);
    expect((err as ZugferdWrappingError).subcode).toBe('XMP_PDFA_PART_MISMATCH');
  });

  it('PDF with embedded invoice.xml (not factur-x.xml) throws WRONG_EMBEDDED_FILENAME', async () => {
    // Build a PDF that has valid XMP + OutputIntent + an embedded XML
    // named `invoice.xml` (not `factur-x.xml`). This exercises the
    // WRONG_EMBEDDED_FILENAME branch — the structural check sees an
    // attachment but its name is wrong.
    const basePdf = await makeBasePdf();
    const wrapped = await wrapToPdfA3(basePdf, TRIVIAL_CII, WRAP_OPTS);

    // Reload, rename the /AF + /Names entry from factur-x.xml to invoice.xml,
    // then re-save. We achieve this by a fresh build with a different name.
    const doc = await PDFDocument.load(wrapped, { updateMetadata: false });
    // Null out the /AF + /Names EmbeddedFiles by attaching a different file
    // name into a fresh doc copy. Simplest path: build fresh.
    const fresh = await PDFDocument.create();
    fresh.addPage([595, 842]);
    // Copy XMP + OutputIntents from wrapped to fresh.
    const origMeta = doc.catalog.get(PDFName.of('Metadata'));
    const origOi = doc.catalog.get(PDFName.of('OutputIntents'));
    // Simple path: attach `invoice.xml` (wrong name) + copy metadata stream.
    await fresh.attach(new TextEncoder().encode(TRIVIAL_CII), 'invoice.xml', {
      afRelationship: AFRelationship.Alternative,
    });
    // Inject fresh Metadata stream (same content as happy path) so
    // MISSING_METADATA / XMP checks pass and we land on the filename check.
    const xmp = new TextEncoder().encode(
      `<?xpacket begin=""?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`,
    );
    const metaStream = fresh.context.stream(xmp, {
      Type: PDFName.of('Metadata'),
      Subtype: PDFName.of('XML'),
      Length: PDFNumber.of(xmp.length),
    });
    const metaRef = fresh.context.register(metaStream);
    fresh.catalog.set(PDFName.of('Metadata'), metaRef);
    // And synthesise a /OutputIntents so we don't trip MISSING_OUTPUT_INTENT.
    const dummyOi = fresh.context.obj({
      Type: PDFName.of('OutputIntent'),
      S: PDFName.of('GTS_PDFA1'),
      OutputConditionIdentifier: PDFString.of('sRGB'),
    });
    const oiRef = fresh.context.register(dummyOi);
    fresh.catalog.set(
      PDFName.of('OutputIntents'),
      fresh.context.obj([oiRef]),
    );
    const bytes = await fresh.save({ useObjectStreams: false });

    const err = await assertZugferdStructure(bytes).catch(e => e);
    expect(err).toBeInstanceOf(ZugferdWrappingError);
    expect((err as ZugferdWrappingError).subcode).toBe(
      'WRONG_EMBEDDED_FILENAME',
    );
  });

  it('error .code is the stable discriminant ZUGFERD_WRAPPING_FAILED', () => {
    const err = new ZugferdWrappingError('MISSING_METADATA', 'test');
    expect(err.code).toBe('ZUGFERD_WRAPPING_FAILED');
    expect(err.name).toBe('ZugferdWrappingError');
    expect(err.message).toContain('[MISSING_METADATA]');
  });
});
