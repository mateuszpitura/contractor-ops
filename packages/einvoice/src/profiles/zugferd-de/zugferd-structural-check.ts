// Phase 62 · Plan 62-03 Task 3 — Structural sanity check.
//
// Fails fast BEFORE a caller ships a PDF that veraPDF will reject. The
// checks below are a narrow, deterministic, O(1)-ish subset of PDF/A-3 B
// conformance — they catch the 5 classes of wrapping bugs that
// `wrapToPdfA3` could realistically introduce, without duplicating the
// exhaustive rule set that veraPDF covers in CI.
//
// Invariants asserted:
//   1. Catalog /Metadata exists, is a stream, bytes contain `pdfaid:part>3`.
//   2. Catalog /OutputIntents is a non-empty array whose first entry has
//      /S === /GTS_PDFA1.
//   3. Either the /Names /EmbeddedFiles tree contains a `factur-x.xml`
//      entry, OR the catalog /AF array has an entry with
//      AFRelationship=/Alternative AND /UF (or /F) === `factur-x.xml`.
//   4. The factur-x.xml entry carries AFRelationship === /Alternative.
//   5. XMP bytes contain `<fx:DocumentFileName>factur-x.xml</...>`.
//
// Each failed assertion throws a `ZugferdWrappingError` with a specific
// `subcode` so the router / caller can surface a precise diagnostic.

import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';

import { ZUGFERD_ATTACHMENT_FILENAME } from './constants.js';

// ---------------------------------------------------------------------------
// Error taxonomy
// ---------------------------------------------------------------------------

export type StructuralCheckSubcode =
  | 'MISSING_METADATA'
  | 'MISSING_EMBEDDED_FILE'
  | 'WRONG_EMBEDDED_FILENAME'
  | 'MISSING_AF_RELATIONSHIP'
  | 'MISSING_OUTPUT_INTENT'
  | 'XMP_PDFA_PART_MISMATCH'
  | 'XMP_FX_FILENAME_MISMATCH';

/**
 * Thrown by `assertZugferdStructure` on any invariant failure. The stable
 * `.code` (`'ZUGFERD_WRAPPING_FAILED'`) lets callers switch on the discriminant
 * without importing this class directly; the `subcode` field pinpoints which
 * invariant failed.
 */
export class ZugferdWrappingError extends Error {
  readonly code = 'ZUGFERD_WRAPPING_FAILED' as const;
  constructor(
    public readonly subcode: StructuralCheckSubcode,
    message: string,
  ) {
    super(`${message} [${subcode}]`);
    this.name = 'ZugferdWrappingError';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Assert that `pdfBytes` satisfies the 5 ZUGFeRD / Factur-X wrapping
 * invariants. Throws `ZugferdWrappingError` on the first failure; returns
 * `void` on success. Callers should prefer this over ad-hoc grep checks.
 */
export async function assertZugferdStructure(pdfBytes: Uint8Array): Promise<void> {
  const doc = await PDFDocument.load(pdfBytes, {
    updateMetadata: false,
    throwOnInvalidObject: false,
  });

  // ----- 1. /Metadata ---------------------------------------------------
  const metaRef = doc.catalog.get(PDFName.of('Metadata'));
  if (!metaRef) {
    throw new ZugferdWrappingError(
      'MISSING_METADATA',
      'Catalog /Metadata entry is missing',
    );
  }
  const metaStream = doc.context.lookup(metaRef);
  if (!(metaStream instanceof PDFRawStream)) {
    throw new ZugferdWrappingError(
      'MISSING_METADATA',
      'Catalog /Metadata is not a stream',
    );
  }
  const xmpBytes = decodePDFRawStream(metaStream).decode();
  const xmp = new TextDecoder().decode(xmpBytes);
  if (!xmp.includes('pdfaid:part>3')) {
    throw new ZugferdWrappingError(
      'XMP_PDFA_PART_MISMATCH',
      'XMP metadata does not declare <pdfaid:part>3</pdfaid:part>',
    );
  }

  // ----- 5. XMP fx:DocumentFileName ------------------------------------
  // Done alongside (1) since we already have the XMP bytes in hand.
  if (
    !xmp.includes(`<fx:DocumentFileName>${ZUGFERD_ATTACHMENT_FILENAME}</fx:DocumentFileName>`)
  ) {
    throw new ZugferdWrappingError(
      'XMP_FX_FILENAME_MISMATCH',
      `XMP metadata does not declare <fx:DocumentFileName>${ZUGFERD_ATTACHMENT_FILENAME}</...>`,
    );
  }

  // ----- 2. /OutputIntents ---------------------------------------------
  const outputIntentsRef = doc.catalog.get(PDFName.of('OutputIntents'));
  if (!outputIntentsRef) {
    throw new ZugferdWrappingError(
      'MISSING_OUTPUT_INTENT',
      'Catalog /OutputIntents is missing',
    );
  }
  const outputIntents = doc.context.lookup(outputIntentsRef) as unknown as {
    asArray?: () => unknown[];
  };
  const oiItems = outputIntents.asArray ? outputIntents.asArray() : [];
  if (oiItems.length === 0) {
    throw new ZugferdWrappingError(
      'MISSING_OUTPUT_INTENT',
      'Catalog /OutputIntents array is empty',
    );
  }
  const firstOi = doc.context.lookup(oiItems[0] as never, PDFDict);
  const s = firstOi.get(PDFName.of('S'));
  if (!s || s.toString() !== '/GTS_PDFA1') {
    throw new ZugferdWrappingError(
      'MISSING_OUTPUT_INTENT',
      `First /OutputIntents entry /S is not /GTS_PDFA1 (got ${s?.toString() ?? 'undefined'})`,
    );
  }

  // ----- 3. Embedded factur-x.xml --------------------------------------
  const embeddedMatch = findEmbeddedFacturX(doc);
  if (!embeddedMatch.found) {
    throw new ZugferdWrappingError(
      embeddedMatch.reason,
      embeddedMatch.message,
    );
  }

  // ----- 4. AFRelationship === /Alternative ---------------------------
  if (embeddedMatch.afRelationship !== '/Alternative') {
    throw new ZugferdWrappingError(
      'MISSING_AF_RELATIONSHIP',
      `factur-x.xml AFRelationship must be /Alternative (got ${
        embeddedMatch.afRelationship ?? 'undefined'
      })`,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal: locate factur-x.xml + its AFRelationship
// ---------------------------------------------------------------------------

interface FoundMatch {
  found: true;
  afRelationship: string | null;
}

interface MissingMatch {
  found: false;
  reason: Extract<
    StructuralCheckSubcode,
    'MISSING_EMBEDDED_FILE' | 'WRONG_EMBEDDED_FILENAME'
  >;
  message: string;
}

type EmbeddedMatch = FoundMatch | MissingMatch;

function findEmbeddedFacturX(doc: PDFDocument): EmbeddedMatch {
  // First try catalog /AF (populated by pdf-lib attach()).
  const afRef = doc.catalog.get(PDFName.of('AF'));
  const seenFilenames: string[] = [];
  if (afRef) {
    const afArr = doc.context.lookup(afRef) as unknown as {
      asArray?: () => unknown[];
    };
    const items = afArr.asArray ? afArr.asArray() : [];
    for (const fsRef of items) {
      const fs = doc.context.lookup(fsRef as never, PDFDict);
      const filename = readFileName(fs);
      if (filename) seenFilenames.push(filename);
      if (filename === ZUGFERD_ATTACHMENT_FILENAME) {
        const af = fs.get(PDFName.of('AFRelationship'));
        return {
          found: true,
          afRelationship: af ? af.toString() : null,
        };
      }
    }
  }

  // Fall back to /Names /EmbeddedFiles tree (covers PDFs where /AF is
  // absent but attachments are registered in the names tree).
  const namesRef = doc.catalog.get(PDFName.of('Names'));
  if (namesRef) {
    const names = doc.context.lookup(namesRef, PDFDict);
    const embeddedRef = names.get(PDFName.of('EmbeddedFiles'));
    if (embeddedRef) {
      const tree = doc.context.lookup(embeddedRef, PDFDict);
      const result = scanNameTree(doc, tree, seenFilenames);
      if (result) return result;
    }
  }

  if (seenFilenames.length > 0) {
    return {
      found: false,
      reason: 'WRONG_EMBEDDED_FILENAME',
      message: `Embedded attachments found (${seenFilenames.join(
        ', ',
      )}) but none named ${ZUGFERD_ATTACHMENT_FILENAME}`,
    };
  }
  return {
    found: false,
    reason: 'MISSING_EMBEDDED_FILE',
    message: 'No embedded files found in /AF or /Names /EmbeddedFiles',
  };
}

function scanNameTree(
  doc: PDFDocument,
  node: PDFDict,
  seen: string[],
): FoundMatch | null {
  const namesRef = node.get(PDFName.of('Names'));
  if (namesRef) {
    const namesArr = doc.context.lookup(namesRef) as unknown as {
      asArray?: () => unknown[];
    };
    const items = namesArr.asArray ? namesArr.asArray() : [];
    for (let i = 0; i < items.length; i += 2) {
      const keyVal = items[i] as PDFString | PDFHexString;
      let name: string | null = null;
      if (typeof (keyVal as PDFHexString).decodeText === 'function') {
        name = (keyVal as PDFHexString).decodeText();
      } else if (typeof (keyVal as PDFString).asString === 'function') {
        name = (keyVal as PDFString).asString();
      }
      if (name) seen.push(name);
      if (name === ZUGFERD_ATTACHMENT_FILENAME) {
        const fs = doc.context.lookup(items[i + 1] as never, PDFDict);
        const af = fs.get(PDFName.of('AFRelationship'));
        return {
          found: true,
          afRelationship: af ? af.toString() : null,
        };
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
      const res = scanNameTree(doc, kid, seen);
      if (res) return res;
    }
  }
  return null;
}

function readFileName(fs: PDFDict): string | null {
  // /UF preferred (UTF-16 hex), /F fallback (Latin-1).
  const uf = fs.get(PDFName.of('UF'));
  if (uf) {
    if (typeof (uf as PDFHexString).decodeText === 'function') {
      return (uf as PDFHexString).decodeText();
    }
    if (typeof (uf as PDFString).asString === 'function') {
      return (uf as PDFString).asString();
    }
  }
  const f = fs.get(PDFName.of('F'));
  if (f) {
    if (typeof (f as PDFHexString).decodeText === 'function') {
      return (f as PDFHexString).decodeText();
    }
    if (typeof (f as PDFString).asString === 'function') {
      return (f as PDFString).asString();
    }
  }
  return null;
}
