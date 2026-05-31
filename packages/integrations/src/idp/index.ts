// Phase 77 — public type surface of the `idp/` module (impact-preview + error-classifier).

export type { ClassifyErrorInput, ErrorClass } from './error-classifier.js';
export { classifyError } from './error-classifier.js';
export type {
  GwsImpactCustomMetrics,
  ImpactCommonMetrics,
  ImpactPreview,
  ImpactPreviewProvider,
  SlackImpactCustomMetrics,
} from './impact-preview.js';
