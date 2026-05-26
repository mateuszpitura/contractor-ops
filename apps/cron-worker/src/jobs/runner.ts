/**
 * Job runner — wraps a `JobHandler` with the bookkeeping every cron tick
 * needs: a stable trace id, an ALS-bound logger, last-success tracking
 * for the health endpoint, and Sentry capture on failure.
 *
 * The trace id propagates to every Pino log line emitted by handlers
 * (and any downstream service they call) via `runWithRequestContext`,
 * so a failed job leaves a single id the on-call can pivot across
 * Pino, Sentry, and downstream HTTP audit rows.
 *
 * Successful runs update `lastSuccessByJob[jobName]` so the /health
 * endpoint can report freshness without coupling to the scheduler
 * internals.
 */

import { createLogger, runWithRequestContext } from '@contractor-ops/logger';
import type { Logger } from 'pino';
import { Sentry } from '../lib/sentry.js';

export interface JobMeta {
  name: string;
  schedule: string;
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
  status: 'success' | 'failure';
  startedAt: string;
  durationMs: number;
  traceId: string;
  error?: string;
}

const lastSuccessByJob = new Map<string, JobRunRecord>();
const lastRunByJob = new Map<string, JobRunRecord>();

const baseLog = createLogger({ service: 'cron-worker' });

export async function runJob(meta: JobMeta, handler: JobHandler): Promise<JobRunRecord> {
  const traceId = globalThis.crypto.randomUUID();
  const startedAt = new Date();
  const log = baseLog.child({ job: meta.name, traceId });

  return runWithRequestContext({ requestId: traceId }, async () => {
    const start = performance.now();
    log.info({ schedule: meta.schedule }, 'job tick started');
    try {
      const result = await handler({ log, traceId, startedAt });
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
      return record;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const record: JobRunRecord = {
        jobName: meta.name,
        status: 'failure',
        startedAt: startedAt.toISOString(),
        durationMs,
        traceId,
        error: err instanceof Error ? err.message : String(err),
      };
      lastRunByJob.set(meta.name, record);
      log.error({ err, durationMs }, 'job tick threw');
      Sentry.captureException(err, {
        tags: { job: meta.name, traceId },
        extra: { schedule: meta.schedule },
      });
      return record;
    }
  });
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
}
