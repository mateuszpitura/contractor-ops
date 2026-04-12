// ---------------------------------------------------------------------------
// Government API Framework — Type Definitions
// ---------------------------------------------------------------------------

/** Deployment environment for government API endpoints. */
export type GovApiEnvironment = 'sandbox' | 'production';

/** Configuration for HTTP retry behavior. */
export interface GovApiRetryConfig {
  /** Maximum number of retry attempts. Default: 3. */
  maxRetries: number;
  /** Base delay in milliseconds for exponential backoff. Default: 1000. */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. Default: 30000. */
  maxDelayMs: number;
  /** HTTP status codes that trigger a retry. Default: [500, 502, 503, 429]. */
  retryableStatuses: number[];
}

/** Configuration for per-API rate limiting. */
export interface GovApiRateLimitConfig {
  /** Maximum requests allowed within the time window. */
  maxRequests: number;
  /** Time window duration in milliseconds. */
  windowMs: number;
}

/** Full configuration for a government API profile. */
export interface GovApiConfig {
  /** Base URLs for sandbox and production environments. */
  baseUrls: Record<GovApiEnvironment, string>;
  /** Partial retry config — merged with defaults. */
  retry: Partial<GovApiRetryConfig>;
  /** Optional rate limiting configuration. */
  rateLimit?: GovApiRateLimitConfig;
  /** HTTP request timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
  /** Path in the secret store for the client certificate. */
  certSecretPath?: string;
}

/** Structured audit log entry for a government API request. */
export interface GovApiAuditEntry {
  /** API profile name (e.g., "zatca", "peppol-ae"). */
  apiName: string;
  /** Organization ID making the request. */
  organizationId: string;
  /** API endpoint path (e.g., "/invoices/report"). */
  endpoint: string;
  /** HTTP method (GET, POST, etc.). */
  method: string;
  /** SHA-256 hash of the request body (never the raw body). */
  requestBodyHash?: string;
  /** HTTP response status code. */
  responseStatus: number;
  /** Response time in milliseconds. */
  responseTimeMs: number;
  /** Error message if the request failed. */
  errorMessage?: string;
}
