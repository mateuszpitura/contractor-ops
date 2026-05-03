// Types

export { AutentiAdapter } from './adapters/autenti-adapter.js';
// Adapters
export { BaseAdapter } from './adapters/base-adapter.js';
export { DocuSignAdapter } from './adapters/docusign-adapter.js';
export { KsefAdapter } from './adapters/ksef-adapter.js';
export { registerAllAdapters } from './adapters/register-all.js';
export { ResendAdapter } from './adapters/resend-adapter.js';
export { SlackAdapter } from './adapters/slack-adapter.js';
// Provider Registry
export {
  clearAdapters,
  getAdapter,
  getAllAdapters,
  getAllOcrAdapters,
  getOcrAdapterBySlug,
  registerAdapter,
  registerOcrAdapter,
} from './registry.js';
// Credential Service
export {
  decryptCredentials,
  deleteCredentials,
  encryptCredentials,
  getCredentials,
  getProviderEncryptionKey,
  storeCredentials,
} from './services/credential-service.js';
// E-Sign Service
export {
  createSigningEnvelope,
  downloadSignedDocument,
  getEmbeddedSigningUrl,
  getESignAdapter,
  normalizeSigningEvent,
  resendSigningNotification,
  voidSigningEnvelope,
} from './services/esign-service.js';
// Shared HTTP fetch helpers
export type { FetchWithTimeoutOptions } from './services/fetch-helpers.js';
export {
  DEFAULT_FETCH_TIMEOUT_MS,
  fetchJsonWithTimeout,
  fetchWithTimeout,
  isRetryableError,
} from './services/fetch-helpers.js';
// Health Service
export {
  getAllProviderHealth,
  getProviderHealth,
} from './services/health-service.js';
export type { InfisicalConfig, ZatcaSecretName } from './services/infisical-client.js';
// Infisical Secret Store (ZATCA certificate management)
export {
  createZatcaSecretStore,
  InfisicalSecretStore,
  SecretStoreError,
  ZATCA_SECRET_NAMES,
} from './services/infisical-client.js';
export type { OAuthStatePayload } from './services/oauth-state.js';
// OAuth State (CSRF protection)
export {
  generateOAuthState,
  verifyOAuthState,
} from './services/oauth-state.js';
// QStash Client
export {
  getQStashClient,
  publishJSONWithContext,
  resetQStashClient,
} from './services/qstash-client.js';
// Resilience layer (circuit breaker + retry + concurrency cap)
export type { WithResilienceOptions } from './services/resilience.js';
export { resetResilienceForTests, withResilience } from './services/resilience.js';
export type { ProviderResilienceConfig } from './services/resilience-config.js';
export {
  DEFAULT_RESILIENCE_CONFIG,
  getResilienceConfig,
  PROVIDER_RESILIENCE_CONFIG,
} from './services/resilience-config.js';
// Token Refresh
export {
  lazyRefresh,
  refreshExpiring,
} from './services/token-refresh.js';
// Webhook Dispatcher
export {
  dispatchWebhook,
  logWebhookDelivery,
  queueWebhookProcessing,
} from './services/webhook-dispatcher.js';
export type {
  EmbeddedSigningUrlResult,
  ESignAdapter,
  NormalizedSigningEvent,
  SignedDocumentResult,
  SignerInfo,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
} from './types/esign.js';
export type {
  CredentialBlob,
  IntegrationProviderAdapter,
  OAuthConfig,
  ProviderHealthStatus,
  WebhookPayload,
  WebhookVerificationResult,
} from './types/index.js';
