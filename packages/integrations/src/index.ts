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
