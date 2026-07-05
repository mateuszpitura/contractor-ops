/**
 * Job runner — wraps a `JobHandler` with the guarantees every cron tick
 * needs, in one place rather than in each handler:
 *
 *   - a stable trace id + ALS-bound logger, so a failed job leaves a single
 *     id the on-call can pivot across Pino, Sentry, and downstream audit rows;
 *   - an in-process overlap guard, so a slow tick is never run twice
 *     concurrently on the same worker (the second tick is skipped + logged);
 *   - a per-tick Postgres advisory lock (namespace `cron`, key = job name),
 *     so two replicas can't run the same job's tick at once;
 *   - a hard wall-clock timeout (`maxMs`), so a hung handler is abandoned and
 *     paged to Sentry instead of wedging the guard forever;
 *   - durable last-run / last-success persistence in `CronJobRunState`, which
 *     survives a worker restart (the in-memory maps below, still served by the
 *     /health endpoint, are wiped on restart) so `job-health` can alert on a
 *     job that silently stopped running.
 *
 * The advisory lock is held for the whole handler by keeping its transaction
 * open while the handler runs on separate pool connections — the tx carries
 * only the lock, not the handler's queries. `reminders` self-locks on its own
 * `cron:reminders` key inside its handler; the runner's `cron:<jobName>` lock
 * is a distinct key, so the two never collide.
 *
 * A timed-out handler cannot be cancelled (JS has no promise cancellation), so
 * it keeps running on its pool connections after the lock tx rolls back; the
 * in-process guard is released when we stop waiting, so the next tick may retry.
 */

import { tryAcquireXactLock } from '@contractor-ops/api/lib/advisory-lock';
import { prismaRaw } from '@contractor-ops/db';
import { createLogger, runWithRequestContext } from '@contractor-ops/logger';
import { metrics } from '@contractor-ops/logger/metrics';
import type { Logger } from 'pino';
import { Sentry } from '../lib/sentry.js';

export interface JobMeta {
  name: string;
  schedule: string;
  /** Hard per-run wall-clock budget (ms). Falls back to `DEFAULT_MAX_MS`. */
  maxMs?: number;
  /** Nominal cadence (ms) — `job-health` staleness threshold + boot catch-up window. */
  intervalMs?: number;
  /** Must-run daily job: re-run once at boot when the persisted last success is older than one interval. */
  catchUpOnBoot?: boolean;
}

export interface JobContext {
  log: Logger;
  traceId: string;
  startedAt: Date;
}

export interface JobResult {
  ok: boolean;
  durationMs: number;
  details?: Record<string, unknown>;
}

export type JobHandler = (ctx: JobContext) => Promise<JobResult>;

export interface JobRunRecord {
  jobName: string;
  status: 'success' | 'failure' | 'skipped';
  startedAt: string;
  durationMs: number;
  traceId: string;
  error?: string;
}

/** Default per-run wall-clock budget when a job declares no `maxMs`. */
const DEFAULT_MAX_MS = 5 * 60_000;
/** Advisory-lock namespace shared with reminders (packages/api/src/lib/advisory-lock.ts). */
const LOCK_NAMESPACE = 'cron' as const;
/** Head-room over `maxMs` for the lock-holding tx so the in-process timeout fires first. */
const TX_TIMEOUT_BUFFER_MS = 10_000;
/** Max wait for a pool connection to open the lock-holding tx. */
const TX_MAX_WAIT_MS = 10_000;

class JobTimeoutError extends Error {
  constructor(jobName: string, maxMs: number) {
    super(`cron job "${jobName}" exceeded its ${maxMs}ms budget`);
    this.name = 'JobTimeoutError';
  }
}

const lastSuccessByJob = new Map<string, JobRunRecord>();
const lastRunByJob = new Map<string, JobRunRecord>();
const runningJobs = new Set<string>();

const baseLog = createLogger({ service: 'cron-worker' });

/**
 * Upsert the durable per-job run state. `lastRunAt` is stamped on every run
 * that actually executed; `lastSuccessAt` only on success. Its own try/catch —
 * a bookkeeping write failure must never mask the job's real result.
 */
async function persistRunState(
  jobName: string,
  startedAt: Date,
  succeededAt: Date | null,
  log: Logger,
): Promise<void> {
  try {
    await prismaRaw.cronJobRunState.upsert({
      where: { jobName },
      create: { jobName, lastRunAt: startedAt, lastSuccessAt: succeededAt },
      update: { lastRunAt: startedAt, ...(succeededAt ? { lastSuccessAt: succeededAt } : {}) },
    });
  } catch (err) {
    log.error({ err }, 'failed to persist cron run state');
    Sentry.captureException(err, { tags: { job: jobName, 'cron.persist': 'failed' } });
  }
}

async function raceHandlerWithTimeout(
  jobName: string,
  handler: JobHandler,
  ctx: JobContext,
  maxMs: number,
): Promise<JobResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new JobTimeoutError(jobName, maxMs)), maxMs);
  });
  try {
    return await Promise.race([handler(ctx), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type TickOutcome = { outcome: 'locked' } | { outcome: 'ran'; result: JobResult };

function skippedRecord(
  meta: JobMeta,
  startedAt: Date,
  traceId: string,
  durationMs: number,
): JobRunRecord {
  return {
    jobName: meta.name,
    status: 'skipped',
    startedAt: startedAt.toISOString(),
    durationMs,
    traceId,
  };
}

export async function runJob(meta: JobMeta, handler: JobHandler): Promise<JobRunRecord> {
  const traceId = globalThis.crypto.randomUUID();
  const startedAt = new Date();
  const maxMs = meta.maxMs ?? DEFAULT_MAX_MS;

  // In-process overlap guard — must run before the first await so two ticks
  // scheduled onto the same worker can't both pass it.
  if (runningJobs.has(meta.name)) {
    baseLog.warn(
      { job: meta.name, schedule: meta.schedule },
      'previous run still in flight; skipping this tick',
    );
    metrics.increment('cron.tick.skipped_overlap', 1, { job: meta.name });
    return skippedRecord(meta, startedAt, traceId, 0);
  }
  runningJobs.add(meta.name);

  try {
    return await runWithRequestContext({ requestId: traceId }, async () => {
      const log = baseLog.child({ job: meta.name, traceId });
      const ctx: JobContext = { log, traceId, startedAt };
      const start = performance.now();
      log.info({ schedule: meta.schedule }, 'job tick started');

      try {
        const tick = await prismaRaw.$transaction(
          async (tx): Promise<TickOutcome> => {
            const acquired = await tryAcquireXactLock(tx, LOCK_NAMESPACE, meta.name);
            if (!acquired) return { outcome: 'locked' };
            const result = await raceHandlerWithTimeout(meta.name, handler, ctx, maxMs);
            return { outcome: 'ran', result };
          },
          { timeout: maxMs + TX_TIMEOUT_BUFFER_MS, maxWait: TX_MAX_WAIT_MS },
        );

        if (tick.outcome === 'locked') {
          log.info('another replica holds the cron lock; skipping this tick');
          metrics.increment('cron.tick.skipped_locked', 1, { job: meta.name });
          return skippedRecord(meta, startedAt, traceId, Math.round(performance.now() - start));
        }

        const { result } = tick;
        const durationMs = result.durationMs || Math.round(performance.now() - start);
        const record: JobRunRecord = {
          jobName: meta.name,
          status: result.ok ? 'success' : 'failure',
          startedAt: startedAt.toISOString(),
          durationMs,
          traceId,
        };
        lastRunByJob.set(meta.name, record);
        if (result.ok) {
          lastSuccessByJob.set(meta.name, record);
          log.info({ durationMs, details: result.details }, 'job tick completed');
        } else {
          log.warn({ durationMs, details: result.details }, 'job tick reported failure');
          Sentry.captureMessage(`cron job ${meta.name} reported failure`, {
            level: 'warning',
            tags: { job: meta.name, traceId },
            extra: { details: result.details },
          });
        }
        await persistRunState(meta.name, startedAt, result.ok ? new Date() : null, log);
        return record;
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        const timedOut = err instanceof JobTimeoutError;
        const record: JobRunRecord = {
          jobName: meta.name,
          status: 'failure',
          startedAt: startedAt.toISOString(),
          durationMs,
          traceId,
          error: err instanceof Error ? err.message : String(err),
        };
        lastRunByJob.set(meta.name, record);
        if (timedOut) {
          log.error({ err, durationMs, maxMs }, 'job tick timed out — handler abandoned');
          Sentry.captureMessage(`cron job ${meta.name} timed out after ${maxMs}ms`, {
            level: 'error',
            tags: { job: meta.name, traceId, 'cron.outcome': 'timeout' },
            extra: { maxMs, durationMs },
          });
        } else {
          log.error({ err, durationMs }, 'job tick threw');
          Sentry.captureException(err, {
            tags: { job: meta.name, traceId },
            extra: { schedule: meta.schedule },
          });
        }
        await persistRunState(meta.name, startedAt, null, log);
        return record;
      }
    });
  } finally {
    runningJobs.delete(meta.name);
  }
}

/**
 * Boot catch-up: for `catchUpOnBoot` jobs whose persisted `lastSuccessAt`
 * predates one interval (or is absent), run one tick immediately so a restart
 * that spanned a daily job's scheduled window doesn't silently skip a day.
 * Runs jobs sequentially to avoid a boot-time thundering herd; each `runJob`
 * is guarded/locked/persisted like a scheduled tick, and never throws.
 */
export async function runStartupCatchUp(
  jobs: ReadonlyArray<{ meta: JobMeta; handler: JobHandler }>,
  log: Logger,
): Promise<void> {
  const now = Date.now();
  for (const { meta, handler } of jobs) {
    if (!(meta.catchUpOnBoot && meta.intervalMs)) continue;

    let lastSuccessAt: Date | null = null;
    try {
      const state = await prismaRaw.cronJobRunState.findUnique({
        where: { jobName: meta.name },
        select: { lastSuccessAt: true },
      });
      lastSuccessAt = state?.lastSuccessAt ?? null;
    } catch (err) {
      log.error({ err, job: meta.name }, 'startup catch-up: failed to read run state');
      Sentry.captureException(err, { tags: { job: meta.name, 'cron.catchup': 'read-failed' } });
      continue;
    }

    const overdue = lastSuccessAt === null || now - lastSuccessAt.getTime() > meta.intervalMs;
    if (!overdue) continue;

    log.warn(
      { job: meta.name, lastSuccessAt, intervalMs: meta.intervalMs },
      'startup catch-up: must-run job missed its window; running now',
    );
    metrics.increment('cron.catchup.run', 1, { job: meta.name });
    await runJob(meta, handler);
  }
}

export function getLastSuccess(jobName: string): JobRunRecord | undefined {
  return lastSuccessByJob.get(jobName);
}

export function getLastRun(jobName: string): JobRunRecord | undefined {
  return lastRunByJob.get(jobName);
}

export function getAllJobStatus(): Record<
  string,
  { lastSuccess?: JobRunRecord; lastRun?: JobRunRecord }
> {
  const out: Record<string, { lastSuccess?: JobRunRecord; lastRun?: JobRunRecord }> = {};
  const names = new Set<string>([...lastRunByJob.keys(), ...lastSuccessByJob.keys()]);
  for (const name of names) {
    out[name] = {
      lastSuccess: lastSuccessByJob.get(name),
      lastRun: lastRunByJob.get(name),
    };
  }
  return out;
}

/** Test-only — reset internal accumulators between cases. */
export function __resetForTests(): void {
  lastSuccessByJob.clear();
  lastRunByJob.clear();
  runningJobs.clear();
}
