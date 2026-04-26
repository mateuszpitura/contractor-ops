// Phase 62 · Plan 62-02 Task 5 — ZUGFeRD embedded-XML validator delegate.
//
// Once a ZUGFeRD PDF has been opened and the `factur-x.xml` payload has been
// extracted, the XML itself is validated by the SAME KoSIT three-layer
// pipeline that Phase 61 ships for XRechnung — the ZUGFeRD COMFORT and
// XRECHNUNG profiles both sit on top of the EN 16931 + XRechnung CIUS
// Schematron rule-sets.
//
// We therefore re-export the XRechnung validator under a ZUGFeRD-specific
// name so the registry entry has its own symbol for future divergence (e.g.
// EXTENDED-profile extensions), while today's implementation delegates
// byte-for-byte to the existing validator.

export { validateXRechnungCii as validateZugferdEmbeddedXml } from '../xrechnung-de/validator.js';
