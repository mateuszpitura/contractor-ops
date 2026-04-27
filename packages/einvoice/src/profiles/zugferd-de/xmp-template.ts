// Phase 62 · Plan 62-03 Task 1 — XMP packet builder for ZUGFeRD + PDF/A-3.
//
// Emits the XMP metadata packet that ZUGFeRD readers + veraPDF use to
// identify the PDF as a Factur-X / ZUGFeRD COMFORT (EN 16931) hybrid wrapped
// in PDF/A-3 B. Values are spec-mandated (ZUGFeRD 2.2 / Factur-X 1.0.07
// §5.1 + PDF/A-3 / ISO 19005-3) — only `conformanceLevel`, `documentTitle`,
// `creatorTool`, and `producedAt` are caller-parameterised. The remaining
// namespaces / constants come from ./constants.ts where they are single-source
// for both parser (Plan 02) and generator (this plan).
//
// The packet is a pure template (no XMP library); a template literal keeps
// the dependency surface minimal — pdf-lib does not ship an XMP writer and
// pulling one in (e.g., @smeijer/pdfkit-xmp-utils) adds a transitive chain
// with its own licence review. The trade-off: we hand-escape user-provided
// strings against XML's five predefined entities. The escape list is
// intentionally minimal (`&`, `<`, `>`, `"`, `'`) — attribute content uses
// double quotes so single quotes don't strictly need escaping, but we escape
// both to match the XML 1.0 §2.4 predefined-entities definition.

import { escapeXmlEntities } from '../../engine/xml-utils.js';
import type { ZugferdConformanceLevel } from './constants.js';
import {
  PDFA_ID_CONFORMANCE,
  PDFA_ID_NAMESPACE,
  PDFA_ID_PART,
  ZUGFERD_XMP_DOCUMENT_FILE_NAME,
  ZUGFERD_XMP_DOCUMENT_TYPE,
  ZUGFERD_XMP_NAMESPACE,
  ZUGFERD_XMP_PREFIX,
  ZUGFERD_XMP_VERSION,
} from './constants.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface BuildXmpInput {
  /** ZUGFeRD conformance level (we only ship COMFORT outbound for Phase 62). */
  conformanceLevel: ZugferdConformanceLevel;
  /** Document title — surfaces in readers as dc:title / pdf:Title. */
  documentTitle: string;
  /** Creator tool string — surfaces as xmp:CreatorTool / pdf:Producer. */
  creatorTool: string;
  /** Timestamp embedded as xmp:CreateDate / xmp:ModifyDate (ISO 8601). */
  producedAt: Date;
}

/**
 * Return a UTF-8 Uint8Array containing the XMP packet for a ZUGFeRD PDF/A-3
 * invoice. Deterministic: the same input always produces byte-equal output,
 * which matters for the veraPDF fixture-digest check in CI.
 */
export function buildZugferdXmpPacket(input: BuildXmpInput): Uint8Array {
  const title = escapeXml(input.documentTitle);
  const creator = escapeXml(input.creatorTool);
  // XMP date format is ISO 8601. `Date.toISOString()` emits
  // `YYYY-MM-DDTHH:mm:ss.sssZ` which the XMP spec accepts verbatim.
  const timestamp = input.producedAt.toISOString();
  const conformanceLabel = `EN 16931`; // Outbound COMFORT → EN 16931 label.
  // Factur-X / ZUGFeRD XMP schema uses distinct conformance-level strings per
  // variant. "EN 16931" is COMFORT; XRECHNUNG / EXTENDED would emit different
  // strings but Phase 62 D-03 only ships COMFORT outbound.
  void input.conformanceLevel;

  // Factur-X 1.0.07 §5 mandates the `pdfaExtension` declaration describing
  // the `fx:` schema so PDF/A-3 validators accept the extension namespace.
  const packet = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="@contractor-ops/einvoice">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="${PDFA_ID_NAMESPACE}"
        xmlns:${ZUGFERD_XMP_PREFIX}="${ZUGFERD_XMP_NAMESPACE}"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaid:part>${PDFA_ID_PART}</pdfaid:part>
      <pdfaid:conformance>${PDFA_ID_CONFORMANCE}</pdfaid:conformance>
      <${ZUGFERD_XMP_PREFIX}:DocumentType>${ZUGFERD_XMP_DOCUMENT_TYPE}</${ZUGFERD_XMP_PREFIX}:DocumentType>
      <${ZUGFERD_XMP_PREFIX}:DocumentFileName>${ZUGFERD_XMP_DOCUMENT_FILE_NAME}</${ZUGFERD_XMP_PREFIX}:DocumentFileName>
      <${ZUGFERD_XMP_PREFIX}:Version>${ZUGFERD_XMP_VERSION}</${ZUGFERD_XMP_PREFIX}:Version>
      <${ZUGFERD_XMP_PREFIX}:ConformanceLevel>${conformanceLabel}</${ZUGFERD_XMP_PREFIX}:ConformanceLevel>
      <xmp:CreatorTool>${creator}</xmp:CreatorTool>
      <xmp:CreateDate>${timestamp}</xmp:CreateDate>
      <xmp:ModifyDate>${timestamp}</xmp:ModifyDate>
      <pdf:Producer>${creator}</pdf:Producer>
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${title}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>${ZUGFERD_XMP_NAMESPACE}</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>${ZUGFERD_XMP_PREFIX}</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML invoice file.</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE or ORDER document type.</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X version.</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Factur-X conformance level.</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  return new TextEncoder().encode(packet);
}

// ---------------------------------------------------------------------------
// XML escape — single source of truth in engine/xml-utils.ts to keep the
// XMP template + ZATCA signer in lockstep (XML 1.0 §2.4 predefined entities).
// ---------------------------------------------------------------------------

const escapeXml = escapeXmlEntities;
