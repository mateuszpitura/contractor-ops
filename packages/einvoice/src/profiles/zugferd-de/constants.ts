// Phase 62 · Plan 62-02 Task 3 — ZUGFeRD profile constants.
//
// ZUGFeRD (also known as Factur-X on the French side of the spec since 1.0)
// is a hybrid PDF/A-3 + CII XML invoice format. Five conformance levels exist
// upstream (MINIMUM, BASIC WL, BASIC, EN 16931/COMFORT, EXTENDED) plus the
// XRECHNUNG profile which is EN 16931 + the XRechnung CIUS extensions.
//
// This module holds:
//   * The stable profile identifier (registered in the einvoice registry).
//   * XMP metadata namespace + prefix constants — the ZUGFeRD readers key off
//     the `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#` URI to find
//     the embedded CII filename + document type + version, so the constant is
//     load-bearing.
//   * The attachment filename `factur-x.xml` is spec-mandated (§5.3.2 of the
//     ZUGFeRD 2.2 / Factur-X 1.0.07 spec) — inbound readers search for it by
//     exact name (case-insensitive) before falling back to AFRelationship scan.
//   * A guideline-URN ↔ conformance-level map for the parser. MINIMUM / BASIC /
//     BASIC-WL are intentionally absent — they do not carry the EN 16931
//     semantic model (MINIMUM is header-only + totals, BASIC-WL omits line
//     items) so they cannot round-trip through our canonical EInvoice
//     envelope. The parser emits ZUGFERD_LEVEL_UNSUPPORTED for those.
//
// PDF/A-3 identification is written into XMP via the `pdfaid` namespace;
// pinning `part=3` + `conformance=B` here guarantees every generated PDF
// declares itself as PDF/A-3b regardless of any caller mistake in
// Plan 03's wrapper.

import { XRECHNUNG_VERSION } from '../xrechnung-de/constants.js';

// ---------------------------------------------------------------------------
// Profile identity
// ---------------------------------------------------------------------------

/** Stable profile identifier registered in the einvoice registry. */
export const ZUGFERD_DE_PROFILE_ID = 'zugferd-de' as const;

// ---------------------------------------------------------------------------
// PDF attachment invariants (ZUGFeRD 2.2 / Factur-X 1.0.07 §5.3.2)
// ---------------------------------------------------------------------------

/** Spec-mandated filename for the embedded CII XML payload. */
export const ZUGFERD_ATTACHMENT_FILENAME = 'factur-x.xml' as const;

/** MIME type reported on the PDF `/EmbeddedFiles` entry. */
export const ZUGFERD_ATTACHMENT_MIME = 'application/xml' as const;

/** AFRelationship value on the catalog `/AF` entry (ZUGFeRD requires Alternative). */
export const ZUGFERD_AF_RELATIONSHIP = 'Alternative' as const;

// ---------------------------------------------------------------------------
// XMP metadata — ZUGFeRD extension schema
// ---------------------------------------------------------------------------

/**
 * XMP namespace URI identifying the Factur-X / ZUGFeRD metadata block. Every
 * ZUGFeRD-compliant reader (Mustangproject, PDF/A validators, SAP's ZUGFeRD
 * extractor) indexes PDFs by this URI — mistyping it silently degrades the
 * PDF to "looks like a ZUGFeRD but isn't".
 */
export const ZUGFERD_XMP_NAMESPACE =
  'urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#' as const;

/** XMP element prefix used inside the metadata packet. */
export const ZUGFERD_XMP_PREFIX = 'fx' as const;

/** XMP `<fx:DocumentType>` — always `INVOICE` for this profile. */
export const ZUGFERD_XMP_DOCUMENT_TYPE = 'INVOICE' as const;

/** XMP `<fx:DocumentFileName>` — mirrors the attachment filename. */
export const ZUGFERD_XMP_DOCUMENT_FILE_NAME = ZUGFERD_ATTACHMENT_FILENAME;

/** XMP `<fx:Version>` — matches the Factur-X spec version we implement. */
export const ZUGFERD_XMP_VERSION = '1.0' as const;

// ---------------------------------------------------------------------------
// PDF/A-3b identification (ISO 19005-3)
// ---------------------------------------------------------------------------

/** XMP namespace URI for the PDF/A identification schema. */
export const PDFA_ID_NAMESPACE = 'http://www.aiim.org/pdfa/ns/id/' as const;

/** PDF/A part number — 3 for ZUGFeRD (allows arbitrary file attachments). */
export const PDFA_ID_PART = '3' as const;

/** PDF/A conformance level — B (visual reproduction, no text extraction guarantees). */
export const PDFA_ID_CONFORMANCE = 'B' as const;

// ---------------------------------------------------------------------------
// Supported conformance levels
// ---------------------------------------------------------------------------

/**
 * Subset of ZUGFeRD / Factur-X conformance levels this profile can produce or
 * consume. MINIMUM / BASIC / BASIC WL are excluded because they omit the
 * EN 16931 semantic line-item + tax-breakdown model required by our canonical
 * `EInvoice` envelope.
 */
export type ZugferdConformanceLevel = 'COMFORT' | 'XRECHNUNG' | 'EXTENDED';

/**
 * Maps CII `GuidelineSpecifiedDocumentContextParameter/ram:ID` URN
 * to a supported ZUGFeRD conformance level.
 *
 * Levels intentionally unsupported (MINIMUM, BASIC_WL, BASIC) are
 * surfaced separately in `UNSUPPORTED_GUIDELINE_URNS` so the parser
 * can emit ZUGFERD_LEVEL_UNSUPPORTED with the exact URN it saw.
 */
export const GUIDELINE_URN_TO_LEVEL: Readonly<Record<string, ZugferdConformanceLevel>> =
  Object.freeze({
    'urn:cen.eu:en16931:2017': 'COMFORT',
    'urn:factur-x.eu:1p0:comfort': 'COMFORT',
    // XRechnung 3.0 — legacy xoev-de URN kept for backwards compatibility
    // with documents generated against earlier releases of the CIUS.
    'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0': 'XRECHNUNG',
    // XRechnung 3.0 — canonical xeinkauf.de URN used by the current
    // KoSIT validator-configuration-xrechnung release-2026-01-31.
    'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0': 'XRECHNUNG',
    'urn:factur-x.eu:1p0:en16931': 'COMFORT',
    'urn:factur-x.eu:1p0:extended': 'EXTENDED',
  });

/**
 * Guideline URNs the parser must hard-reject — the document is syntactically
 * ZUGFeRD but the level does not carry the EN 16931 semantic model we map
 * into `EInvoice`. The parser throws `ZUGFERD_LEVEL_UNSUPPORTED` with the
 * exact URN so the intake pipeline can tell the user which level was seen.
 */
export const UNSUPPORTED_GUIDELINE_URNS: ReadonlySet<string> = Object.freeze(
  new Set([
    'urn:factur-x.eu:1p0:minimum',
    'urn:factur-x.eu:1p0:basic',
    'urn:factur-x.eu:1p0:basicwl',
    'urn:zugferd.de:2p1:minimum',
    'urn:zugferd.de:2p1:basic',
    'urn:zugferd.de:2p1:basicwl',
  ]),
);

// ---------------------------------------------------------------------------
// Re-exports from Phase 61 XRechnung profile
// ---------------------------------------------------------------------------

// Re-export Phase 61 constants the generator will reuse (Plan 03).
export { XRECHNUNG_VERSION };
