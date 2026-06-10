/**
 * Pino sinks for outbound HTTP integration events.
 *
 * The resilience layer (`packages/integrations/src/services/resilience.ts`)
 * already emits opossum's breaker state-transition events directly to Pino
 * (`open` / `halfOpen` / `close` / `reject`). What's missing — and what this
 * module supplies — are the per-call duration / status / retries lines for
 * outbound HTTP duration/status logging.
 *
 * Two sinks are exported:
 *
 *   - `logIntegrationCall(...)` — emit a single `info` (or `warn` for failure)
 *     line with `{ provider, durationMs, status, retries, outcome }`. Adapter
 *     call sites or the integration HTTP wrapper can call this manually after
 *     a fetch resolves; alternatively the resilience layer can subscribe to
 *     opossum's `success` / `failure` / `timeout` events and forward.
 *
 *   - `subscribeOpossumEvents(breaker, provider)` — convenience wrapper that
 *     attaches the standard listener set to a breaker instance (success ->
 *     info, failure / timeout -> warn). The resilience module is welcome to
 *     call this internally once it's ready to publish the event types.
 *
 * Kept in @contractor-ops/logger so it has zero dependency on the integrations
 * package — both directions of import would create a workspace cycle.
 */

import { createIntegrationLogger } from './index.js';

export type IntegrationCallOutcome = 'success' | 'failure' | 'timeout' | 'breaker_open';

export interface LogIntegrationCallParams {
  /** Canonical provider slug (e.g. 'jira', 'stripe', 'docusign'). */
  provider: string;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** HTTP status when known; -1 for "no response received" (DNS / connect error). */
  status?: number;
  /** Number of retry attempts consumed (0 = first try succeeded). */
  retries?: number;
  /** Outcome class for filtering / metrics. */
  outcome: IntegrationCallOutcome;
  /** Operation slug for trace correlation (e.g. 'invoice.create'). */
  operation?: string;
  /** Optional error reference when the call failed. */
  err?: unknown;
}

/**
 * Emits a structured Pino line for one outbound integration call. Routes
 * through the per-provider integration logger so service / provider / line
 * level all flow through a single Axiom dataset query.
 */
export function logIntegrationCall(params: LogIntegrationCallParams): void {
  const { provider, durationMs, status, retries, outcome, operation, err } = params;
  const log = createIntegrationLogger(provider);
  const fields: Record<string, unknown> = {
    durationMs,
    outcome,
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retries === 'number' ? { retries } : {}),
    ...(operation ? { operation } : {}),
  };

  if (outcome === 'success') {
    log.info(fields, 'integration call');
  } else {
    log.warn({ ...fields, ...(err ? { err } : {}) }, 'integration call failed');
  }
}

/**
 * Minimal opossum event emitter shape we depend on. Kept structural so we
 * don't have to import the full `CircuitBreaker` type (and pull in the
 * opossum dep graph) here.
 */
interface BreakerLike {
  on(event: 'success', listener: (result: unknown, latencyMs: number) => void): void;
  on(event: 'failure', listener: (err: Error, latencyMs: number) => void): void;
  on(event: 'timeout', listener: (err: Error, latencyMs: number) => void): void;
}

/**
 * Subscribe `success` / `failure` / `timeout` opossum events on the given
 * breaker, forwarding each to a structured Pino line via `logIntegrationCall`.
 *
 * Call once per breaker instance immediately after construction. The state
 * transitions (`open` / `halfOpen` / `close` / `reject`) are already wired
 * by the resilience module itself.
 */
export function subscribeOpossumEvents(breaker: BreakerLike, provider: string): void {
  breaker.on('success', (_result, latencyMs) => {
    logIntegrationCall({
      provider,
      durationMs: Math.round(latencyMs),
      outcome: 'success',
    });
  });
  breaker.on('failure', (err, latencyMs) => {
    logIntegrationCall({
      provider,
      durationMs: Math.round(latencyMs),
      outcome: 'failure',
      err,
    });
  });
  breaker.on('timeout', (err, latencyMs) => {
    logIntegrationCall({
      provider,
      durationMs: Math.round(latencyMs),
      outcome: 'timeout',
      err,
    });
  });
}
