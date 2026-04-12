// Types

export { AutentiAdapter } from "./adapters/autenti-adapter.js";
// Adapters
export { BaseAdapter } from "./adapters/base-adapter.js";
export { DocuSignAdapter } from "./adapters/docusign-adapter.js";
export { KsefAdapter } from "./adapters/ksef-adapter.js";
export { registerAllAdapters } from "./adapters/register-all.js";
export { ResendAdapter } from "./adapters/resend-adapter.js";
export { SlackAdapter } from "./adapters/slack-adapter.js";
// Provider Registry
export {
  clearAdapters,
  getAdapter,
  getAllAdapters,
  registerAdapter,
} from "./registry.js";
// Credential Service
export {
  deleteCredentials,
  getCredentials,
  legacyEncryptCredentials,
  storeCredentials,
} from "./services/credential-service.js";
// E-Sign Service
export {
  createSigningEnvelope,
  downloadSignedDocument,
  getEmbeddedSigningUrl,
  getESignAdapter,
  normalizeSigningEvent,
  resendSigningNotification,
  voidSigningEnvelope,
} from "./services/esign-service.js";
// Health Service
export {
  getAllProviderHealth,
  getProviderHealth,
} from "./services/health-service.js";
export type { InfisicalConfig, ZatcaSecretName } from "./services/infisical-client.js";
// Infisical Secret Store (ZATCA certificate management)
export {
  createZatcaSecretStore,
  InfisicalSecretStore,
  SecretStoreError,
  ZATCA_SECRET_NAMES,
} from "./services/infisical-client.js";
export type { OAuthStatePayload } from "./services/oauth-state.js";
// OAuth State (CSRF protection)
export {
  generateOAuthState,
  verifyOAuthState,
} from "./services/oauth-state.js";
// QStash Client
export {
  getQStashClient,
  resetQStashClient,
} from "./services/qstash-client.js";
// Token Refresh
export {
  lazyRefresh,
  refreshExpiring,
} from "./services/token-refresh.js";
// Webhook Dispatcher
export {
  dispatchWebhook,
  logWebhookDelivery,
  queueWebhookProcessing,
} from "./services/webhook-dispatcher.js";
export type {
  EmbeddedSigningUrlResult,
  ESignAdapter,
  NormalizedSigningEvent,
  SignedDocumentResult,
  SignerInfo,
  SigningEnvelopeRequest,
  SigningEnvelopeResult,
} from "./types/esign.js";
export type {
  CredentialBlob,
  IntegrationProviderAdapter,
  OAuthConfig,
  ProviderHealthStatus,
  WebhookPayload,
  WebhookVerificationResult,
} from "./types/index.js";
