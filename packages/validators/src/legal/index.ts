// packages/validators/src/legal/index.ts
//
// Phase 73 — COMPL doc-name locked-phrase registry aggregator (D-14, D-15).
// Re-exports the per-jurisdiction locked-name modules so consumers can import a
// single surface. Per-jurisdiction legal review still lands per-file (UK adviser
// reviews compliance-uk.ts, Steuerberater reviews compliance-de.ts, etc.).

export * from './compliance-de.js';
export * from './compliance-ksa.js';
export * from './compliance-pl.js';
export * from './compliance-uae.js';
export * from './compliance-uk.js';
export * from './compliance-us.js';
