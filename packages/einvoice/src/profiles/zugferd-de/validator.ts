// ZUGFeRD embedded-XML validator delegate.
//
// Once a ZUGFeRD PDF has been opened and the `factur-x.xml` payload has been
// extracted, the XML itself is validated by the same KoSIT three-layer
// pipeline used for XRechnung — the ZUGFeRD COMFORT and XRECHNUNG profiles
// both sit on top of the EN 16931 + XRechnung CIUS Schematron rule-sets.
//
// Re-exported under a ZUGFeRD-specific name so the registry entry has its own
// symbol for future divergence (e.g. EXTENDED-profile extensions), while
// today's implementation delegates byte-for-byte to the existing validator.

// biome-ignore lint/performance/noBarrelFile: intentional public aggregator — ZUGFeRD-named validator delegate with its own symbol for future divergence
export { validateXRechnungCii as validateZugferdEmbeddedXml } from '../xrechnung-de/validator.js';
