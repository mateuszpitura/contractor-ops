// ---------------------------------------------------------------------------
// Government API Client — Abstract Base Class
// ---------------------------------------------------------------------------

import type { SecretStore } from '@contractor-ops/secrets';
import type {
  GovApiAuditEntry,
  GovApiConfig,
  GovApiEnvironment,
  GovApiRetryConfig,
} from './types.js';

const DEFAULT_RETRY: GovApiRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [500, 502, 503, 429],
};

/**
 * Abstract base class for government API integrations.
 *
 * Provides:
 * - HTTP fetch with exponential backoff retry
 * - Request timeout via AbortController
 * - Certificate auth loading from secret store
 * - Sandbox/production URL switching
 * - Audit logging hook (override `emitAuditEntry` to persist)
 *
 * Profiles (ZATCA, Peppol, future markets) extend this class and
 * implement `getApiName()` plus any profile-specific methods.
 */
export abstract class GovApiClient {
  protected readonly config: GovApiConfig;
  protected readonly environment: GovApiEnvironment;
  private certificate: string | null = null;
  private secretStore: SecretStore | null = null;

  constructor(config: GovApiConfig, environment: GovApiEnvironment) {
    this.config = config;
    this.environment = environment;
  }

  /** Profile-specific API name for rate limiting keys and audit logs. */
  abstract getApiName(): string;

  /** Get the base URL for the given (or current) environment. */
  getBaseUrl(env?: GovApiEnvironment): string {
    return this.config.baseUrls[env ?? this.environment];
  }

  /** Set the secret store for certificate loading. */
  setSecretStore(store: SecretStore): void {
    this.secretStore = store;
  }

  /**
   * Load a client certificate from the secret store.
   * Caches the certificate after first load.
   *
   * @throws If no secret path is configured and none provided
   * @throws If SecretStore is not set
   * @throws If certificate is not found at the given path
   */
  protected async loadCertificate(secretPath?: string): Promise<string> {
    const path = secretPath ?? this.config.certSecretPath;
    if (!path) {
      throw new Error('No certificate secret path configured');
    }
    if (!this.secretStore) {
      throw new Error('SecretStore not set — call setSecretStore() first');
    }
    if (this.certificate) return this.certificate;

    const cert = await this.secretStore.get(path);
    if (!cert) {
      throw new Error(`Certificate not found at secret path: ${path}`);
    }
    this.certificate = cert;
    return this.certificate;
  }

  /**
   * Build request headers with default Content-Type and optional Authorization.
   */
  private buildHeaders(options: RequestInit): Headers {
    const headers = new Headers(options.headers);
    if (this.certificate && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.certificate}`);
    }
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  /**
   * Emit audit entry if conditions are met (not skipped, organizationId present).
   */
  private maybeAudit(
    opts: { organizationId?: string; skipAudit?: boolean } | undefined,
    path: string,
    method: string,
    responseStatus: number,
    responseTimeMs: number,
  ): void {
    if (!opts?.skipAudit && opts?.organizationId) {
      this.emitAuditEntry({
        apiName: this.getApiName(),
        organizationId: opts.organizationId,
        endpoint: path,
        method,
        responseStatus,
        responseTimeMs,
      });
    }
  }

  /**
   * Calculate retry backoff delay for a given attempt.
   */
  private retryDelay(attempt: number, retry: GovApiRetryConfig): number {
    return Math.min(retry.baseDelayMs * 2 ** (attempt - 1), retry.maxDelayMs);
  }

  /**
   * Execute a single fetch attempt with timeout and audit logging.
   * Returns the response, or throws on network/timeout error.
   */
  private async fetchOnce(
    url: string,
    options: RequestInit,
    opts: { organizationId?: string; skipAudit?: boolean } | undefined,
    path: string,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers = this.buildHeaders(options);
      const startMs = Date.now();
      const response = await globalThis.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      this.maybeAudit(opts, path, options.method ?? 'GET', response.status, Date.now() - startMs);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normalize an unknown thrown value into an Error instance.
   */
  private static toError(err: unknown): Error {
    return err instanceof Error ? err : new Error(String(err));
  }

  /**
   * Check whether a response status is retryable for the given attempt.
   */
  private isRetryable(response: Response, attempt: number, retry: GovApiRetryConfig): boolean {
    return retry.retryableStatuses.includes(response.status) && attempt < retry.maxRetries;
  }

  /**
   * HTTP fetch with retry, timeout, and audit logging.
   *
   * - Retries on configurable status codes with exponential backoff
   * - Aborts after configurable timeout (default 30s)
   * - Emits audit entries for each completed request
   * - Sets Authorization header from loaded certificate if available
   */
  protected async fetch(
    path: string,
    options: RequestInit = {},
    opts?: { organizationId?: string; skipAudit?: boolean },
  ): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`;
    const retry = { ...DEFAULT_RETRY, ...this.config.retry };
    const timeoutMs = this.config.timeoutMs ?? 30000;
    let lastError: Error | null = null;
    let lastResponse: Response | null = null;

    for (let attempt = 0; attempt <= retry.maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, this.retryDelay(attempt, retry)));
      }

      try {
        const response = await this.fetchOnce(url, options, opts, path, timeoutMs);

        if (this.isRetryable(response, attempt, retry)) {
          lastResponse = response;
          continue;
        }

        return response;
      } catch (err) {
        lastError = GovApiClient.toError(err);
        if (attempt >= retry.maxRetries) break;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError ?? new Error(`Failed to fetch ${url} after ${retry.maxRetries + 1} attempts`);
  }

  /**
   * Override to persist audit entries.
   * Default implementation is a no-op — subclasses or middleware wire
   * this to the GovApiAuditLogger.
   */
  protected emitAuditEntry(_entry: GovApiAuditEntry): void {
    // no-op by default
  }
}
