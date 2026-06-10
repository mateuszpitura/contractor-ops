// ---------------------------------------------------------------------------
// Per-provider resilience configuration table
// ---------------------------------------------------------------------------
//
// One row per outbound provider, tuned to its known failure modes and rate
// limits. Used by `withResilience` (resilience.ts) which composes a per-process
// circuit breaker (opossum), retry-with-jitter loop (p-retry), and concurrency
// limiter (p-limit) keyed by `provider`.
//
// When adding a new provider:
//  1. Pick `failureThreshold` based on how chatty the upstream is — a busy
//     adapter (calendar fan-out) may need 10+ failures before tripping.
//  2. `openDelayMs` (cooldown) defaults to 30s. Set it to the provider's
//     observed recovery time when known (Stripe ~10s, KSeF maintenance ~5min).
//  3. `concurrencyLimit` defaults to 10. Slack outbound is the obvious case for
//     1 (per-channel limit elsewhere wraps this).
//  4. `timeoutMs` is the wall-clock per attempt. Match to the upstream's
//     documented p99, not p50. KSeF documents 60s for some endpoints.
//  5. We deliberately rely on Node's native `fetch` undici keep-alive defaults —
//     no per-call `Agent` is configured. The shared host pool is already
//     keep-alive'd, and per-provider Agents with custom keepAlive timing should
//     only be added if profiling shows TLS handshake on the hot path.

export interface ProviderResilienceConfig {
  /** Consecutive failures before opening the breaker. */
  failureThreshold: number;
  /** Probes allowed in half-open state before deciding open vs close. */
  halfOpenAttempts: number;
  /** Time the breaker stays open before transitioning to half-open. */
  openDelayMs: number;
  /** Number of retry attempts after the first call (excludes the initial try). */
  retryAttempts: number;
  /** Max in-flight calls allowed per process for this provider (bulkhead). */
  concurrencyLimit: number;
  /** Per-attempt wall-clock timeout in ms (forwarded to opossum's `timeout`). */
  timeoutMs: number;
}

/**
 * Sensible defaults applied when a provider is not in the explicit table.
 *
 * Tuning notes:
 *  - 5 failures / 30s open is the canonical Hystrix-era default.
 *  - 2 retries with full jitter handles the "single 5xx blip" case without
 *    amplifying load during a sustained outage (the breaker handles that).
 *  - 10 concurrency per process protects the upstream from a sudden burst
 *    while still letting cron jobs make forward progress.
 */
export const DEFAULT_RESILIENCE_CONFIG: ProviderResilienceConfig = {
  failureThreshold: 5,
  halfOpenAttempts: 1,
  openDelayMs: 30_000,
  retryAttempts: 2,
  concurrencyLimit: 10,
  timeoutMs: 30_000,
};

/**
 * Per-provider overrides keyed by the canonical provider slug used at
 * `withResilience` call sites. Use lowercase, hyphenated, matching the
 * adapter `slug` where possible.
 */
export const PROVIDER_RESILIENCE_CONFIG: Readonly<
  Record<string, Partial<ProviderResilienceConfig>>
> = {
  // ---- e-sign / contracts -----------------------------------------------
  // DocuSign signed-document downloads can be large PDFs over slow links —
  // give the body read more headroom. Three retries because the SDK does not
  // distinguish between transient connect resets and permanent failures.
  docusign: {
    timeoutMs: 60_000,
    retryAttempts: 3,
    concurrencyLimit: 5,
  },
  autenti: {
    timeoutMs: 60_000,
    retryAttempts: 3,
    concurrencyLimit: 5,
  },

  // ---- LLM / OCR --------------------------------------------------------
  // Anthropic SDK auto-retries internally; we still wrap to enforce a
  // hard wall-clock and trip the breaker on sustained 5xx. 90s matches the
  // SDK constructor recommendation so we don't undercut a single in-flight
  // generation.
  anthropic: {
    timeoutMs: 90_000,
    retryAttempts: 1,
    concurrencyLimit: 4,
  },

  // ---- billing / payments ----------------------------------------------
  // Stripe SDK has its own retry + timeout. Concurrency cap is the main lever
  // here — burst bulk-update of subscriptions can hit Stripe's 100 req/sec.
  stripe: {
    timeoutMs: 30_000,
    retryAttempts: 2,
    concurrencyLimit: 8,
  },

  // ---- e-invoicing -----------------------------------------------------
  storecove: {
    timeoutMs: 30_000,
    retryAttempts: 2,
    concurrencyLimit: 8,
  },
  // KSeF runs polling loops that internally retry; outer breaker just
  // protects the call site from an extended maintenance window.
  ksef: {
    timeoutMs: 30_000,
    retryAttempts: 2,
    concurrencyLimit: 4,
    openDelayMs: 60_000,
  },

  // ---- transactional email --------------------------------------------
  resend: {
    timeoutMs: 15_000,
    retryAttempts: 3,
    concurrencyLimit: 10,
  },

  // ---- couriers --------------------------------------------------------
  inpost: {
    timeoutMs: 30_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },

  // ---- collaboration / project mgmt -----------------------------------
  // Slack outbound is rate-limited per channel (1 req/sec). The 1-per-channel
  // limit is enforced by callers; this cap protects shared workspace endpoints
  // (auth.test, conversations.list).
  slack: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 3,
  },
  jira: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },
  linear: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },
  notion: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },
  confluence: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },

  // ---- calendar / directory --------------------------------------------
  'google-calendar': {
    timeoutMs: 15_000,
    retryAttempts: 2,
    // Calendar fan-out: callers use p-limit(5) on top of this — the breaker
    // should still allow burst writes from a single tRPC call.
    concurrencyLimit: 10,
  },
  'google-workspace': {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },
  'outlook-calendar': {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 10,
  },
  'microsoft-teams': {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },

  // ---- time tracking ---------------------------------------------------
  clockify: {
    timeoutMs: 15_000,
    retryAttempts: 2,
    concurrencyLimit: 5,
  },
};

/**
 * Resolve the effective config for a given provider slug. Unknown providers
 * fall back to defaults — this lets new adapters opt into resilience without
 * requiring a config change first.
 */
export function getResilienceConfig(provider: string): ProviderResilienceConfig {
  const overrides = PROVIDER_RESILIENCE_CONFIG[provider] ?? {};
  return {
    ...DEFAULT_RESILIENCE_CONFIG,
    ...overrides,
  };
}
