export { GovApiAuditLogger } from './audit-logger.js';
export { GovApiClient } from './client.js';
// Phase 57 · Plan 02 — government VAT client implementations.
export {
  HmrcApiError,
  HmrcVatClient,
  type HmrcVatClientDeps,
  type HmrcVatLookupResult,
  ViesApiError,
  ViesClient,
  type ViesClientDeps,
  type ViesLookupResult,
} from './clients/index.js';
export { GovApiRateLimiter } from './rate-limiter.js';
export {
  type HmrcOauthToken,
  type HmrcVatErrorResponse,
  type HmrcVatLookupResponse,
  hmrcOauthTokenSchema,
  hmrcVatErrorResponseSchema,
  hmrcVatLookupResponseSchema,
} from './schemas/hmrc-vat.schema.js';
export {
  type ViesLookupResponse,
  viesLookupResponseSchema,
} from './schemas/vies.schema.js';
export type {
  GovApiAuditEntry,
  GovApiConfig,
  GovApiEnvironment,
  GovApiRateLimitConfig,
  GovApiRetryConfig,
} from './types.js';
