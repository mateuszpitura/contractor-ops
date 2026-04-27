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

function exponentialBackoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 10_000);
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
