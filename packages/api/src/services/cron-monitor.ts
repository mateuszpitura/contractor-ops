import { createCronLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';

/**
 * Cron job monitoring via Cronitor heartbeats + structured metrics.
 *
 * Cronitor API: https://cronitor.io/docs/heartbeat-api
 * Each cron job has a monitor key. On each run we ping:
 *   - `run`      — job started
 *   - `complete` — job finished successfully
 *   - `fail`     — job failed
 *
 * If CRONITOR_API_KEY is not set, all pings are silently skipped (dev-friendly).
 *
 * Beyond Cronitor heartbeats this module exposes two metric-emit primitives
 * (S3-5 · F-ASYNC-17):
 *   - `recordJobDuration(jobName, durationMs, opts)` — distribution metric
 *     for histogram-style "how long is each tick taking" charts.
 *   - `recordQueueDepth(queue, depth, opts)` — gauge for "how many items
 *     are waiting" (outbox pending, webhook RECEIVED, peppol participants
 *     to scan, etc.).
 *
 * Plus two wrapper utilities that emit duration automatically so
 * QStash consumer routes (`_process` / `_sync` / `inbound` / `outbound` /
 * `poll` / `_drain` / `_render-claim-pdf`) and Bearer-secret cron routes
 * can instrument timing with one line.
 */

const log = createCronLogger('cron-monitor');

const CRONITOR_PING_URL = 'https://cronitor.link/p';

/** Cronitor monitor keys — mapped to cron route names. */
export const CronMonitors = {
  REMINDERS: 'reminders',
  TOKEN_REFRESH: 'token-refresh',
  TRIAL_NOTIFICATIONS: 'trial-notifications',
  JOB_HEALTH: 'job-health',
  // Phase 60 · CLASS-07 — daily economic-dependency scan (§2 SGB VI early warning).
  CLASSIFICATION_ECONOMIC_DEPENDENCY: 'classification-economic-dependency',
  // Phase 60 · CLASS-08 — daily IR35 reassessment trigger scan (audit-log driven).
  CLASSIFICATION_REASSESSMENT_TRIGGERS: 'classification-reassessment-triggers',
  // Phase 63 · Plan 03 — daily Bank of England base rate polling (LPCDA §4(1)).
  BOE_RATE_POLL: 'boe-rate-poll',
  LATE_INTEREST_PDF_REAPER: 'late-interest-pdf-reaper',
  // GDPR-driven nightly purge of OAuth challenge records and expired pending uploads.
  DATA_PURGE: 'data-purge',
  // Daily ECB FX-rate sync across regional databases.
  EXCHANGE_RATES: 'exchange-rates',
  // Nightly Jira / Linear → Organization > Projects sync (one run / connection / 24h).
  ORG_DEFINITION_SYNC: 'org-definition-sync',
} as const;

export type CronMonitorKey = (typeof CronMonitors)[keyof typeof CronMonitors];

type PingState = 'run' | 'complete' | 'fail';

/**
 * Send a heartbeat ping to Cronitor. Fire-and-forget — never throws.
 */
async function ping(monitorKey: string, state: PingState, message?: string): Promise<void> {
  const apiKey = getServerEnv().CRONITOR_API_KEY;
  if (!apiKey) return;

  const url = new URL(`${CRONITOR_PING_URL}/${apiKey}/${monitorKey}`);
  url.searchParams.set('state', state);
  if (message) {
    url.searchParams.set('msg', message.slice(0, 2000));
  }

  try {
    // resilience: raw-fetch-OK reason=best-effort cron heartbeat to Cronitor; failures are swallowed below and the call already carries an AbortSignal.timeout(5000) wall-clock bound, so wrapping in fetchWithTimeout would add no value.
    await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    // safe-swallow: pre-existing — see goals/production-hardening/ phase B.7.b
  } catch {
    // Monitoring failure should never break the cron job itself
  }
}

/**
 * Wraps a cron job handler with Cronitor heartbeat pings.
 *
 * Usage:
 * ```ts
 * const result = await withCronMonitor("reminders", async () => {
 *   // ... cron logic ...
 *   return { processed: 5, sent: 3 };
 * });
 * ```
 */
export async function withCronMonitor<T>(
  monitorKey: CronMonitorKey,
  fn: () => Promise<T>,
): Promise<T> {
  await ping(monitorKey, 'run');
  const start = performance.now();

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    // S3-5 · F-ASYNC-17: emit a duration metric next to the heartbeat so
    // ops dashboards can chart per-job histogram without depending on
    // Cronitor's external UI.
    recordJobDuration(monitorKey, durationMs, { outcome: 'ok' });
    const message =
      typeof result === 'object' && result !== null ? JSON.stringify(result) : String(result);
    await ping(monitorKey, 'complete', message);
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    recordJobDuration(monitorKey, durationMs, { outcome: 'error' });
    const message = error instanceof Error ? error.message : 'Unknown error';
    await ping(monitorKey, 'fail', message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Job duration / queue-depth metrics — S3-5 · F-ASYNC-17
// ---------------------------------------------------------------------------
//
// Pre-fix (audit findings 04-async.md F-ASYNC-17):
//   - Cron jobs only fired Cronitor heartbeats — no per-job duration
//     histogram visible in Sentry/Axiom.
//   - QStash consumer routes (_process / _sync / inbound / outbound /
//     poll / _drain / _render-claim-pdf) emitted no timing metric at all.
//   - Job-health route counted webhook PENDING but no other queues
//     (outbox, peppol participants, ksef sync, ocr backlog).
//
// Post-fix:
//   - Two metric primitives that any consumer can call.
//   - One `withQueueObservability(jobName, fn)` wrapper for QStash
//     consumer routes that auto-emits duration + outcome counter.
//   - Producers (e.g. outbox drain) emit `recordQueueDepth` against the
//     pending count BEFORE dispatch so dashboards see queue lag.
//
// These all funnel through `@contractor-ops/logger/metrics`, which
// publishes both Sentry span attributes and structured Pino log lines so
// Axiom queries like `metric:queue.depth queue:outbox` work out of the
// box.

/**
 * Outcome label for job runs — informs dashboards whether a slow tick was
 * a slow happy-path or a slow error path.
 */
export type JobOutcome = 'ok' | 'error' | 'permanent-failure' | 'transient-failure';

/**
 * Records a per-job duration distribution metric (i.e. histogram input).
 *
 * Tag conventions:
 *   - `job` — short logical name (e.g. `outbox-drain`, `ksef-sync`,
 *     `webhooks-process`). Keep the name STABLE; renaming it breaks
 *     dashboards.
 *   - `outcome` — one of `JobOutcome` so charts can split happy vs sad.
 *
 * Cardinality note: do NOT include organizationId or other high-cardinality
 * fields in tags — Sentry / metrics backends penalise that. Keep it to
 * job + outcome (+ optional `phase` for multi-stage jobs).
 */
export function recordJobDuration(
  jobName: string,
  durationMs: number,
  opts: { outcome?: JobOutcome; phase?: string } = {},
): void {
  const tags: Record<string, string> = { job: jobName, outcome: opts.outcome ?? 'ok' };
  if (opts.phase) tags.phase = opts.phase;
  metrics.distribution('job.duration', durationMs, {
    unit: 'millisecond',
    tags,
  });
}

/**
 * Records the depth (item count) of a logical queue at the moment of
 * observation. Use for outbox PENDING count, webhook RECEIVED count,
 * peppol participants pending poll, ocr extractions stuck PROCESSING,
 * etc.
 *
 * `queue` is the canonical queue name (stable; e.g. `outbox`, `webhook`,
 * `peppol-poll`). Pair this with the existing `metrics.gauge` calls in
 * `cron/job-health` so a single Axiom query can chart queue depth across
 * all named queues with `metric:queue.depth | summarize by queue`.
 */
export function recordQueueDepth(
  queue: string,
  depth: number,
  opts: { phase?: string } = {},
): void {
  const tags: Record<string, string> = { queue };
  if (opts.phase) tags.phase = opts.phase;
  metrics.gauge('queue.depth', depth, tags);
}

/**
 * Wraps a QStash consumer / cron handler with timing + outcome metrics.
 *
 * Use from QStash consumer routes (`_process` / `_sync` / `_drain` etc.)
 * where the route handler already owns its own try/catch and returns a
 * NextResponse — this helper does not interfere with status-code
 * mapping. It only measures wall-clock and emits a single
 * `job.duration` distribution + `job.runs` counter per call.
 *
 * Outcome:
 *   - `ok` if the handler resolved without throwing.
 *   - `error` if it threw — the original error is re-thrown so QStash
 *     gets its 5xx → retry behaviour from the caller's existing code.
 *
 * This wrapper does NOT call Cronitor; it's strictly metrics. Cronitor
 * heartbeats remain a Bearer-secret cron concern via `withCronMonitor`.
 */
export async function withQueueObservability<T>(jobName: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);
    recordJobDuration(jobName, durationMs, { outcome: 'ok' });
    metrics.increment('job.runs', 1, { job: jobName, outcome: 'ok' });
    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    recordJobDuration(jobName, durationMs, { outcome: 'error' });
    metrics.increment('job.runs', 1, { job: jobName, outcome: 'error' });
    log.warn(
      { err: error, job: jobName, durationMs },
      'queue handler threw — metric emitted, rethrowing',
    );
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Backpressure queue-depth reader — S3-4 · F-SCALE-19
// ---------------------------------------------------------------------------
//
// `qstash-backpressure.ts` owns the per-route Redis semaphore counters.
// This reader thin-wraps `getAllQueueDepths()` so the cron-monitor barrel
// stays the single canonical source of "queue observability snapshots"
// for the job-health route and the /api/health backpressure probe.
//
// Returning a typed snapshot (instead of re-exporting the function) lets
// us emit a `recordQueueDepth` gauge per route in one place — every poll
// of this snapshot updates the dashboards without each caller remembering
// to do it.

export interface QueueDepthSnapshotEntry {
  /** Stable route key (e.g. `ocr-process`). */
  routeKey: string;
  /** Currently in-flight slot count (cluster-wide). */
  depth: number;
  /** Configured concurrency cap for the route. */
  max: number;
  /** Health-fail threshold — `Math.floor(max * 1.5)` per design. */
  threshold: number;
  /** True iff `depth > threshold`. */
  saturated: boolean;
}

/**
 * Reads the cluster-wide depth for every backpressure-wired route and
 * emits a `queue.depth` gauge per route as a side-effect.
 *
 * Health probe usage:
 * ```ts
 * const snap = await getQueueDepthSnapshot();
 * const saturated = snap.filter(r => r.saturated);
 * return saturated.length === 0 ? ok() : fail(saturated);
 * ```
 */
export async function getQueueDepthSnapshot(): Promise<QueueDepthSnapshotEntry[]> {
  // Lazy-imported to keep the cron-monitor module free of the
  // qstash-backpressure module's @sentry/nextjs dep on cold-start paths
  // that only need duration helpers.
  const { getAllQueueDepths } = await import('./qstash-backpressure');
  const raw = await getAllQueueDepths();

  const entries: QueueDepthSnapshotEntry[] = Object.entries(raw).map(
    ([routeKey, { depth, max, threshold }]) => ({
      routeKey,
      depth,
      max,
      threshold,
      saturated: depth > threshold,
    }),
  );

  // Emit a gauge per route so Axiom queries
  // `metric:queue.depth queue:backpressure-<route>` chart cluster-wide
  // pressure with the same shape as the outbox / webhook depth gauges.
  for (const entry of entries) {
    recordQueueDepth(`backpressure-${entry.routeKey}`, entry.depth);
  }

  return entries;
}
