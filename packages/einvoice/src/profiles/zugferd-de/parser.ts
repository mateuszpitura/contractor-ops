// Phase 62 · Plan 62-02 Task 5 — ZUGFeRD PDF inbound parser.
//
// Reads a ZUGFeRD / Factur-X PDF, finds the embedded `factur-x.xml`
// attachment in the catalog `/Names /EmbeddedFiles` tree (or, as a fallback,
// any `.xml` attachment carrying AFRelationship=/Alternative), decodes it,
// and delegates the extracted XML to the XRechnung CII parser which returns
// the canonical EInvoice envelope + profile-level detection.
//
// The parser DOES NOT validate the XML against Schematron — that is the
// validator's responsibility (via `validator.ts` which re-exports the
// Phase-61 KoSIT three-layer pipeline). We only do:
//   1. PDF load with safe options (ignoreEncryption, throwOnInvalidObject=false).
//   2. EmbeddedFiles tree traversal.
//   3. UF-stream byte extraction + UTF-8 decode.
//   4. Delegate to parseXrechnungCii — let it throw ZUGFERD_LEVEL_UNSUPPORTED
//      when the embedded XML carries a MINIMUM / BASIC / BASIC-WL guideline.
//
// Errors are thrown as typed POJOs so the tRPC router can map them to error
// codes without catching+rethrowing at every layer:
//   - ZUGFERD_PDF_UNREADABLE    — pdf-lib rejected the bytes
//   - ZUGFERD_NO_XML_ATTACHMENT — no factur-x.xml + no fallback .xml with
//                                 AFRelationship=Alternative in the tree
//   - CII_PARSE_FAILED          — bubbled from inner parser (malformed XML)
//   - ZUGFERD_LEVEL_UNSUPPORTED — bubbled from inner parser
//
// Logging uses the shared Pino root logger via `.child({ module })`.

import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFStream,
  PDFString,
  decodePDFRawStream,
} from 'pdf-lib';

import { logger } from '@contractor-ops/logger';

import {
  type ParsedXrechnung,
  parseXrechnungCii,
} from '../xrechnung-de/parser.js';
import {
  ZUGFERD_AF_RELATIONSHIP,
  ZUGFERD_ATTACHMENT_FILENAME,
} from './constants.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Return shape of `parseZugferdPdf`. */
export interface ParsedZugferd extends ParsedXrechnung {
  /** Exact bytes passed in — for later content-addressed R2 persistence. */
  rawPdfBuffer: Uint8Array;
  /** UTF-8 string decoded from the embedded factur-x.xml. */
  extractedXml: string;
}

/**
 * Discriminated union of typed PDF-stage errors. XML-stage errors
 * (CII_PARSE_FAILED, ZUGFERD_LEVEL_UNSUPPORTED) propagate unchanged from
 * the inner XRechnung parser.
 */
export type ZugferdParserError =
  | { code: 'ZUGFERD_PDF_UNREADABLE'; message: string }
  | { code: 'ZUGFERD_NO_XML_ATTACHMENT'; message: string };

const log = logger.child({ module: 'zugferd-de/parser' });

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a ZUGFeRD / Factur-X PDF: extract the embedded `factur-x.xml`,
 * delegate to the XRechnung CII parser, and return the parsed envelope plus
 * the raw bytes + extracted XML for persistence.
 */
export async function parseZugferdPdf(
  bytes: Uint8Array,
): Promise<ParsedZugferd> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : String(err) }, 'Failed to load PDF');
    throw {
      code: 'ZUGFERD_PDF_UNREADABLE',
      message: err instanceof Error ? err.message : String(err),
    } satisfies ZugferdParserError;
  }

  const xmlBytes = findEmbeddedFacturXXml(doc);
  if (!xmlBytes) {
    throw {
      code: 'ZUGFERD_NO_XML_ATTACHMENT',
      message: `PDF contains no ${ZUGFERD_ATTACHMENT_FILENAME} attachment with AFRelationship=${ZUGFERD_AF_RELATIONSHIP}`,
    } satisfies ZugferdParserError;
  }

  const extractedXml = new TextDecoder('utf-8').decode(xmlBytes);
  const parsed = parseXrechnungCii(extractedXml);

  return {
    ...parsed,
    rawPdfBuffer: bytes,
    extractedXml,
  };
}

// ---------------------------------------------------------------------------
// Internal — embedded-file traversal
// ---------------------------------------------------------------------------

/**
 * Locate and decode the `factur-x.xml` attachment stream in a loaded PDF.
 *
 * Search order:
 *   1. catalog `/Names /EmbeddedFiles /Names` array — scan pairs of
 *      `(nameKey, fileSpecRef)` and match on exact filename
 *      `factur-x.xml` (case-insensitive).
 *   2. Fallback: catalog `/AF` associated-files array — scan each entry
 *      for AFRelationship=/Alternative AND filename ending in `.xml`
 *      (case-insensitive).
 *
 * Returns the decoded stream bytes, or `null` if no match.
 */
function findEmbeddedFacturXXml(doc: PDFDocument): Uint8Array | null {
  const catalog = doc.catalog;

  // --- Priority 1: /Names /EmbeddedFiles tree -----------------------------
  const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  if (names) {
    const embeddedFiles = names.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
    if (embeddedFiles) {
      const bytes = extractFromEmbeddedFilesTree(embeddedFiles);
      if (bytes) return bytes;
    }
  }

  // --- Priority 2: /AF associated-files array -----------------------------
  const af = catalog.lookupMaybe(PDFName.of('AF'), PDFArray);
  if (af) {
    const bytes = extractFromAFArray(af);
    if (bytes) return bytes;
  }

  return null;
}

/**
 * Traverse a `/Names /EmbeddedFiles` dict which either has a flat `Names`
 * array (leaf) or nested `Kids` arrays (intermediate). The tree may be of
 * arbitrary depth — pdf-lib does not flatten it for us.
 */
function extractFromEmbeddedFilesTree(node: PDFDict): Uint8Array | null {
  // Leaf: Names = [name1, fileSpec1, name2, fileSpec2, ...]
  const namesArr = node.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (namesArr) {
    // 1st sweep: match by key name OR by fileSpec /F or /UF on factur-x.xml.
    //            If no exact match found, fall through to the AFRelationship
    //            fallback scan so an arbitrarily-named .xml with
    //            AFRelationship=Alternative still resolves (Factur-X spec
    //            §5.3.2 prefers the exact filename but accepts any AF).
    for (let i = 0; i < namesArr.size(); i += 2) {
      const nameObj = namesArr.lookup(i);
      const spec = namesArr.lookupMaybe(i + 1, PDFDict);
      if (!spec) continue;
      const fileName = readPdfString(nameObj);
      if (fileName != null && isFacturXFilename(fileName)) {
        const bytes = extractStreamFromFileSpec(spec);
        if (bytes) return bytes;
      }
      const specName = readFileSpecFilename(spec);
      if (specName != null && isFacturXFilename(specName)) {
        const bytes = extractStreamFromFileSpec(spec);
        if (bytes) return bytes;
      }
    }
    // 2nd sweep: accept any .xml attachment with AFRelationship=/Alternative.
    for (let i = 0; i < namesArr.size(); i += 2) {
      const spec = namesArr.lookupMaybe(i + 1, PDFDict);
      if (!spec) continue;
      const rel = spec.lookupMaybe(PDFName.of('AFRelationship'), PDFName);
      const relName = rel?.decodeText();
      if (relName !== ZUGFERD_AF_RELATIONSHIP) continue;
      const specName = readFileSpecFilename(spec);
      if (specName == null) continue;
      if (!specName.toLowerCase().endsWith('.xml')) continue;
      const bytes = extractStreamFromFileSpec(spec);
      if (bytes) return bytes;
    }
  }

  // Intermediate: Kids = [dict1, dict2, ...]
  const kidsArr = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
  if (kidsArr) {
    for (let i = 0; i < kidsArr.size(); i++) {
      const kid = kidsArr.lookupMaybe(i, PDFDict);
      if (kid) {
        const bytes = extractFromEmbeddedFilesTree(kid);
        if (bytes) return bytes;
      }
    }
  }

  return null;
}

/**
 * Scan the catalog `/AF` array for any file-spec with AFRelationship=Alternative
 * AND a filename ending in `.xml` (case-insensitive).
 */
function extractFromAFArray(af: PDFArray): Uint8Array | null {
  for (let i = 0; i < af.size(); i++) {
    const spec = af.lookupMaybe(i, PDFDict);
    if (!spec) continue;
    const rel = spec.lookupMaybe(PDFName.of('AFRelationship'), PDFName);
    const relName = rel?.decodeText();
    if (relName !== ZUGFERD_AF_RELATIONSHIP) continue;
    const fileName = readFileSpecFilename(spec);
    if (fileName == null) continue;
    if (!fileName.toLowerCase().endsWith('.xml')) continue;
    const bytes = extractStreamFromFileSpec(spec);
    if (bytes) return bytes;
  }
  return null;
}

/**
 * Given a Filespec dict, open `/EF /F` (or `/UF`) and return the decoded
 * stream bytes. Applies any /Filter decoding via pdf-lib's helper so Flate-
 * compressed payloads are returned in plain form.
 */
function extractStreamFromFileSpec(spec: PDFDict): Uint8Array | null {
  const ef = spec.lookupMaybe(PDFName.of('EF'), PDFDict);
  if (!ef) return null;
  // Try /F first (standard), /UF second (unicode variant, rarely used for the
  // stream itself but some writers emit it). Both lookupMaybe calls may
  // return undefined — we tolerate either missing branch.
  // pdf-lib's PDFDict.lookupMaybe overload set exposes PDFStream (the super
  // type), not PDFRawStream directly, so we accept PDFStream and narrow at
  // runtime — every file-attachment stream we've seen in the wild is a raw
  // (Flate-encoded) stream, but this guard means we fail gracefully rather
  // than crash on exotic writers.
  const rawStream =
    ef.lookupMaybe(PDFName.of('F'), PDFStream) ??
    ef.lookupMaybe(PDFName.of('UF'), PDFStream);
  if (!rawStream) return null;
  if (!(rawStream instanceof PDFRawStream)) {
    log.warn(
      { streamType: rawStream.constructor.name },
      'Embedded file stream is not a PDFRawStream — skipping',
    );
    return null;
  }

  try {
    return decodePDFRawStream(rawStream).decode();
  } catch (err) {
    log.warn(
      { err: err instanceof Error ? err.message : String(err) },
      'Failed to decode embedded file stream',
    );
    return null;
  }
}

/** Read a `/F` or `/UF` filename from a Filespec, preferring UF when both exist. */
function readFileSpecFilename(spec: PDFDict): string | null {
  const uf = spec.lookup(PDFName.of('UF'));
  const ufName = readPdfString(uf);
  if (ufName != null) return ufName;
  const f = spec.lookup(PDFName.of('F'));
  return readPdfString(f);
}

/** Pull a plain string out of a PDFString or PDFHexString (or object ref). */
function readPdfString(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof PDFString) return value.asString();
  if (value instanceof PDFHexString) return value.decodeText();
  return null;
}

/** Case-insensitive compare against the spec-mandated filename. */
function isFacturXFilename(name: string): boolean {
  return name.toLowerCase() === ZUGFERD_ATTACHMENT_FILENAME.toLowerCase();
}
