// ---------------------------------------------------------------------------
// Shared HTTP fetch helpers
// ---------------------------------------------------------------------------
//
// All adapters and provider-API clients in this package previously rolled
// their own ad-hoc timeout/retry logic. Inconsistent semantics made on-call
// debugging harder and several OAuth fetches had no timeout at all,
// leaving them able to hang serverless functions until the platform-level
// timeout fired.
//
// `fetchWithTimeout` provides one consistent contract:
//  - Bounded wall-clock duration via `AbortController`
//  - Optional retry on retriable HTTP statuses (default: 429, 5xx) for
//    GET/HEAD only — non-idempotent methods MUST opt in explicitly via
//    `retryNonIdempotent`
//  - The body read is performed by the caller, so use the helper for the
//    initial response and read `response.text()` / `arrayBuffer()` from
//    within the same try/finally if you want the timeout to bound the body
//    read too. (The poller demonstrates the pattern.)

import { clearTimeout as clearTimeoutImpl, setTimeout as setTimeoutImpl } from 'node:timers';

/** Default network timeout for OAuth and provider-API fetches. */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export interface FetchWithTimeoutOptions {
  /** Hard wall-clock timeout in milliseconds. Default: 15_000. */
  timeoutMs?: number;
  /** Number of additional retry attempts after the first request. Default: 0. */
  retries?: number;
  /**
   * HTTP status codes that should trigger a retry (when retries > 0).
   * Default: [429, 502, 503, 504].
   */
  retryOn?: readonly number[];
  /**
   * Allow retrying non-idempotent methods (POST/PATCH/DELETE). Default false.
   * Most OAuth token-redemption POSTs are NOT idempotent — replaying them
   * after a 502 can claim multiple sessions or invalidate the refresh token.
   */
  retryNonIdempotent?: boolean;
  /**
   * Optional fetcher override (for tests). Defaults to the global `fetch`.
   */
  fetcher?: typeof fetch;
}

const DEFAULT_RETRY_STATUSES = [429, 502, 503, 504] as const;

/**
 * AWS-style "full jitter" exponential backoff.
 *
 * `random(0, min(base * 2^attempt, cap))` — the random multiplier prevents
 * the thundering-herd recovery storm that `min(base * 2^attempt, cap)`
 * causes when many connections trip at once. Cap at 30s.
 *
 * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
function exponentialBackoffMs(attempt: number): number {
  const cap = 30_000;
  const ceiling = Math.min(1000 * 2 ** attempt, cap);
  return Math.floor(Math.random() * ceiling);
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Status codes that indicate a transient failure worth retrying.
 *
 * 408 (Request Timeout) and 429 (Too Many Requests) are 4xx codes the server
 * has explicitly told us are retryable. Everything else in the 4xx range is
 * a permanent client error and should NOT be retried.
 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Node's network-level error codes that always indicate a transient failure.
 */
const RETRYABLE_ERROR_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

/**
 * Shape we look for on a Response-like value to extract the HTTP status. Used
 * by `isRetryableError` so callers can throw either an `Error` or a plain
 * object with a `status` field (some SDKs do the latter).
 */
interface MaybeStatusBearing {
  status?: number;
  statusCode?: number;
  response?: { status?: number; statusCode?: number };
}

/**
 * Best-effort retryable-error classifier.
 *
 * Returns `true` when the error indicates a transient upstream condition —
 * network blip, 5xx, 408, 429, AbortError on timeout. Returns `false` for
 * permanent client-side mistakes (4xx other than 408/429), TypeError on body
 * read (malformed response), and unknown error shapes (fail-closed: a real
 * 4xx that we mis-classified would just retry until breaker trip; a real
 * permanent error that we DON'T retry surfaces faster).
 *
 * Used by:
 *  - `withResilience` to decide whether p-retry should retry or short-circuit
 *    via AbortError.
 *  - opossum's `errorFilter` so 4xx don't pollute the breaker's window.
 */
export function isRetryableError(err: unknown): boolean {
  if (err == null) return false;

  // Direct Response: check status.
  if (typeof Response !== 'undefined' && err instanceof Response) {
    return RETRYABLE_STATUS_CODES.has(err.status);
  }

  if (err instanceof TypeError) {
    // TypeError from fetch typically means a real network/transport failure
    // (DNS, TLS, connection reset). Body-read TypeErrors (malformed JSON
    // surface as SyntaxError, not TypeError) are also network-adjacent.
    return true;
  }

  // AbortError from fetch on timeout — retry the next attempt.
  if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
    return true;
  }

  // Node.js network error codes.
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    if (code && RETRYABLE_ERROR_CODES.has(code)) return true;
    // undici nests the cause; check it as well.
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause && cause !== err) {
      const causeCode = (cause as { code?: string }).code;
      if (causeCode && RETRYABLE_ERROR_CODES.has(causeCode)) return true;
    }
  }

  // Object/Error with a `status` field (common SDK shape).
  const bearer = err as MaybeStatusBearing;
  const status =
    bearer.status ?? bearer.statusCode ?? bearer.response?.status ?? bearer.response?.statusCode;
  if (typeof status === 'number') {
    return RETRYABLE_STATUS_CODES.has(status);
  }

  return false;
}

/**
 * Fetch with abort-based timeout and optional retry-on-status.
 *
 * The body of the returned response is NOT read here — the caller is
 * responsible for `await response.text()` / `arrayBuffer()`. To bound the
 * body read time as well, use the helper inside an outer try/finally that
 * wraps both the fetch and the body read with the same `clearTimeout`.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  opts: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    retries = 0,
    retryOn = DEFAULT_RETRY_STATUSES,
    retryNonIdempotent = false,
    fetcher = fetch,
  } = opts;

  const method = (init.method ?? 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const effectiveRetries = isIdempotent || retryNonIdempotent ? retries : 0;

  let lastError: unknown;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt <= effectiveRetries; attempt++) {
    const controller = new AbortController();
    // If the caller passed their own signal, abort our controller when it fires.
    const callerSignal = init.signal ?? null;
    const onCallerAbort = callerSignal ? () => controller.abort(callerSignal.reason) : null;
    if (callerSignal && onCallerAbort) {
      if (callerSignal.aborted) controller.abort(callerSignal.reason);
      else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }

    const timer = setTimeoutImpl(() => controller.abort(), timeoutMs);

    try {
      const response = await fetcher(url, { ...init, signal: controller.signal });

      if (response.ok) return response;

      const shouldRetry = attempt < effectiveRetries && retryOn.includes(response.status);

      if (!shouldRetry) return response;

      lastResponse = response;

      // Honor Retry-After when the server sent it.
      const retryAfter = response.headers.get('retry-after');
      const delayMs = retryAfter
        ? Math.max(0, parseInt(retryAfter, 10) * 1000) || exponentialBackoffMs(attempt)
        : exponentialBackoffMs(attempt);
      await new Promise(resolve => setTimeoutImpl(resolve, delayMs));
    } catch (err) {
      lastError = err;
      if (attempt >= effectiveRetries) throw err;
      await new Promise(resolve => setTimeoutImpl(resolve, exponentialBackoffMs(attempt)));
    } finally {
      clearTimeoutImpl(timer);
      if (callerSignal && onCallerAbort) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError ?? new Error('fetchWithTimeout: request failed without a response');
}

// ---------------------------------------------------------------------------
// Body-bound JSON fetcher
// ---------------------------------------------------------------------------

/**
 * Fetch + parse JSON with the body read bounded by the SAME timeout as the
 * fetch itself. The vanilla pattern `const r = await fetchWithTimeout(...);
 * const j = await r.json();` lets the body read run unbounded after the
 * abort timer has fired (slow PDF body reads from DocuSign / Autenti can hang
 * callbacks this way).
 *
 * Implementation: thread the same caller AbortSignal — or create a fresh one
 * scoped to the full operation — through both the fetch and the JSON parse.
 * On non-2xx, throws an Error carrying `status` so `isRetryableError` can
 * classify it correctly without the caller manually reading the body.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  init: RequestInit = {},
  opts: FetchWithTimeoutOptions = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const callerSignal = init.signal ?? null;
  const onCallerAbort = callerSignal ? () => controller.abort(callerSignal.reason) : null;
  if (callerSignal && onCallerAbort) {
    if (callerSignal.aborted) controller.abort(callerSignal.reason);
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  const timer = setTimeoutImpl(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchWithTimeout(
      url,
      { ...init, signal: controller.signal },
      { ...opts, timeoutMs },
    );

    // Body read happens INSIDE the timer — a slow upstream body cannot
    // outlive the request timeout.
    const text = await response.text();

    if (!response.ok) {
      const err = new Error(
        `HTTP ${response.status} ${response.statusText} from ${url}: ${text.slice(0, 500)}`,
      ) as Error & { status: number; body: string };
      err.status = response.status;
      err.body = text;
      throw err;
    }

    if (text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  } finally {
    clearTimeoutImpl(timer);
    if (callerSignal && onCallerAbort) {
      callerSignal.removeEventListener('abort', onCallerAbort);
    }
  }
}
