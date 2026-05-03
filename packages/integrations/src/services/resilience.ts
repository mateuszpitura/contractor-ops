// ---------------------------------------------------------------------------
// Resilience composition: circuit breaker + retry + concurrency limiter
// ---------------------------------------------------------------------------
//
// This module wires together three independent reliability primitives —
// `opossum` (circuit breaker), `p-retry` (exponential backoff with jitter),
// and `p-limit` (per-provider concurrency cap / bulkhead) — into a single
// `withResilience` helper. Adapter call sites wrap their outbound calls in
// `withResilience(() => fetchWithTimeout(…), { provider: 'jira' })` and the
// helper applies the per-provider config from `resilience-config.ts`.
//
// Design notes
// ============
//   - Per-provider state lives in module-scoped Maps. Each provider gets ONE
//     `CircuitBreaker` instance and ONE `pLimit` instance reused across calls,
//     so the breaker can observe failures and the limiter can enforce caps
//     across the whole process.
//   - We compose order is: `breaker.fire(() => limit(() => pRetry(call)))`.
//     The breaker sits outermost so it sees a single fire-and-resolve per
//     logical call (regardless of how many internal retries happened); the
//     limiter sits in the middle to bound concurrent calls + retries; the
//     retry loop is innermost so each retry contributes to the breaker's
//     statistical window only as a single failure if all retries are
//     exhausted.
//   - State is per-process. Cold starts pay a few extra retries while the
//     breaker rebuilds its picture; that's cheaper than a Redis round-trip on
//     every outbound call (per F-INT-05 settled decision). If we ever need
//     cross-instance coordination, the breaker exposes events that can be
//     piped to Redis.
//   - Connection reuse (F-INT-22): we deliberately do NOT configure a custom
//     undici `Agent` here. Node 20+ native `fetch` keep-alives by default at
//     the global pool level, which is sufficient until profiling shows TLS
//     handshakes on the critical path. Adapters that previously instantiated
//     per-call `axios`/`fetch` wrappers should hoist them to module scope.
//
// Observability hooks
// ===================
//   - All circuit-breaker state transitions are logged via the integration
//     logger (Pino) so on-call can see a tripped breaker in real time.
//   - This file does NOT emit per-request entry/exit logs — that lives in
//     `fetch-helpers.ts` (P2-E will hook the global request logger there).

import { createIntegrationLogger } from '@contractor-ops/logger';
import CircuitBreaker from 'opossum';
import pLimit, { type LimitFunction } from 'p-limit';
import pRetry, { AbortError } from 'p-retry';
import { isRetryableError } from './fetch-helpers.js';
import type { ProviderResilienceConfig } from './resilience-config.js';
import { getResilienceConfig } from './resilience-config.js';

// ---------------------------------------------------------------------------
// Per-provider state (module-scoped Maps)
// ---------------------------------------------------------------------------

/**
 * Reused per-provider breaker. Created lazily on first call so adapters that
 * are never exercised in a given process don't allocate timers.
 */
type ResilienceCall = (...args: unknown[]) => Promise<unknown>;
const breakers = new Map<string, CircuitBreaker<unknown[], unknown>>();
const limiters = new Map<string, LimitFunction>();

/**
 * Reset all per-provider state. Intended for tests only — production code
 * relies on the module-scoped instances.
 */
export function resetResilienceForTests(): void {
  for (const breaker of breakers.values()) {
    breaker.shutdown();
  }
  breakers.clear();
  limiters.clear();
}

function getLimiter(provider: string, config: ProviderResilienceConfig): LimitFunction {
  let limit = limiters.get(provider);
  if (!limit) {
    limit = pLimit(config.concurrencyLimit);
    limiters.set(provider, limit);
  }
  return limit;
}

function getBreaker(
  provider: string,
  config: ProviderResilienceConfig,
): CircuitBreaker<unknown[], unknown> {
  let breaker = breakers.get(provider);
  if (breaker) return breaker;

  const log = createIntegrationLogger(provider);

  // The action passed to opossum is identity — we just want the breaker to
  // observe success / failure of the inner call. Composition with p-retry +
  // p-limit happens in `withResilience` itself; the breaker's job is purely
  // to flip state and short-circuit when the upstream is consistently failing.
  const action: ResilienceCall = call => (call as () => Promise<unknown>)();

  breaker = new CircuitBreaker<unknown[], unknown>(action, {
    timeout: config.timeoutMs,
    // Map "N consecutive failures" semantics onto opossum's volume + threshold.
    // opossum's threshold is a percentage over the rolling window; we set the
    // volume to the configured failure threshold and require ~100% failures
    // to trip, which is the closest analogue.
    volumeThreshold: config.failureThreshold,
    errorThresholdPercentage: 50,
    resetTimeout: config.openDelayMs,
    name: provider,
    rollingCountTimeout: 10_000,
    rollingCountBuckets: 10,
    // Don't let HTTP 4xx (other than 408/429) flip the breaker — those are
    // permanent client errors and should not affect upstream-health stats.
    errorFilter: (err: unknown) => !isRetryableError(err),
  });

  // Pino logging on state transitions — keeps the breaker's signal off the
  // hot success path while making outage starts/recoveries observable.
  breaker.on('open', () => {
    log.warn(
      { provider, event: 'circuit_breaker.open' },
      'circuit breaker opened — short-circuiting upstream calls',
    );
  });
  breaker.on('halfOpen', () => {
    log.info(
      { provider, event: 'circuit_breaker.half_open' },
      'circuit breaker half-open — probing upstream recovery',
    );
  });
  breaker.on('close', () => {
    log.info(
      { provider, event: 'circuit_breaker.close' },
      'circuit breaker closed — upstream recovered',
    );
  });
  breaker.on('reject', () => {
    log.debug({ provider, event: 'circuit_breaker.reject' }, 'call rejected: breaker open');
  });

  breakers.set(provider, breaker);
  return breaker;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface WithResilienceOptions {
  /**
   * Canonical provider slug (e.g. 'stripe', 'docusign'). Maps to per-provider
   * config in `resilience-config.ts`. Unknown slugs fall back to defaults.
   */
  provider: string;
  /**
   * Optional server-derived idempotency key surfaced for logging / breaker
   * grouping. NEVER pass through client-supplied values — derive at the call
   * site via `sha256(`${orgId}:${businessKey}:${operation}`).slice(0, 32)`.
   */
  idempotencyKey?: string;
  /**
   * Optional per-call override for retry attempts. Most call sites should NOT
   * override and instead update `resilience-config.ts`.
   */
  retryAttempts?: number;
  /**
   * Optional AbortSignal — when aborted, in-flight retries unwind via p-retry's
   * AbortError mechanism. The breaker still observes the abort as a failure.
   */
  signal?: AbortSignal;
}

/**
 * Wrap an outbound call in the full resilience stack:
 *
 *   breaker.fire(() => limit(() => pRetry(call, …)))
 *
 * - `breaker` is the per-provider opossum CircuitBreaker (per-process Map).
 * - `limit` is the per-provider p-limit concurrency cap.
 * - `pRetry` runs the call up to `retryAttempts + 1` times with exponential
 *   backoff + full jitter (AWS pattern), only retrying when
 *   `isRetryableError` returns true.
 *
 * The supplied `call` is invoked from inside the retry loop and must return
 * a Promise. Throw a plain `Error` (or any classifiable error) to fail; the
 * helper handles retries vs. permanent failures via `isRetryableError`.
 *
 * @example
 *   const data = await withResilience(
 *     () => fetchWithTimeout(url, init, { timeoutMs: 30_000 }),
 *     { provider: 'jira' },
 *   );
 */
export async function withResilience<T>(
  call: () => Promise<T>,
  opts: WithResilienceOptions,
): Promise<T> {
  const config = getResilienceConfig(opts.provider);
  const limit = getLimiter(opts.provider, config);
  const breaker = getBreaker(opts.provider, config);

  const retries = opts.retryAttempts ?? config.retryAttempts;

  // Inner: retry with full jitter (p-retry uses random factor + minTimeout).
  // Wrap non-retryable errors in `AbortError` to break out of the retry loop
  // immediately — opossum's `errorFilter` will then skip them as well.
  const inner = async (): Promise<T> => {
    return pRetry(
      async () => {
        try {
          return await call();
        } catch (err) {
          if (!isRetryableError(err)) {
            // p-retry recognises AbortError and stops retrying immediately.
            throw new AbortError(err instanceof Error ? err : new Error(String(err)));
          }
          throw err;
        }
      },
      {
        retries,
        factor: 2,
        randomize: true,
        minTimeout: 500,
        maxTimeout: 30_000,
        signal: opts.signal,
      },
    );
  };

  // Middle: limit concurrent in-flight calls per provider.
  const limited = (): Promise<T> => limit(inner);

  // Outer: breaker. We pass `limited` as the first argument so the breaker's
  // statistical window observes one fire per logical call (not per inner
  // retry).
  return breaker.fire(limited as unknown as (...args: unknown[]) => Promise<unknown>) as Promise<T>;
}
