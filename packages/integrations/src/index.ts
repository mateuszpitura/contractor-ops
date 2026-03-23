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
