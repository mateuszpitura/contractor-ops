// ---------------------------------------------------------------------------
// Government API Client — Abstract Base Class
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type { Logger } from '@contractor-ops/logger';
import { createLogger } from '@contractor-ops/logger';
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

/** HTTP methods considered idempotent for retry purposes. */
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

/** Synthetic response status used in audit entries when the request threw before any HTTP response. */
export const AUDIT_STATUS_NETWORK_ERROR = 0;

/** Per-fetch options understood by `GovApiClient.fetch`. */
export interface GovApiFetchOptions {
  /** Tenant org ID — used for audit row + structured logs. */
  organizationId?: string;
  /** Skip emitting an audit entry for this call. */
  skipAudit?: boolean;
  /**
   * If `true`, skip the auto-injected `Authorization: Bearer <bearerToken>` header.
   * Used by OAuth bootstrap calls (e.g. HMRC `/oauth/token`) which authenticate
   * via the request body instead.
   */
  skipAuth?: boolean;
  /**
   * Allow retries for non-idempotent HTTP methods (POST/PATCH/etc.).
   * Defaults to `false`; opt-in only when the caller has guaranteed
   * idempotency (e.g. via an idempotency-key header).
   */
  retryNonIdempotent?: boolean;
  /**
   * Total wall-clock deadline for the entire `fetch()` call, in milliseconds.
   * When exceeded, the loop short-circuits and rejects with the last error.
   * Falls back to `config.timeoutMs * (maxRetries + 1) + sum(backoff)` if not provided.
   */
  deadlineMs?: number;
}

/**
 * Abstract base class for government API integrations.
 *
 * Provides:
 * - HTTP fetch with exponential backoff + full jitter retry
 * - Per-attempt timeout via AbortController + total-call deadline guard
 * - Bearer token auth loading from secret store (mTLS support is out of scope —
 *   subclasses must supply their own undici Agent for cert/key auth)
 * - Sandbox/production URL switching
 * - Audit logging hook (override `emitAuditEntry` to persist) — emits on
 *   thrown errors as well as completed responses
 * - Structured Pino logging on retries / final outcome with a per-call
 *   request UUID for correlation
 *
 * Profiles (HMRC VAT, VIES, future ZATCA/Peppol) extend this class and
 * implement `getApiName()` plus any profile-specific methods.
 */
export abstract class GovApiClient {
  protected readonly config: GovApiConfig;
  protected readonly environment: GovApiEnvironment;
  /**
   * Bearer token loaded from the secret store. Auto-injected as
   * `Authorization: Bearer <bearerToken>` on every fetch unless
   * `{ skipAuth: true }` is passed.
   *
   * NOTE: this slot is for bearer-style credentials only. mTLS clients
   * (ZATCA, Peppol) MUST use an undici Agent — the field name is preserved
   * as `bearerToken` precisely to make this contract obvious.
   */
  private bearerToken: string | null = null;
  private secretStore: SecretStore | null = null;
  protected readonly log: Logger;

  constructor(config: GovApiConfig, environment: GovApiEnvironment) {
    this.config = config;
    this.environment = environment;
    // Child logger bound to the API name surfaces every event with a stable
    // `service` field for grep-ability across multiple gov clients.
    this.log = createLogger({ service: 'gov-api', apiName: this.getApiNameSafe() });
  }

  /** Profile-specific API name for rate limiting keys and audit logs. */
  abstract getApiName(): string;

  /**
   * `getApiName()` may be invoked from the constructor before subclass fields
   * are initialised. Wrap to fall back to a generic label if it throws.
   */
  private getApiNameSafe(): string {
    try {
      return this.getApiName();
    } catch {
      return 'unknown';
    }
  }

  /** Get the base URL for the given (or current) environment. */
  getBaseUrl(env?: GovApiEnvironment): string {
    return this.config.baseUrls[env ?? this.environment];
  }

  /** Set the secret store for bearer-token loading. */
  setSecretStore(store: SecretStore): void {
    this.secretStore = store;
  }

  /**
   * Load a bearer token from the secret store.
   * Caches the value after first successful load.
   *
   * @throws If no secret path is configured and none provided
   * @throws If SecretStore is not set
   * @throws If no value is found at the given path
   */
  protected async loadBearerToken(secretPath?: string): Promise<string> {
    const path = secretPath ?? this.config.certSecretPath;
    if (!path) {
      throw new Error('No bearer-token secret path configured');
    }
    if (!this.secretStore) {
      throw new Error('SecretStore not set — call setSecretStore() first');
    }
    if (this.bearerToken) return this.bearerToken;

    const value = await this.secretStore.get(path);
    if (!value) {
      throw new Error(`Bearer token not found at secret path: ${path}`);
    }
    this.bearerToken = value;
    return this.bearerToken;
  }

  /**
   * Backwards-compatible alias for {@link loadBearerToken}. The original
   * name conflated bearer tokens with mTLS certificates — kept as a thin
   * wrapper to avoid churn within this package only.
   *
   * @deprecated Use {@link loadBearerToken}.
   */
  protected loadCertificate(secretPath?: string): Promise<string> {
    return this.loadBearerToken(secretPath);
  }

  /**
   * Build request headers with default Content-Type and optional Authorization.
   */
  private buildHeaders(options: RequestInit, skipAuth: boolean): Headers {
    const headers = new Headers(options.headers);
    if (!skipAuth && this.bearerToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.bearerToken}`);
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
    opts: GovApiFetchOptions | undefined,
    path: string,
    method: string,
    responseStatus: number,
    responseTimeMs: number,
    errorMessage?: string,
  ): void {
    if (!opts?.skipAudit && opts?.organizationId) {
      this.emitAuditEntry({
        apiName: this.getApiName(),
        organizationId: opts.organizationId,
        endpoint: path,
        method,
        responseStatus,
        responseTimeMs,
        errorMessage,
      });
    }
  }

  /**
   * Calculate retry backoff delay for a given attempt with full jitter.
   *
   * Full jitter (AWS recommendation): `random(0, min(base*2^attempt, cap))`.
   * Spreads thundering-herd across the entire backoff window so concurrent
   * tenants hitting the same upstream outage don't synchronise their retries.
   */
  private retryDelay(attempt: number, retry: GovApiRetryConfig): number {
    const cap = Math.min(retry.baseDelayMs * 2 ** (attempt - 1), retry.maxDelayMs);
    return Math.floor(Math.random() * cap);
  }

  /**
   * Execute a single fetch attempt with timeout and audit logging.
   * Returns the response, or throws on network/timeout error.
   * Emits an audit entry on either path so error attempts are observable.
   */
  private async fetchOnce(
    url: string,
    options: RequestInit,
    opts: GovApiFetchOptions | undefined,
    path: string,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startMs = Date.now();
    const method = options.method ?? 'GET';

    try {
      const headers = this.buildHeaders(options, opts?.skipAuth === true);
      const response = await globalThis.fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      this.maybeAudit(opts, path, method, response.status, Date.now() - startMs);
      return response;
    } catch (err) {
      // Audit thrown errors so timeouts/DNS/TLS failures show up alongside HTTP responses.
      const message = GovApiClient.toError(err).message;
      this.maybeAudit(
        opts,
        path,
        method,
        AUDIT_STATUS_NETWORK_ERROR,
        Date.now() - startMs,
        message,
      );
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Normalize an unknown thrown value into an Error instance.
   * Preserves diagnostic info for non-Error throws via JSON serialisation.
   */
  private static toError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === 'object' && err !== null) {
      try {
        return new Error(JSON.stringify(err));
      } catch {
        // Cyclic / unserialisable — fall back to String() with constructor hint.
        const ctor = (err as object).constructor?.name ?? 'object';
        return new Error(`[unserialisable ${ctor}]`);
      }
    }
    return new Error(String(err));
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
   * - Retries on configurable status codes with exponential backoff + full jitter
   * - Aborts each attempt after `config.timeoutMs` (default 30s)
   * - Honours an overall `opts.deadlineMs` so a stuck upstream cannot pin a
   *   request handler beyond the caller's SLO
   * - Emits audit entries for each completed AND each thrown attempt
   * - Sets Authorization header from loaded bearer token unless `skipAuth: true`
   * - Skips retries for non-idempotent methods unless `retryNonIdempotent: true`
   */
  protected async fetch(
    path: string,
    options: RequestInit = {},
    opts?: GovApiFetchOptions,
  ): Promise<Response> {
    const url = `${this.getBaseUrl()}${path}`;
    const retry = { ...DEFAULT_RETRY, ...this.config.retry };
    const timeoutMs = this.config.timeoutMs ?? 30000;
    const method = (options.method ?? 'GET').toUpperCase();
    const requestId = randomUUID();
    const callStartMs = Date.now();

    // POSTs/PATCHes/etc. must opt-in to retry via `retryNonIdempotent: true`.
    // Without this guard, a retried POST after a 502 can produce duplicate
    // state changes (e.g. a Peppol invoice submitted twice).
    const allowRetry = IDEMPOTENT_METHODS.has(method) || opts?.retryNonIdempotent === true;
    const effectiveMaxRetries = allowRetry ? retry.maxRetries : 0;
    const effectiveRetry: GovApiRetryConfig = { ...retry, maxRetries: effectiveMaxRetries };

    let lastError: Error | null = null;
    let lastResponse: Response | null = null;
    let lastAttemptThrew = false;

    for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
      // Reset per-iteration so a thrown attempt N can't reuse a stale 5xx
      // Response captured on attempt N-1 (HIGH: stale-response leak).
      lastResponse = null;

      if (attempt > 0) {
        const delay = this.retryDelay(attempt, effectiveRetry);
        // Honour the overall deadline before sleeping — pre-empt pointless waits.
        if (this.deadlineExceeded(opts, callStartMs, delay)) break;
        await new Promise(r => setTimeout(r, delay));
      }

      if (this.deadlineExceeded(opts, callStartMs, 0)) break;

      try {
        const attemptStartMs = Date.now();
        const response = await this.fetchOnce(url, options, opts, path, timeoutMs);

        if (this.isRetryable(response, attempt, effectiveRetry)) {
          lastResponse = response;
          lastAttemptThrew = false;
          this.log.warn(
            {
              requestId,
              attempt: attempt + 1,
              status: response.status,
              latencyMs: Date.now() - attemptStartMs,
              path,
              method,
            },
            'gov-api retryable response, scheduling retry',
          );
          continue;
        }

        this.log.info(
          {
            requestId,
            attempt: attempt + 1,
            status: response.status,
            latencyMs: Date.now() - callStartMs,
            path,
            method,
          },
          'gov-api request completed',
        );
        return response;
      } catch (err) {
        lastError = GovApiClient.toError(err);
        lastAttemptThrew = true;
        this.log.warn(
          {
            requestId,
            attempt: attempt + 1,
            err: { message: lastError.message, name: lastError.name },
            path,
            method,
          },
          'gov-api fetch attempt threw',
        );
        if (attempt >= effectiveMaxRetries) break;
      }
    }

    // Decide which error/response to surface based on the LAST attempt outcome.
    // If the last attempt threw, propagate the thrown error rather than a
    // stale 5xx Response from an earlier attempt — masking a network outage
    // as an upstream 500 confuses observability and soft-fail logic.
    if (!lastAttemptThrew && lastResponse) {
      this.log.info(
        {
          requestId,
          status: lastResponse.status,
          latencyMs: Date.now() - callStartMs,
          path,
          method,
          retriesExhausted: true,
        },
        'gov-api request returning last retryable response',
      );
      return lastResponse;
    }

    const totalAttempts = effectiveMaxRetries + 1;
    const finalError =
      lastError ??
      new Error(
        `Failed after ${totalAttempts} attempts (maxRetries=${effectiveMaxRetries}) for ${url}`,
      );
    this.log.warn(
      {
        requestId,
        latencyMs: Date.now() - callStartMs,
        path,
        method,
        err: { message: finalError.message, name: finalError.name },
      },
      'gov-api request failed after all attempts',
    );
    throw finalError;
  }

  /**
   * Returns true when the overall call has already exceeded `opts.deadlineMs`
   * (or would after waiting `additionalMs` more). When no deadline is set, returns false.
   */
  private deadlineExceeded(
    opts: GovApiFetchOptions | undefined,
    startMs: number,
    additionalMs: number,
  ): boolean {
    const deadlineMs = opts?.deadlineMs;
    if (deadlineMs === undefined) return false;
    return Date.now() - startMs + additionalMs >= deadlineMs;
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
