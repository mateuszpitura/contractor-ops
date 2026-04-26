// Phase 62 · Plan 62-03 Task 2 — PDF/A-3 wrapper.
//
// Takes a visual-only PDF (produced by `invoice-template.tsx` via
// @react-pdf/renderer) plus the CII XML string (produced by
// `generateXRechnungCii`) and merges them into a single ZUGFeRD / Factur-X
// PDF/A-3 B compliant document:
//
//   1. Load the base PDF bytes via pdf-lib (no re-layout, no re-encode).
//   2. Force catalog /Version to 1.7 (PDF/A-3 is defined over PDF 1.7).
//   3. Attach `factur-x.xml` via `PDFDocument.attach()` with
//      AFRelationship=Alternative — pdf-lib populates both /Names
//      /EmbeddedFiles and the catalog /AF array so inbound parsers find
//      the XML by either path.
//   4. Build + embed the XMP packet (`xmp-template.ts`) as a /Metadata
//      stream on the catalog. MUST be present in a direct-object stream —
//      PDF/A-3 veraPDF rules reject Metadata-inside-ObjStm.
//   5. Embed the sRGB ICC profile as /OutputIntent/DestOutputProfile with
//      /S=/GTS_PDFA1. PDF/A-3 spec mandates exactly one OutputIntents entry.
//   6. Synchronise Info-dict Title / Producer / Creator / CreationDate /
//      ModDate with XMP (veraPDF rule 6.7.3 — Info ↔ XMP parity).
//   7. Save with { useObjectStreams: false } — PDF/A-3 forbids ObjStm for
//      many catalog + metadata objects; turning it off globally is the
//      safest default.
//
// The wrapper does NOT:
//   * Run veraPDF conformance (that is Plan 03 Task 6 CI).
//   * Assert structural invariants (that is zugferd-structural-check.ts).
//   * Register fonts (the base PDF from React-PDF already has Noto Sans
//     embedded by `invoice-template.tsx`).

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { createLogger } from '@contractor-ops/logger';
import { AFRelationship, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib';
import type { ZugferdConformanceLevel } from './constants.js';
import { ZUGFERD_ATTACHMENT_FILENAME, ZUGFERD_ATTACHMENT_MIME } from './constants.js';
import { buildZugferdXmpPacket } from './xmp-template.js';

// Path resolves at module-load via import.meta.url so the helper works from
// both dist/ (compiled) and src/ (vitest) contexts.
const ICC_PATH = fileURLToPath(new URL('./assets/sRGB2014.icc', import.meta.url));

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WrapOpts {
  conformanceLevel: ZugferdConformanceLevel;
  /** Surfaces as dc:title + /Info /Title. Must equal the XMP title. */
  documentTitle: string;
  /** Surfaces as xmp:CreatorTool + pdf:Producer + /Info /Producer + /Creator. */
  creatorTool: string;
  /** Byte-stable timestamp for CreateDate/ModifyDate on both XMP and Info dict. */
  producedAt: Date;
}

/**
 * Wrap a visual PDF + CII XML into a ZUGFeRD / Factur-X PDF/A-3 B document.
 *
 * Deterministic for identical inputs — `producedAt` is the only wall-clock
 * value written, and pdf-lib's save() is deterministic modulo the xref
 * offsets which are a function of the object tree only.
 */
export async function wrapToPdfA3(
  basePdfBytes: Uint8Array,
  ciiXml: string,
  opts: WrapOpts,
): Promise<Uint8Array> {
  const log = createLogger({ module: 'zugferd-de/pdf-wrapper' });

  // 1. Load base PDF, disabling pdf-lib's auto-metadata refresh so our
  //    Info-dict writes later aren't stomped.
  const doc = await PDFDocument.load(basePdfBytes, {
    updateMetadata: false,
    throwOnInvalidObject: false,
  });

  // PDF 1.7 header (ISO 32000-1, via PDF/A-3 references). PDF/A-3 is only
  // defined for PDF 1.7; if pdf-lib wrote 1.4/1.5 we override here.
  doc.catalog.set(PDFName.of('Version'), PDFName.of('1.7'));

  // 2. Attach factur-x.xml. pdf-lib's attach() sets up both /Names
  //    /EmbeddedFiles and a /AF catalog entry with our AFRelationship.
  const xmlBytes = new TextEncoder().encode(ciiXml);
  await doc.attach(xmlBytes, ZUGFERD_ATTACHMENT_FILENAME, {
    mimeType: ZUGFERD_ATTACHMENT_MIME,
    description: 'ZUGFeRD (Factur-X) CII XML invoice payload',
    afRelationship: AFRelationship.Alternative,
    creationDate: opts.producedAt,
    modificationDate: opts.producedAt,
  });

  // 3. Build + embed XMP /Metadata stream. Must be a direct object with
  //    Type=Metadata, Subtype=XML per PDF/A-3 rules.
  const xmp = buildZugferdXmpPacket({
    conformanceLevel: opts.conformanceLevel,
    documentTitle: opts.documentTitle,
    creatorTool: opts.creatorTool,
    producedAt: opts.producedAt,
  });
  const metaStream = doc.context.stream(xmp, {
    Type: PDFName.of('Metadata'),
    Subtype: PDFName.of('XML'),
    Length: PDFNumber.of(xmp.length),
  });
  const metaRef = doc.context.register(metaStream);
  doc.catalog.set(PDFName.of('Metadata'), metaRef);

  // 4. Embed sRGB ICC OutputIntent. PDF/A-3 B requires exactly one
  //    OutputIntents entry with /S=/GTS_PDFA1 and a DestOutputProfile.
  const iccBuf = await fs.readFile(ICC_PATH);
  const iccBytes = new Uint8Array(iccBuf.buffer, iccBuf.byteOffset, iccBuf.byteLength);
  const iccStream = doc.context.stream(iccBytes, {
    N: PDFNumber.of(3),
    Length: PDFNumber.of(iccBytes.length),
  });
  const iccRef = doc.context.register(iccStream);
  const outputIntent = doc.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFA1'),
    OutputConditionIdentifier: PDFString.of('sRGB'),
    RegistryName: PDFString.of('http://www.color.org'),
    Info: PDFString.of('sRGB IEC61966-2.1'),
    DestOutputProfile: iccRef,
  });
  const outputIntentRef = doc.context.register(outputIntent);
  doc.catalog.set(PDFName.of('OutputIntents'), doc.context.obj([outputIntentRef]));

  // 5. Info dict synchronisation — veraPDF rule 6.7.3 insists /Info and
  //    XMP share Title / Producer / Creator / CreateDate / ModDate.
  doc.setTitle(opts.documentTitle);
  doc.setProducer(opts.creatorTool);
  doc.setCreator(opts.creatorTool);
  doc.setCreationDate(opts.producedAt);
  doc.setModificationDate(opts.producedAt);

  // 6. Hex-encode the document ID so save() doesn't emit a random one.
  //    Deterministic fixture digests depend on a stable /ID — we use
  //    producedAt + title to seed a 16-byte synthetic ID.
  const idSeed = `${opts.documentTitle}|${opts.producedAt.toISOString()}`;
  const idHex = hashTo16Bytes(idSeed);
  const idArray = doc.context.obj([PDFHexString.of(idHex), PDFHexString.of(idHex)]);
  doc.context.trailerInfo.ID = idArray;

  // 7. Save. useObjectStreams=false because PDF/A-3 rejects several object
  //    types inside ObjStm (Metadata, Catalog, etc.) — turning it off
  //    globally is the safest default. addDefaultPage=false avoids pdf-lib
  //    appending a blank page on empty-doc edge cases.
  const out = await doc.save({ useObjectStreams: false, addDefaultPage: false });
  log.debug({ bytes: out.length, conformanceLevel: opts.conformanceLevel }, 'wrapped PDF/A-3');
  return out;
}

// ---------------------------------------------------------------------------
// Internal — deterministic 16-byte hex ID derived from a seed string.
// ---------------------------------------------------------------------------

/**
 * Produce a 32-char hex string (16 bytes) from a seed. We don't need
 * cryptographic strength — only determinism + uniform distribution so
 * pdf-lib/saveAs produces byte-stable output for identical inputs.
 * Uses the same FNV-1a + splitmix64 mix used across the einvoice package.
 */
function hashTo16Bytes(seed: string): string {
  // Simple FNV-1a 64-bit hash, repeated twice (suffixing the counter) to
  // get 128 bits. Byte-stable because JS string ops are deterministic.
  const h0 = fnv1a64(`${seed}:0`);
  const h1 = fnv1a64(`${seed}:1`);
  const toHex = (n: bigint): string => n.toString(16).padStart(16, '0');
  return toHex(h0) + toHex(h1);
}

function fnv1a64(s: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    hash ^= BigInt(s.charCodeAt(i));
    hash = (hash * prime) & mask;
  }
  return hash;
}
