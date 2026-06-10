// ZUGFeRD embedded-XML validator delegate test.
//
// The ZUGFeRD validator is a thin re-export of the XRechnung KoSIT
// three-layer pipeline — asserted here via strict reference equality so any
// future divergence is a deliberate, typed change (not an accidental
// drift introduced by a copy-paste reimplementation).

import { describe, expect, it } from 'vitest';

import { validateXRechnungCii } from '../../xrechnung-de/validator.js';
import { validateZugferdEmbeddedXml } from '../validator.js';

describe('validateZugferdEmbeddedXml', () => {
  it('is the same function reference as validateXRechnungCii (re-export)', () => {
    // Same reference means: fix-forward changes to the XRechnung validator
    // automatically apply to the ZUGFeRD validation surface — no drift window.
    expect(validateZugferdEmbeddedXml).toBe(validateXRechnungCii);
  });
});
