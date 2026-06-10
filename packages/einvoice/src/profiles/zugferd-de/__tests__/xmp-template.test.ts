// XMP packet builder tests.
//
// Covers eight assertions:
//   1. pdfaid:part exactly 3
//   2. pdfaid:conformance exactly B
//   3. fx:DocumentFileName exactly factur-x.xml
//   4. fx:ConformanceLevel exactly EN 16931
//   5. pdfaid + fx namespace declarations exactly as specified
//   6. XML-escape of special chars in documentTitle
//   7. Packet bookends (<?xpacket begin / end="w"?>)
//   8. Valid UTF-8 (TextDecoder round-trip)

import { describe, expect, it } from 'vitest';

import { buildZugferdXmpPacket } from '../xmp-template.js';

const BASE_INPUT = {
  conformanceLevel: 'COMFORT' as const,
  documentTitle: 'Invoice INV-2026-001',
  creatorTool: '@contractor-ops/einvoice 5.0',
  producedAt: new Date('2026-04-15T10:00:00Z'),
};

function decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

describe('buildZugferdXmpPacket', () => {
  it('emits <pdfaid:part>3</pdfaid:part> exactly', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(xml).not.toContain('<pdfaid:part>1<');
    expect(xml).not.toContain('<pdfaid:part>2<');
  });

  it('emits <pdfaid:conformance>B</pdfaid:conformance> exactly', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<pdfaid:conformance>B</pdfaid:conformance>');
  });

  it('emits <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName> exactly', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>');
  });

  it('emits <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel> exactly', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>');
  });

  it('declares pdfaid + fx namespaces with exact URIs', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"');
    expect(xml).toContain('xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"');
  });

  it('XML-escapes special chars in documentTitle (&, <, >, ", \')', () => {
    const xml = decode(
      buildZugferdXmpPacket({
        ...BASE_INPUT,
        documentTitle: 'Invoice <>&"\'',
      }),
    );
    expect(xml).toContain('Invoice &lt;&gt;&amp;&quot;&apos;');
    expect(xml).not.toContain('Invoice <>&"');
  });

  it('XML-escapes special chars in creatorTool', () => {
    const xml = decode(
      buildZugferdXmpPacket({
        ...BASE_INPUT,
        creatorTool: 'Acme & Co "v1" <beta>',
      }),
    );
    expect(xml).toContain('Acme &amp; Co &quot;v1&quot; &lt;beta&gt;');
  });

  it('packet begins with <?xpacket begin=" and ends with <?xpacket end="w"?>', () => {
    const bytes = buildZugferdXmpPacket(BASE_INPUT);
    const xml = decode(bytes);
    expect(xml.startsWith('<?xpacket begin="')).toBe(true);
    expect(xml.trimEnd().endsWith('<?xpacket end="w"?>')).toBe(true);
  });

  it('output is valid UTF-8 (TextDecoder round-trip in fatal mode)', () => {
    const bytes = buildZugferdXmpPacket(BASE_INPUT);
    // TextDecoder fatal:true throws on invalid UTF-8 — success means valid.
    expect(() => decode(bytes)).not.toThrow();
    // Round-trip: decode then re-encode equals original bytes.
    const roundTrip = new TextEncoder().encode(decode(bytes));
    expect(roundTrip).toEqual(bytes);
  });

  it('emits xmp:CreateDate + xmp:ModifyDate from producedAt', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<xmp:CreateDate>2026-04-15T10:00:00.000Z</xmp:CreateDate>');
    expect(xml).toContain('<xmp:ModifyDate>2026-04-15T10:00:00.000Z</xmp:ModifyDate>');
  });

  it('emits pdfaExtension:schemas block describing fx namespace', () => {
    const xml = decode(buildZugferdXmpPacket(BASE_INPUT));
    expect(xml).toContain('<pdfaExtension:schemas>');
    expect(xml).toContain(
      '<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>',
    );
    expect(xml).toContain('<pdfaSchema:prefix>fx</pdfaSchema:prefix>');
  });

  it('output is deterministic for same input', () => {
    const a = buildZugferdXmpPacket(BASE_INPUT);
    const b = buildZugferdXmpPacket(BASE_INPUT);
    expect(a).toEqual(b);
  });
});
