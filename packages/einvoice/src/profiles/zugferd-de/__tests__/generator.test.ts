// Phase 62 · Plan 62-03 Task 5 — generateZugferdPdf end-to-end tests.
//
// Covers:
//   1. Happy path bytes > 10000.
//   2. Structural check passes on output.
//   3. Reverse-charge fixture CII contains <ram:CategoryCode>AE</...>.
//   4. Kleinunternehmer fixture CII contains <ram:CategoryCode>E</...>.
//   5. conformanceLevel: 'EXTENDED' throws ZugferdLevelUnsupportedForOutput.
//   6. conformanceLevel: 'MINIMUM' (as any) throws the same error.

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { PDFHexString, PDFRawStream, PDFString } from 'pdf-lib';
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import type { EInvoice } from '../../../types/invoice.js';
import { generateZugferdPdf, ZugferdLevelUnsupportedForOutput } from '../generator.js';
import { assertZugferdStructure } from '../zugferd-structural-check.js';

const FIXED_TIME = new Date('2026-01-15T10:00:00Z');

async function loadFixture(name: string): Promise<EInvoice> {
  const p = fileURLToPath(new URL(`../__fixtures__/${name}.json`, import.meta.url));
  return JSON.parse(await fs.readFile(p, 'utf-8')) as EInvoice;
}

async function extractCiiXml(pdf: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  // Walk /AF first (set by pdf-lib attach()).
  const afRef = doc.catalog.get(PDFName.of('AF'));
  if (afRef) {
    const afArr = doc.context.lookup(afRef) as unknown as {
      asArray?: () => unknown[];
    };
    const items = afArr.asArray ? afArr.asArray() : [];
    for (const fsRef of items) {
      const fs = doc.context.lookup(fsRef as never, PDFDict);
      const uf = fs.get(PDFName.of('UF'));
      let filename: string | null = null;
      if (uf && typeof (uf as PDFHexString).decodeText === 'function') {
        filename = (uf as PDFHexString).decodeText();
      } else if (uf && typeof (uf as PDFString).asString === 'function') {
        filename = (uf as PDFString).asString();
      }
      if (filename === 'factur-x.xml') {
        const efRef = fs.get(PDFName.of('EF'));
        const ef = doc.context.lookup(efRef!, PDFDict);
        const ufStreamRef = ef.get(PDFName.of('UF')) ?? ef.get(PDFName.of('F'));
        const stream = doc.context.lookup(ufStreamRef!) as PDFRawStream;
        const bytes = decodePDFRawStream(stream).decode();
        return new TextDecoder().decode(bytes);
      }
    }
  }
  throw new Error('factur-x.xml not found in /AF');
}

describe('generateZugferdPdf', () => {
  let comfortMinimal: EInvoice;
  let reverseCharge: EInvoice;
  let klein: EInvoice;
  // Phase 68 D-05 — Skonto-bearing fixture for the embedded-CII BG-20 test.
  let comfortSkonto: EInvoice;

  beforeAll(async () => {
    comfortMinimal = await loadFixture('comfort-minimal');
    reverseCharge = await loadFixture('reverse-charge-leitweg');
    klein = await loadFixture('kleinunternehmer');
    comfortSkonto = await loadFixture('comfort-skonto');
  });

  it('happy path: comfort-minimal returns Uint8Array > 10000 bytes', async () => {
    const out = await generateZugferdPdf({
      invoice: comfortMinimal,
      producedAt: FIXED_TIME,
    });
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBeGreaterThan(10000);
  });

  it('structural check passes on output', async () => {
    const out = await generateZugferdPdf({
      invoice: comfortMinimal,
      producedAt: FIXED_TIME,
    });
    await expect(assertZugferdStructure(out)).resolves.toBeUndefined();
  });

  it('reverse-charge embedded XML contains <ram:CategoryCode>AE</...>', async () => {
    const leitwegId = (reverseCharge.extensions as Record<string, unknown>)?.supplierLeitwegId;
    const out = await generateZugferdPdf({
      invoice: reverseCharge,
      producedAt: FIXED_TIME,
      leitwegId: typeof leitwegId === 'string' ? leitwegId : null,
    });
    const xml = await extractCiiXml(out);
    expect(xml).toContain('<ram:CategoryCode>AE</ram:CategoryCode>');
  });

  it('kleinunternehmer embedded XML contains <ram:CategoryCode>E</...>', async () => {
    const out = await generateZugferdPdf({
      invoice: klein,
      producedAt: FIXED_TIME,
    });
    const xml = await extractCiiXml(out);
    expect(xml).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
  });

  it("conformanceLevel: 'EXTENDED' throws ZugferdLevelUnsupportedForOutput", async () => {
    await expect(
      generateZugferdPdf({
        invoice: comfortMinimal,
        conformanceLevel: 'EXTENDED',
        producedAt: FIXED_TIME,
      }),
    ).rejects.toBeInstanceOf(ZugferdLevelUnsupportedForOutput);
  });

  it("conformanceLevel: 'MINIMUM' (cast) throws ZugferdLevelUnsupportedForOutput", async () => {
    const err = await generateZugferdPdf({
      invoice: comfortMinimal,
      // biome-ignore lint/suspicious/noExplicitAny: test-only widening
      conformanceLevel: 'MINIMUM' as unknown as 'COMFORT',
      producedAt: FIXED_TIME,
    }).catch(e => e);
    expect(err).toBeInstanceOf(ZugferdLevelUnsupportedForOutput);
    expect((err as ZugferdLevelUnsupportedForOutput).code).toBe(
      'ZUGFERD_LEVEL_UNSUPPORTED_FOR_OUTPUT',
    );
  });

  // -----------------------------------------------------------------------
  // Phase 68 · Plan 04 — Skonto BG-20 in embedded CII (end-to-end)
  //
  // Closes the embedded-CII half of the v5.0 audit I-1 finding for the
  // ZUGFeRD path. The router half (call-shape assertion against the
  // mocked generator) is locked by Plan 05's
  // packages/api/src/routers/__tests__/einvoice.generate-zugferd.test.ts
  // extension. Together the two halves prove the Skonto term reaches the
  // embedded factur-x.xml when a Skonto-bearing DE invoice is finalized
  // through the ZUGFeRD path.
  // -----------------------------------------------------------------------

  it('Skonto path: extracted CII contains structured BG-20 #SKONTO# extension (Phase 68 D-05/D-08 Layer C)', async () => {
    const out = await generateZugferdPdf({
      invoice: comfortSkonto,
      producedAt: FIXED_TIME,
      skontoTerm: {
        discountPercent: 3,
        discountPeriodDays: 7,
        netPeriodDays: 30,
      },
    });
    const cii = await extractCiiXml(out);
    expect(cii).toContain('<ram:SpecifiedTradePaymentTerms>');
    expect(cii).toContain('#SKONTO#TAGE=7');
    expect(cii).toContain('#PROZENT=3.00');
    expect(cii).toContain('#BASISBETRAG=');
  });

  it('No-Skonto path: extracted CII does NOT contain #SKONTO# (no-regression on Phase 62 behaviour)', async () => {
    const out = await generateZugferdPdf({
      invoice: comfortMinimal,
      producedAt: FIXED_TIME,
    });
    const cii = await extractCiiXml(out);
    expect(cii).not.toContain('#SKONTO#');
  });
});
