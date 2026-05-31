export type { ClassifyErrorInput, ErrorClass } from '../idp/error-classifier.js';
// Phase 77 — IdP impact-preview + error-classifier public types.
export { classifyError } from '../idp/error-classifier.js';
export type {
  EntraImpactCustomMetrics,
  GitHubImpactCustomMetrics,
  GwsImpactCustomMetrics,
  ImpactCommonMetrics,
  ImpactPreview,
  ImpactPreviewProvider,
  OktaImpactCustomMetrics,
  SlackImpactCustomMetrics,
} from '../idp/impact-preview.js';
export type { CredentialBlob } from './credentials.js';
export type {
  Deprovisionable,
  DeprovisionFailureKind,
  DeprovisionResult,
  DeprovisionResultStatus,
} from './deprovisionable.js';
export type { ProviderHealthStatus } from './health.js';
export type {
  IntegrationProviderAdapter,
  OAuthConfig,
} from './provider.js';
export type {
  WebhookPayload,
  WebhookVerificationResult,
} from './webhook.js';
