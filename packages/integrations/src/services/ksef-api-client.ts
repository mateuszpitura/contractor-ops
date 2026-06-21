import { constants, createDecipheriv, createPublicKey, publicEncrypt } from 'node:crypto';
import { fetchWithTimeout } from './fetch-helpers.js';
import { withResilience } from './resilience.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KsefSession {
  jwt: string;
  referenceNumber: string;
  encryptionKey: Buffer;
}

/**
 * Per-attempt fetch timeout. KSeF documents up to 60s p99 for some
 * endpoints; we use 30s as the default and let the polling loop's wall-clock
 * bound (`AUTH_POLL_WALL_CLOCK_MS` / `QUERY_POLL_WALL_CLOCK_MS`) handle
 * outright unavailability.
 */
const KSEF_PER_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Total wall-clock budget for `authenticate()` polling. Old code: 30 attempts
 * × (network timeout + 1s) — could exceed an hour with Node default 75s
 * connect timeout. New: 90 seconds total, after which we surface the error
 * instead of stacking inside an outer cron handler that has already returned
 * to its scheduler.
 */
const AUTH_POLL_WALL_CLOCK_MS = 90_000;

/**
 * Total wall-clock budget for `queryInvoices()` polling. KSeF invoice queries
 * can legitimately take 1–2 minutes for large date ranges; cap at 180s.
 */
const QUERY_POLL_WALL_CLOCK_MS = 180_000;

export interface KsefInvoiceMetadata {
  ksefReferenceNumber: string;
  invoiceNumber: string;
  subjectNip: string;
  invoiceDate: string;
}

export interface KsefQueryResult {
  invoiceMetadataList: KsefInvoiceMetadata[];
  hasMore: boolean;
  pageToken?: string;
}

// ---------------------------------------------------------------------------
// KSeF API Client
// ---------------------------------------------------------------------------

/**
 * Client for KSeF (Krajowy System e-Faktur) REST API v2.
 *
 * Supports:
 * - Token-based authentication via RSA-OAEP challenge-response
 * - Async invoice querying by NIP and date range
 * - Individual invoice XML download (with AES-256 decryption if needed)
 * - Session lifecycle management
 *
 * @see https://ksef.mf.gov.pl/api/v2
 */
export class KsefApiClient {
  private readonly baseUrl: string;
  private session: KsefSession | null = null;

  constructor(environment: 'test' | 'prod' = 'prod') {
    this.baseUrl =
      environment === 'test'
        ? 'https://ksef-test.mf.gov.pl/api/v2'
        : 'https://ksef.mf.gov.pl/api/v2';
  }

  /**
   * Compose an optional caller `signal` with a wall-clock guard so EITHER firing
   * aborts the in-flight fetch and breaks the polling loop. Returns the
   * composite signal plus a `cleanup` to clear the timer and detach listeners
   * (call in `finally`).
   */
  private static composeWallClockSignal(
    signal: AbortSignal | undefined,
    wallClockMs: number,
    wallClockReason: string,
  ): { opSignal: AbortSignal; cleanup: () => void } {
    const wallClockController = new AbortController();
    const wallClockTimer = setTimeout(
      () => wallClockController.abort(new Error(wallClockReason)),
      wallClockMs,
    );
    const onCallerAbort = signal
      ? () => wallClockController.abort(signal.reason ?? new Error('aborted'))
      : null;
    if (signal && onCallerAbort) {
      if (signal.aborted) wallClockController.abort(signal.reason);
      else signal.addEventListener('abort', onCallerAbort, { once: true });
    }
    return {
      opSignal: wallClockController.signal,
      cleanup: () => {
        clearTimeout(wallClockTimer);
        if (signal && onCallerAbort) signal.removeEventListener('abort', onCallerAbort);
      },
    };
  }

  /** Sleep `ms` but reject immediately if `opSignal` aborts during the wait. */
  private static abortableSleep(opSignal: AbortSignal, ms: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sleepTimer = setTimeout(resolve, ms);
      if (opSignal.aborted) {
        clearTimeout(sleepTimer);
        reject(opSignal.reason ?? new Error('aborted'));
        return;
      }
      opSignal.addEventListener(
        'abort',
        () => {
          clearTimeout(sleepTimer);
          reject(opSignal.reason ?? new Error('aborted'));
        },
        { once: true },
      );
    });
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Authenticates with KSeF using token-based RSA-OAEP challenge-response.
   *
   * Flow:
   * 1. Fetch public key from KSeF auth endpoint
   * 2. Request challenge for given NIP
   * 3. Encrypt token + timestamp using RSA-OAEP with SHA-256
   * 4. Redeem encrypted token to receive JWT session
   * 5. Poll session status until ready
   */
  /**
   * Authenticate with KSeF.
   *
   * Accepts an optional `signal` so callers (typically a tRPC mutation or
   * QStash consumer) can propagate request-scoped cancellation. If no signal
   * is provided we still bound the full wall-clock with
   * `AUTH_POLL_WALL_CLOCK_MS` to prevent the polling loop from outliving
   * the caller's deadline.
   */
  async authenticate(token: string, nip: string, signal?: AbortSignal): Promise<KsefSession> {
    const { opSignal, cleanup } = KsefApiClient.composeWallClockSignal(
      signal,
      AUTH_POLL_WALL_CLOCK_MS,
      'KSeF authenticate: wall-clock exceeded',
    );

    try {
      // Step 1: Get public key
      const publicKeyResponse = await this.fetchWithRetry(`${this.baseUrl}/auth/public-key`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: opSignal,
      });
      const publicKeyData = (await publicKeyResponse.json()) as {
        publicKey: string;
      };

      // Step 2: Request challenge
      const challengeResponse = await this.fetchWithRetry(`${this.baseUrl}/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // KSeF API 2.x: AuthenticationContextIdentifierType enum is PascalCase (Nip, InternalId, …).
          contextIdentifier: { type: 'Nip', value: nip },
        }),
        signal: opSignal,
      });
      const challengeData = (await challengeResponse.json()) as {
        challenge: string;
        timestampMs: number;
      };

      // Step 3: RSA-OAEP encrypt token + timestamp
      const rsaKey = createPublicKey(publicKeyData.publicKey);
      const plaintext = Buffer.from(`${token}|${challengeData.timestampMs}`);
      const encrypted = publicEncrypt(
        {
          key: rsaKey,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        plaintext,
      );

      // Step 4: Redeem encrypted token
      const redeemResponse = await this.fetchWithRetry(`${this.baseUrl}/auth/token/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge: challengeData.challenge,
          encryptedToken: encrypted.toString('base64'),
        }),
        signal: opSignal,
      });
      const redeemData = (await redeemResponse.json()) as {
        jwt: string;
        referenceNumber: string;
        encryptionKey?: string;
      };

      // Step 5: Poll for session readiness. The polling loop honours the
      // composite signal (caller cancel + wall-clock guard) so it cannot
      // outlive the deadline.
      let ready = false;
      for (let i = 0; i < 30; i++) {
        if (opSignal.aborted) break;
        const statusResponse = await this.fetchWithRetry(
          `${this.baseUrl}/auth/${redeemData.referenceNumber}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${redeemData.jwt}`,
            },
            signal: opSignal,
          },
        );
        const statusData = (await statusResponse.json()) as {
          status?: string;
          processingCode?: number;
        };

        if (statusData.status === 'READY' || statusData.processingCode === 200) {
          ready = true;
          break;
        }

        // Bail early if the wall-clock fired during the sleep.
        await KsefApiClient.abortableSleep(opSignal, 1000);
      }

      if (!ready) {
        throw new Error(
          `KSeF session did not become ready within ${AUTH_POLL_WALL_CLOCK_MS / 1000}s (ref: ${redeemData.referenceNumber})`,
        );
      }

      const encryptionKey = redeemData.encryptionKey
        ? Buffer.from(redeemData.encryptionKey, 'base64')
        : Buffer.alloc(32);

      this.session = {
        jwt: redeemData.jwt,
        referenceNumber: redeemData.referenceNumber,
        encryptionKey,
      };

      return this.session;
    } finally {
      cleanup();
    }
  }

  /**
   * Authenticates with KSeF using a qualified electronic certificate (XAdES).
   *
   * Not implemented — token auth is the primary and supported path.
   * Certificate auth requires XAdES XML signing with a .p12 private key,
   * which is deferred to a future milestone if needed.
   */
  async authenticateWithCertificate(
    _certificateBase64: string,
    _password: string | undefined,
    _nip: string,
  ): Promise<KsefSession> {
    throw new Error(
      'Certificate-based KSeF authentication is not supported. Use token-based auth.',
    );
  }

  // -------------------------------------------------------------------------
  // Invoice Operations
  // -------------------------------------------------------------------------

  /**
   * Queries KSeF for invoices matching the given NIP and date range.
   *
   * Starts an async query, polls for completion, and returns metadata list.
   * The query uses "subject2" subjectType (buyer perspective).
   */
  async queryInvoices(
    nip: string,
    dateFrom: string,
    dateTo: string,
    signal?: AbortSignal,
  ): Promise<KsefQueryResult> {
    this.requireSession();

    // Bound the polling wall-clock — without it, the loop can legitimately
    // run for >2min on a hung KSeF endpoint and pin a Render request handler
    // past the platform timeout.
    const { opSignal, cleanup } = KsefApiClient.composeWallClockSignal(
      signal,
      QUERY_POLL_WALL_CLOCK_MS,
      'KSeF queryInvoices: wall-clock exceeded',
    );

    try {
      // Start query
      const queryStartResponse = await this.fetchWithRetry(
        `${this.baseUrl}/invoices/query/metadata`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session?.jwt}`,
          },
          body: JSON.stringify({
            queryCriteria: {
              subjectNip: nip,
              invoicingDateFrom: dateFrom,
              invoicingDateTo: dateTo,
              subjectType: 'subject2',
            },
          }),
          signal: opSignal,
        },
      );
      const queryStartData = (await queryStartResponse.json()) as {
        queryId: string;
      };

      // Poll for query completion under the same wall-clock guard.
      let queryResult: KsefQueryResult | null = null;
      for (let i = 0; i < 60; i++) {
        if (opSignal.aborted) break;
        const statusResponse = await this.fetchWithRetry(
          `${this.baseUrl}/invoices/query/${queryStartData.queryId}/status`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session?.jwt}`,
            },
            signal: opSignal,
          },
        );
        const statusData = (await statusResponse.json()) as {
          status?: string;
          processingCode?: number;
          invoiceMetadataList?: KsefInvoiceMetadata[];
          hasMore?: boolean;
          pageToken?: string;
        };

        if (statusData.status === 'COMPLETED' || statusData.processingCode === 200) {
          queryResult = {
            invoiceMetadataList: statusData.invoiceMetadataList ?? [],
            hasMore: statusData.hasMore ?? false,
            pageToken: statusData.pageToken,
          };
          break;
        }

        if (statusData.status === 'FAILED') {
          throw new Error(`KSeF query failed (queryId: ${queryStartData.queryId})`);
        }

        // Sleep that respects the wall-clock signal.
        await KsefApiClient.abortableSleep(opSignal, 2000);
      }

      if (!queryResult) {
        throw new Error(
          `KSeF query did not complete within ${QUERY_POLL_WALL_CLOCK_MS / 1000}s (queryId: ${queryStartData.queryId})`,
        );
      }

      return queryResult;
    } finally {
      cleanup();
    }
  }

  /**
   * Downloads a single invoice XML from KSeF by its reference number.
   *
   * If the response is AES-256 encrypted (indicated by content-type),
   * it will be decrypted using the session encryption key.
   */
  async downloadInvoiceXml(ksefReferenceNumber: string, signal?: AbortSignal): Promise<string> {
    this.requireSession();

    const response = await this.fetchWithRetry(
      `${this.baseUrl}/invoices/ksef/${ksefReferenceNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.session?.jwt}`,
        },
        signal,
      },
    );

    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/octet-stream')) {
      // AES-256 encrypted response — decrypt
      const encryptedBuffer = Buffer.from(await response.arrayBuffer());

      // First 12 bytes = IV, next = ciphertext, last 16 = auth tag
      const iv = encryptedBuffer.subarray(0, 12);
      const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
      const ciphertext = encryptedBuffer.subarray(12, encryptedBuffer.length - 16);

      const encryptionKey = this.session?.encryptionKey;
      if (!encryptionKey) {
        throw new Error('KSeF session encryption key is required to decrypt the response');
      }
      const decipher = createDecipheriv('aes-256-gcm', encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

      return decrypted.toString('utf-8');
    }

    return await response.text();
  }

  // -------------------------------------------------------------------------
  // Utility
  // -------------------------------------------------------------------------

  /**
   * Verifies KSeF credentials by attempting authentication.
   * Returns true if credentials are valid, false otherwise.
   * Used for credential verification in connection setup.
   */
  async verifyCredentials(token: string, nip: string): Promise<boolean> {
    try {
      await this.authenticate(token, nip);
      await this.terminateSession();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Terminates the active KSeF session.
   * Safe to call even if no session exists.
   */
  async terminateSession(): Promise<void> {
    if (!this.session) return;

    try {
      await this.fetchWithRetry(`${this.baseUrl}/auth/session/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.session.jwt}`,
        },
      });
    } finally {
      this.session = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  private requireSession(): void {
    if (!this.session) {
      throw new Error('KSeF session not established. Call authenticate() first.');
    }
  }

  /**
   * Calculate backoff delay for a given attempt, capped at 10 seconds.
   */
  private static backoffMs(attempt: number): number {
    return Math.min(1000 * 2 ** attempt, 10000);
  }

  /**
   * Determine retry delay for a failed HTTP response, or `null` if non-retryable.
   */
  private static retryDelayForResponse(
    response: Response,
    attempt: number,
    retries: number,
  ): number | null {
    if (response.status === 429 && attempt < retries) {
      const retryAfter = response.headers.get('retry-after');
      return retryAfter ? parseInt(retryAfter, 10) * 1000 : KsefApiClient.backoffMs(attempt);
    }
    if (response.status >= 500 && attempt < retries) {
      return KsefApiClient.backoffMs(attempt);
    }
    return null;
  }

  /**
   * Returns true if the error is a non-retryable KSeF API error that should be re-thrown.
   */
  private static isNonRetryableApiError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith('KSeF API error');
  }

  /**
   * Build a non-retryable API error from a failed HTTP response.
   */
  private static async buildApiError(response: Response): Promise<Error> {
    const errorBody = await response.text().catch(() => '');
    return new Error(`KSeF API error ${response.status}: ${errorBody || response.statusText}`);
  }

  /**
   * Normalize an unknown thrown value into an Error instance.
   */
  private static toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Execute a single fetch attempt: returns the response or decides to retry/throw.
   * Returns `null` when the caller should continue to the next attempt.
   *
   * Per-attempt wall-clock bound via `fetchWithTimeout`. Combined with the
   * polling loop's outer signal, a single hung KSeF call cannot outlast
   * `KSEF_PER_REQUEST_TIMEOUT_MS`, and the polling loop itself cannot
   * outlast its `*_POLL_WALL_CLOCK_MS` budget.
   */
  private async attemptFetch(
    url: string,
    options: RequestInit,
    attempt: number,
    retries: number,
  ): Promise<Response | null> {
    // The KSeF client owns the retry/backoff loop (see fetchWithRetry above
    // for 429 / 5xx handling) so we wrap each attempt in withResilience with
    // retryAttempts=0 — the breaker + per-process concurrency cap apply, but
    // we do not duplicate the inner retry logic.
    const response = await withResilience(
      () =>
        fetchWithTimeout(url, options, {
          timeoutMs: KSEF_PER_REQUEST_TIMEOUT_MS,
          retries: 0,
        }),
      { provider: 'ksef', retryAttempts: 0 },
    );

    if (response.ok) return response;

    const delayMs = KsefApiClient.retryDelayForResponse(response, attempt, retries);
    if (delayMs != null) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return null;
    }

    throw await KsefApiClient.buildApiError(response);
  }

  /**
   * Fetch wrapper with retry logic for transient errors.
   * - Retries on HTTP 429 (rate limit) with Retry-After backoff
   * - Retries on HTTP 5xx with exponential backoff
   * - Throws on 4xx (except 429)
   *
   * Idempotency: by default only GET/HEAD requests are retried. KSeF POSTs
   * such as `/auth/token/redeem` and `/invoices/query/metadata` are NOT
   * idempotent — re-issuing them after a 502/timeout can claim multiple
   * sessions or create duplicate query jobs. Callers that know their POST
   * is safe to retry can opt in via `retryNonIdempotent: true`.
   */
  /**
   * Resolve the effective retry count: GET/HEAD are idempotent and retried by
   * default; non-idempotent methods only retry when the caller opts in. A
   * numeric `opts` is the backwards-compat `retries` shorthand.
   */
  private static resolveEffectiveRetries(
    method: string,
    opts: { retries?: number; retryNonIdempotent?: boolean } | number,
  ): number {
    const { retries = 2, retryNonIdempotent = false } =
      typeof opts === 'number' ? { retries: opts } : opts;
    const upper = method.toUpperCase();
    const isIdempotent = upper === 'GET' || upper === 'HEAD';
    return isIdempotent || retryNonIdempotent ? retries : 0;
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    opts: { retries?: number; retryNonIdempotent?: boolean } | number = {},
  ): Promise<Response> {
    const effectiveRetries = KsefApiClient.resolveEffectiveRetries(options.method ?? 'GET', opts);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
      try {
        const result = await this.attemptFetch(url, options, attempt, effectiveRetries);
        if (result) return result;
      } catch (error) {
        if (KsefApiClient.isNonRetryableApiError(error)) throw error;
        lastError = KsefApiClient.toError(error);
        if (attempt < effectiveRetries) {
          await new Promise(resolve => setTimeout(resolve, KsefApiClient.backoffMs(attempt)));
        }
      }
    }

    throw lastError ?? new Error('KSeF API request failed after retries');
  }
}
