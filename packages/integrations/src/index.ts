// Types

export { AutentiAdapter } from './adapters/autenti-adapter.js';
// Adapters
export { BaseAdapter } from './adapters/base-adapter.js';
export { Bir1CompanyRegistryAdapter } from './adapters/bir1-company-registry-adapter.js';
// Phase 75 D-13 — contract health-check tool_use schema + Anthropic eval service
export type { ContractHealthToolInput } from './adapters/contract-health-tools.js';
export {
  CONTRACT_HEALTH_PROMPT,
  CONTRACT_HEALTH_TOOL,
  CONTRACT_HEALTH_TOOL_NAME,
} from './adapters/contract-health-tools.js';
export { DataportCompanyRegistryAdapter } from './adapters/dataport-company-registry-adapter.js';
export { DocuSignAdapter } from './adapters/docusign-adapter.js';
export { KsefAdapter } from './adapters/ksef-adapter.js';
export { loadHeavyAdapters, registerAllAdapters } from './adapters/register-all.js';
export { ResendAdapter } from './adapters/resend-adapter.js';
export { SlackAdapter } from './adapters/slack-adapter.js';
// Provider Registry
export {
  clearAdapters,
  getAdapter,
  getAllAdapters,
  getAllCompanyRegistryAdapters,
  getAllOcrAdapters,
  getCompanyRegistryAdapterBySlug,
  getOcrAdapterBySlug,
  registerAdapter,
  registerCompanyRegistryAdapter,
  registerOcrAdapter,
} from './registry.js';
// Phase 76 D-14 — per-provider deprovision scope/capability typed-consts
export {
  GOOGLE_WORKSPACE_DEPROVISION_CAPABILITIES,
  GOOGLE_WORKSPACE_DEPROVISION_SCOPES,
} from './scopes/index.js';
// Company Registry Service
export {
  getCompanyRegistryAdapter,
  lookupCompanyByNip,
  resolveCompanyRegistryProvider,
} from './services/company-registry-service.js';
// Concurrency helpers (F-INT-09)
export type { LimitFunction } from './services/concurrency.js';
export { pLimit } from './services/concurrency.js';
export type { EvaluateContractIpAssignmentParams } from './services/contract-health-service.js';
export { evaluateContractIpAssignment } from './services/contract-health-service.js';
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
export type {
  DependencyHealthSnapshot,
  DependencyHealthStatus,
  DependencyProbe,
} from './services/health-service.js';
export {
  getAllProviderHealth,
  getDependencyHealth,
  getProviderHealth,
} from './services/health-service.js';
// Idempotency-key derivation (DRIFT-01 follow-up to F-INT-04)
export type { IdempotencyInputs } from './services/idempotency.js';
export { deriveIdempotencyKey, GLOBAL_ORG_SENTINEL } from './services/idempotency.js';
export type { InfisicalConfig, ZatcaSecretName } from './services/infisical-client.js';
// Infisical Secret Store (ZATCA certificate management)
export {
  createZatcaSecretStore,
  InfisicalSecretStore,
  SecretStoreError,
  ZATCA_SECRET_NAMES,
} from './services/infisical-client.js';
// Org Definitions sync — Jira / Linear project clients
export type { JiraProject } from './services/jira-projects-client.js';
export { fetchJiraProjects } from './services/jira-projects-client.js';
export type { LinearTeam } from './services/linear-teams-client.js';
export { fetchLinearTeams, linearGraphQL } from './services/linear-teams-client.js';
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
export type { BreakerSnapshot, WithResilienceOptions } from './services/resilience.js';
export {
  getBreakerSnapshots,
  resetResilienceForTests,
  withResilience,
} from './services/resilience.js';
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
// Webhook payload schemas (F-INT-07)
export type {
  WebhookValidationFailure,
  WebhookValidationResult,
  WebhookValidationSuccess,
} from './services/webhook-schemas.js';
export {
  getRegisteredWebhookProviders,
  validateWebhookPayload,
} from './services/webhook-schemas.js';
export type {
  CompanyLookupRequest,
  CompanyLookupResult,
  CompanyRegistryAdapter,
  CompanyRegistryProvider,
} from './types/company-registry.js';
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
