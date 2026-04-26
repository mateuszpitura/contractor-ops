// Phase 62 · Plan 62-02 Task 3 — ZUGFeRD profile constants unit tests.
//
// These assertions are intentionally strict: the XMP namespace URI +
// attachment filename are load-bearing for inbound readers (they index PDFs
// by these exact strings), so any drift — even a whitespace change — must
// fail the test.

import { describe, expect, it } from 'vitest';
import type { ZugferdConformanceLevel } from '../constants.js';
import {
  GUIDELINE_URN_TO_LEVEL,
  PDFA_ID_CONFORMANCE,
  PDFA_ID_NAMESPACE,
  PDFA_ID_PART,
  UNSUPPORTED_GUIDELINE_URNS,
  XRECHNUNG_VERSION,
  ZUGFERD_AF_RELATIONSHIP,
  ZUGFERD_ATTACHMENT_FILENAME,
  ZUGFERD_ATTACHMENT_MIME,
  ZUGFERD_DE_PROFILE_ID,
  ZUGFERD_XMP_DOCUMENT_FILE_NAME,
  ZUGFERD_XMP_DOCUMENT_TYPE,
  ZUGFERD_XMP_NAMESPACE,
  ZUGFERD_XMP_PREFIX,
  ZUGFERD_XMP_VERSION,
} from '../constants.js';

describe('ZUGFeRD profile identity constants', () => {
  it('profile id is the stable "zugferd-de" slug', () => {
    expect(ZUGFERD_DE_PROFILE_ID).toBe('zugferd-de');
  });

  it('Phase 61 XRechnung version is re-exported', () => {
    expect(XRECHNUNG_VERSION).toBe('3.0.2');
  });
});

describe('ZUGFeRD PDF attachment invariants', () => {
  it('attachment filename matches the Factur-X §5.3.2 spec value exactly', () => {
    // Readers do a case-insensitive compare on this exact filename; any
    // deviation silently demotes the PDF to "looks like ZUGFeRD, isn't".
    expect(ZUGFERD_ATTACHMENT_FILENAME).toBe('factur-x.xml');
  });

  it('attachment MIME is application/xml', () => {
    expect(ZUGFERD_ATTACHMENT_MIME).toBe('application/xml');
  });

  it('AFRelationship is Alternative (required by Factur-X)', () => {
    expect(ZUGFERD_AF_RELATIONSHIP).toBe('Alternative');
  });
});

describe('ZUGFeRD XMP namespace constants', () => {
  it('XMP namespace URI matches the spec-mandated Factur-X 1p0 URI', () => {
    // This URI is the single identifier ZUGFeRD-capable readers index
    // PDFs by. Mutate it and the PDF is no longer recognized as ZUGFeRD.
    expect(ZUGFERD_XMP_NAMESPACE).toBe('urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#');
    expect(ZUGFERD_XMP_NAMESPACE.endsWith(':1p0#')).toBe(true);
  });

  it('XMP prefix is "fx"', () => {
    expect(ZUGFERD_XMP_PREFIX).toBe('fx');
  });

  it('XMP DocumentType is INVOICE', () => {
    expect(ZUGFERD_XMP_DOCUMENT_TYPE).toBe('INVOICE');
  });

  it('XMP DocumentFileName mirrors the attachment filename', () => {
    expect(ZUGFERD_XMP_DOCUMENT_FILE_NAME).toBe(ZUGFERD_ATTACHMENT_FILENAME);
  });

  it('XMP Version is 1.0', () => {
    expect(ZUGFERD_XMP_VERSION).toBe('1.0');
  });
});

describe('PDF/A-3b identification constants', () => {
  it('PDF/A namespace URI is the AIIM-published value', () => {
    expect(PDFA_ID_NAMESPACE).toBe('http://www.aiim.org/pdfa/ns/id/');
  });

  it('PDF/A part is "3"', () => {
    expect(PDFA_ID_PART).toBe('3');
  });

  it('PDF/A conformance is "B"', () => {
    expect(PDFA_ID_CONFORMANCE).toBe('B');
  });
});

describe('GUIDELINE_URN_TO_LEVEL mapping', () => {
  it('has exactly six entries (COMFORT / XRECHNUNG / EXTENDED spread)', () => {
    // Two XRECHNUNG entries: legacy xoev-de URN + canonical xeinkauf.de URN
    // (the KoSIT validator-configuration-xrechnung release-2026-01-31 emits
    // the xeinkauf.de form; older documents still carry the xoev-de form).
    expect(Object.keys(GUIDELINE_URN_TO_LEVEL)).toHaveLength(6);
  });

  it('every key maps to a valid ZugferdConformanceLevel', () => {
    const validLevels: ZugferdConformanceLevel[] = ['COMFORT', 'XRECHNUNG', 'EXTENDED'];
    for (const urn of Object.keys(GUIDELINE_URN_TO_LEVEL)) {
      const level = GUIDELINE_URN_TO_LEVEL[urn];
      expect(validLevels).toContain(level);
    }
  });

  it('EN 16931 URN resolves to COMFORT', () => {
    expect(GUIDELINE_URN_TO_LEVEL['urn:cen.eu:en16931:2017']).toBe('COMFORT');
  });

  it('Factur-X comfort URN resolves to COMFORT', () => {
    expect(GUIDELINE_URN_TO_LEVEL['urn:factur-x.eu:1p0:comfort']).toBe('COMFORT');
  });

  it('Factur-X en16931 alias URN resolves to COMFORT', () => {
    expect(GUIDELINE_URN_TO_LEVEL['urn:factur-x.eu:1p0:en16931']).toBe('COMFORT');
  });

  it('XRechnung compliance URN (legacy xoev-de form) resolves to XRECHNUNG', () => {
    expect(
      GUIDELINE_URN_TO_LEVEL[
        'urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_3.0'
      ],
    ).toBe('XRECHNUNG');
  });

  it('XRechnung compliance URN (canonical xeinkauf.de form) resolves to XRECHNUNG', () => {
    expect(
      GUIDELINE_URN_TO_LEVEL[
        'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
      ],
    ).toBe('XRECHNUNG');
  });

  it('Factur-X extended URN resolves to EXTENDED', () => {
    expect(GUIDELINE_URN_TO_LEVEL['urn:factur-x.eu:1p0:extended']).toBe('EXTENDED');
  });
});

describe('UNSUPPORTED_GUIDELINE_URNS set', () => {
  it('has exactly six unsupported URNs (3 Factur-X + 3 ZUGFeRD 2p1)', () => {
    expect(UNSUPPORTED_GUIDELINE_URNS.size).toBe(6);
  });

  it('contains minimum + basic + basicwl for both Factur-X and ZUGFeRD 2p1', () => {
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:factur-x.eu:1p0:minimum')).toBe(true);
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:factur-x.eu:1p0:basic')).toBe(true);
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:factur-x.eu:1p0:basicwl')).toBe(true);
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:zugferd.de:2p1:minimum')).toBe(true);
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:zugferd.de:2p1:basic')).toBe(true);
    expect(UNSUPPORTED_GUIDELINE_URNS.has('urn:zugferd.de:2p1:basicwl')).toBe(true);
  });
});

describe('GUIDELINE_URN_TO_LEVEL and UNSUPPORTED_GUIDELINE_URNS are disjoint', () => {
  it('no URN appears in both sets', () => {
    for (const urn of Object.keys(GUIDELINE_URN_TO_LEVEL)) {
      expect(UNSUPPORTED_GUIDELINE_URNS.has(urn), `URN ${urn} must not be in both sets`).toBe(
        false,
      );
    }
    for (const urn of UNSUPPORTED_GUIDELINE_URNS) {
      expect(urn in GUIDELINE_URN_TO_LEVEL, `URN ${urn} must not be in both sets`).toBe(false);
    }
  });
});
