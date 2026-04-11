// Types
export type {
  CredentialBlob,
  WebhookVerificationResult,
  WebhookPayload,
  ProviderHealthStatus,
  OAuthConfig,
  IntegrationProviderAdapter,
} from "./types/index.js";

// Credential Service
export {
  getProviderEncryptionKey,
  encryptCredentials,
  decryptCredentials,
} from "./services/credential-service.js";

// OAuth State (CSRF protection)
export {
  generateOAuthState,
  verifyOAuthState,
} from "./services/oauth-state.js";
export type { OAuthStatePayload } from "./services/oauth-state.js";

// Token Refresh
export {
  refreshExpiring,
  lazyRefresh,
} from "./services/token-refresh.js";

// Provider Registry
export {
  registerAdapter,
  getAdapter,
  getAllAdapters,
  clearAdapters,
} from "./registry.js";

// QStash Client
export {
  getQStashClient,
  resetQStashClient,
} from "./services/qstash-client.js";

// Webhook Dispatcher
export {
  dispatchWebhook,
  logWebhookDelivery,
  queueWebhookProcessing,
} from "./services/webhook-dispatcher.js";

// Health Service
export {
  getProviderHealth,
  getAllProviderHealth,
} from "./services/health-service.js";

// E-Sign Service
export {
  getESignAdapter,
  createSigningEnvelope,
  getEmbeddedSigningUrl,
  downloadSignedDocument,
  voidSigningEnvelope,
  resendSigningNotification,
  normalizeSigningEvent,
} from "./services/esign-service.js";

export type {
  ESignAdapter,
  SigningEnvelopeRequest,
  SignerInfo,
  SigningEnvelopeResult,
  EmbeddedSigningUrlResult,
  SignedDocumentResult,
  NormalizedSigningEvent,
} from "./types/esign.js";

// Adapters
export { BaseAdapter } from "./adapters/base-adapter.js";
export { SlackAdapter } from "./adapters/slack-adapter.js";
export { ResendAdapter } from "./adapters/resend-adapter.js";
export { DocuSignAdapter } from "./adapters/docusign-adapter.js";
export { AutentiAdapter } from "./adapters/autenti-adapter.js";
export { registerAllAdapters } from "./adapters/register-all.js";

// KSeF — backward compatibility re-exports from @contractor-ops/einvoice
// TODO: Remove after all consumers switch to @contractor-ops/einvoice
export { KsefApiClient } from "@contractor-ops/einvoice";
export type {
  KsefSession,
  KsefInvoiceMetadata,
  KsefQueryResult,
} from "@contractor-ops/einvoice";
export { parseFa3Xml, mapKsefToInvoiceFields } from "@contractor-ops/einvoice";
export { KsefAdapter } from "./adapters/ksef-adapter.js";
