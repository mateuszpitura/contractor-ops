/**
 * Per-route backpressure semaphore for QStash consumers (S3-4 · F-SCALE-19).
 *
 * Pre-fix: every QStash consumer route accepts unbounded concurrent
 * callbacks. After a transient outage QStash will replay hundreds of
 * deferred jobs at once; the receiving Render pods OOM long before the
 * downstream provider (Anthropic / Storecove / @react-pdf/renderer) hits
 * its own ceiling, and adjacent tRPC requests stall waiting for the same
 * Node thread pool.
 *
 * Post-fix: a tiny Redis-backed semaphore enforces a per-route concurrency
 * cap shared across the whole Render fleet. The fleet-wide invariant means
 * an 8-pod scale-out doesn't multiply the limit; the underlying provider
 * stays inside its own quota.
 *
 * Mechanism:
 *   - `qstash:backpressure:<routeKey>` is an INCR'd integer.
 *   - We claim a slot via a single atomic Lua EVAL that INCRs the key and
 *     conditionally sets EXPIRE only on the FIRST increment (when n == 1).
 *     Doing INCR + EXPIRE atomically prevents an OOM-killed worker from
 *     stranding a counter without a TTL. Setting EXPIRE only on the first
 *     INCR also stops a hot route from indefinitely re-arming the leak
 *     guard, so an orphan slot is reclaimed within `SAFETY_TTL_SEC`.
 *   - If the post-INCR value exceeds `maxConcurrent`, we return a 429 with
 *     `Retry-After: 5` so QStash backs off and retries.
 *   - The slot is always DECR'd in `finally`, even on rejection.
 *
 * Observability:
 *   - Each rejection emits a `metrics.increment('backpressure.rejected', 1, { route })`.
 *   - The shared probe `getQueueDepth(routeKey)` reads the same key and is
 *     consumed by `cron-monitor.getQueueDepthSnapshot()` (P2-A) and the
 *     `/health` backpressure probe.
 *   - When the rejection rate sustained over 5 minutes exceeds 10/min for
 *     a route, we emit a Sentry message so on-call sees the pressure.
 *
 * Wiring: see callers in
 *   - `apps/api/src/routes/exports.ts`         (5 concurrent)
 *   - `apps/api/src/routes/ocr.ts`             (10 concurrent)
 *   - `apps/api/src/routes/peppol.ts` (outbound, 3 concurrent)
 *   - `apps/api/src/routes/late-interest.ts`   (5 concurrent)
 */

import { createLogger } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import { getServerEnv } from '@contractor-ops/validators';
import * as Sentry from '@sentry/node';
import { Redis } from '@upstash/redis';

const log = createLogger({ service: 'qstash-backpressure' });

// ---------------------------------------------------------------------------
// Redis client (singleton, lazy)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;

/**
 * Returns a singleton Upstash Redis client.
 * Returns null when env vars are missing (local dev, CI without Upstash).
 *
 * On no-Redis: backpressure becomes a no-op (all requests pass through).
 * This is intentional — the fail-open mode keeps local dev unblocked and
 * the production deployment always has Redis configured.
 */
function getRedis(): Redis | null {
  if (redis) return redis;

  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = getServerEnv();
  if (!(url && token)) return null;

  redis = new Redis({ url, token });
  return redis;
}

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

/**
 * Canonical Redis key for a backpressure semaphore.
 * Exported so the queue-depth probe (cron-monitor) and the health probe
 * can read the same key without re-encoding the namespace string.
 */
export function backpressureKey(routeKey: string): string {
  return `qstash:backpressure:${routeKey}`;
}

/** Per-route rejection-rate counter, sampled by minute window. */
function rejectionWindowKey(routeKey: string, minuteEpoch: number): string {
  return `qstash:backpressure:rej:${routeKey}:${minuteEpoch}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Per-route registry of {routeKey -> maxConcurrent} so other modules
 * (health probe, queue-depth snapshot) can iterate every wired route
 * without each call site re-listing them.
 *
 * Adding a new wired consumer: append a row here and call
 * `withBackpressure(KEY, MAX, fn)` in the consumer route.
 */
export const BackpressureRoutes = {
  EXPORTS_PROCESS: { key: 'exports-process', max: 5 },
  OCR_PROCESS: { key: 'ocr-process', max: 10 },
  PEPPOL_OUTBOUND: { key: 'peppol-outbound', max: 3 },
  LATE_INTEREST_RENDER: { key: 'late-interest-render-claim-pdf', max: 5 },
  CONTRACT_HEALTH_RUN: { key: 'contract-health-run', max: 5 },
} as const satisfies Record<string, { key: string; max: number }>;

export type BackpressureRoute = (typeof BackpressureRoutes)[keyof typeof BackpressureRoutes];

/**
 * BackpressureRejectedError is thrown when the semaphore is full.
 * Callers should map it to a 429 response with `Retry-After`.
 *
 * It's a typed error (not a Response throw) so the consumer's existing
 * error-classification logic (e.g. permanent vs transient) keeps working —
 * it can call `isBackpressureRejected(err)` to short-circuit.
 */
export class BackpressureRejectedError extends Error {
  readonly routeKey: string;
  readonly retryAfterSec: number;

  constructor(routeKey: string, retryAfterSec = 5) {
    super(`backpressure: ${routeKey} concurrency limit reached`);
    this.name = 'BackpressureRejectedError';
    this.routeKey = routeKey;
    this.retryAfterSec = retryAfterSec;
  }
}

export function isBackpressureRejected(err: unknown): err is BackpressureRejectedError {
  return err instanceof BackpressureRejectedError;
}

/** Default safety TTL on the slot counter (seconds). */
const SAFETY_TTL_SEC = 60;

/** Sentry alert threshold: rejections per minute, sustained for 5 minutes. */
const SENTRY_ALERT_RATE_PER_MIN = 10;
const SENTRY_ALERT_WINDOW_MIN = 5;

/**
 * Atomic slot-acquisition script.
 *
 * INCR + (EXPIRE on first increment only) in a single round-trip. This
 * fixes two pre-existing hazards:
 *   1. OOM-kill between separate INCR and EXPIRE calls would strand a
 *      slot without any TTL, leaking capacity until manual intervention.
 *   2. Re-arming EXPIRE on every successful acquisition allowed a
 *      continuously-hot route to keep an orphan slot alive past the
 *      60s leak guard. Setting TTL only on the first INCR (n == 1)
 *      means the leak guard is a hard upper bound from key creation.
 *
 * Returns the post-INCR slot count (>= 1).
 */
const ACQUIRE_SLOT_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return n
`;

/**
 * Wraps a QStash consumer's inner work with a fleet-wide concurrency cap.
 *
 * Usage from a Fastify route:
 * ```ts
 * try {
 *   return await withBackpressure('ocr-process', 10, () => doWork(req));
 * } catch (err) {
 *   if (isBackpressureRejected(err)) {
 *     return reply.header('Retry-After', '5').code(429).send();
 *   }
 *   throw err;
 * }
 * ```
 *
 * Failure mode: when Redis is unreachable the wrapper logs at WARN once
 * per minute and lets the call through (fail-open). The alternative —
 * fail-closed when Redis is down — would amplify a cache outage into a
 * QStash backlog, so we accept the bypass and rely on the upstream
 * `withQueueObservability` metric to surface anomalous traffic.
 */
export async function withBackpressure<T>(
  routeKey: string,
  maxConcurrent: number,
  fn: () => Promise<T>,
): Promise<T> {
  const client = getRedis();
  if (!client) {
    // No Redis configured — pass through (dev / CI / missing env).
    return fn();
  }

  const lockKey = backpressureKey(routeKey);

  let slot: number;
  try {
    // Atomic INCR-and-set-TTL-on-first-increment. See ACQUIRE_SLOT_SCRIPT
    // for the rationale (OOM-kill leak guard + hot-route TTL re-arm fix).
    const result = await client.eval(ACQUIRE_SLOT_SCRIPT, [lockKey], [String(SAFETY_TTL_SEC)]);
    slot = Number(result);
  } catch (err) {
    log.warn(
      { err, routeKey },
      'backpressure slot acquisition failed — failing open and passing call through',
    );
    return fn();
  }

  if (slot > maxConcurrent) {
    // Over the cap — release our claimed slot and reject.
    try {
      await client.decr(lockKey);
    } catch (err) {
      log.warn({ err, routeKey }, 'backpressure DECR after rejection failed');
    }
    await onRejected(client, routeKey, maxConcurrent, slot);
    throw new BackpressureRejectedError(routeKey);
  }

  try {
    return await fn();
  } finally {
    try {
      await client.decr(lockKey);
    } catch (err) {
      // Drop a slot if Redis is unreachable on cleanup — the safety TTL
      // will reset the counter within 60s.
      log.warn({ err, routeKey }, 'backpressure DECR on success path failed');
    }
  }
}

/**
 * Reads the current queue depth (in-flight slot count) for a route.
 * Returns 0 when the key is missing or Redis is unavailable — safe default
 * for the health probe (no Redis = no backpressure pressure to report).
 */
export async function getQueueDepth(routeKey: string): Promise<number> {
  const client = getRedis();
  if (!client) return 0;
  try {
    const raw = await client.get(lockKeyOrNull(routeKey));
    return Number(raw ?? 0);
  } catch (err) {
    log.warn({ err, routeKey }, 'backpressure GET failed');
    return 0;
  }
}

function lockKeyOrNull(routeKey: string): string {
  return backpressureKey(routeKey);
}

/**
 * Snapshot of {routeKey -> currentDepth} for every route in the registry.
 * Used by `cron-monitor.getQueueDepthSnapshot()` and the `/api/health`
 * backpressure probe so callers don't have to re-list every route key.
 */
export async function getAllQueueDepths(): Promise<
  Record<string, { depth: number; max: number; threshold: number }>
> {
  const result: Record<string, { depth: number; max: number; threshold: number }> = {};
  await Promise.all(
    Object.values(BackpressureRoutes).map(async route => {
      const depth = await getQueueDepth(route.key);
      result[route.key] = {
        depth,
        max: route.max,
        threshold: Math.floor(route.max * 1.5),
      };
    }),
  );
  return result;
}

// ---------------------------------------------------------------------------
// Internals — rejection accounting & Sentry alerting
// ---------------------------------------------------------------------------

async function onRejected(
  client: Redis,
  routeKey: string,
  maxConcurrent: number,
  observedSlot: number,
): Promise<void> {
  // Always emit the metric so dashboards see the rejection volume.
  metrics.increment('backpressure.rejected', 1, { route: routeKey });
  log.warn(
    { routeKey, maxConcurrent, observedSlot },
    'backpressure rejected QStash call — Retry-After 5s',
  );

  // Per-minute counter so we can decide whether to escalate to Sentry.
  // Window-keyed by floor(now / 60s) — entries auto-expire after the
  // alert window.
  const minuteEpoch = Math.floor(Date.now() / 60_000);
  const counterKey = rejectionWindowKey(routeKey, minuteEpoch);

  let count: number;
  try {
    count = await client.incr(counterKey);
    await client.expire(counterKey, (SENTRY_ALERT_WINDOW_MIN + 1) * 60);
  } catch (err) {
    // Don't escalate counter errors — accounting is best-effort.
    log.warn({ err, routeKey }, 'backpressure rejection counter increment failed');
    return;
  }

  // First minute over threshold logs a single warning (not Sentry yet).
  if (count === SENTRY_ALERT_RATE_PER_MIN + 1) {
    log.warn(
      { routeKey, count, minuteEpoch },
      'backpressure rejection rate exceeded threshold for current minute',
    );
  }

  // To avoid spamming Sentry on every rejection, only escalate when the
  // *previous* SENTRY_ALERT_WINDOW_MIN minutes ALL exceeded the threshold.
  if (count !== SENTRY_ALERT_RATE_PER_MIN + 1) {
    // Already alerted for this minute (or under threshold).
    return;
  }

  let sustained = true;
  try {
    const priorCounts = await Promise.all(
      Array.from({ length: SENTRY_ALERT_WINDOW_MIN - 1 }, (_, i) =>
        client.get(rejectionWindowKey(routeKey, minuteEpoch - (i + 1))),
      ),
    );
    sustained = priorCounts.every(c => Number(c ?? 0) > SENTRY_ALERT_RATE_PER_MIN);
  } catch (err) {
    log.warn({ err, routeKey }, 'backpressure sentry-window lookup failed');
    return;
  }

  if (!sustained) return;

  Sentry.captureMessage('qstash backpressure rejection rate sustained', {
    level: 'warning',
    tags: { 'backpressure.route': routeKey },
    extra: {
      routeKey,
      maxConcurrent,
      observedSlot,
      ratePerMin: count,
      windowMin: SENTRY_ALERT_WINDOW_MIN,
    },
  });
}
