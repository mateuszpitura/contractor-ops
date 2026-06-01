// Phase 77-78 — public type surface of the `idp/` module (impact-preview + error-classifier + result-builder).

export { mapErrorClassToResult } from './deprovision-result.js';
export type { ClassifyErrorInput, ErrorClass } from './error-classifier.js';
export { classifyError } from './error-classifier.js';
export type {
  EntraImpactCustomMetrics,
  GitHubImpactCustomMetrics,
  GwsImpactCustomMetrics,
  ImpactCommonMetrics,
  ImpactPreview,
  ImpactPreviewProvider,
  OktaImpactCustomMetrics,
  SlackImpactCustomMetrics,
} from './impact-preview.js';
