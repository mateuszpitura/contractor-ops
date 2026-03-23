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

// Adapters
export { BaseAdapter } from "./adapters/base-adapter.js";
export { SlackAdapter } from "./adapters/slack-adapter.js";
export { ResendAdapter } from "./adapters/resend-adapter.js";
export { registerAllAdapters } from "./adapters/register-all.js";
