/**
 * Static per-job metadata shared between the registry (which builds the live
 * `JobMeta` for the scheduler) and `job-health` (which reads the nominal
 * cadence to decide when a persisted last-success is stale).
 *
 * Kept free of handler imports so `job-health` can pull the cadence map
 * without loading the whole registry (and its handler dependency graph).
 *
 * `intervalMs` is the nominal cadence, not the env-overridable schedule — it
 * drives the coarse `2×interval` staleness alert and the boot catch-up window.
 * Overriding a schedule to a faster cadence only makes those checks more
 * lenient, never noisier, which is the safe direction for an alert heuristic.
 */

import type { JobMeta } from './runner.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface StaticJobMeta {
  /** Hard per-run wall-clock budget (ms). Falls back to the env default when unset. */
  maxMs?: number;
  /** Nominal cadence (ms) — job-health staleness threshold + boot catch-up window. */
  intervalMs: number;
  /** Must-run daily job: re-run once at boot when its persisted last success predates one interval. */
  catchUpOnBoot?: boolean;
}

export const JOB_STATIC_META: Record<string, StaticJobMeta> = {
  'token-refresh': { intervalMs: 15 * MINUTE },
  'data-purge': { intervalMs: DAY, catchUpOnBoot: true, maxMs: 10 * MINUTE },
  'exchange-rates': { intervalMs: DAY, catchUpOnBoot: true },
  'boe-rate-poll': { intervalMs: DAY, catchUpOnBoot: true },
  'org-definition-sync': { intervalMs: DAY, catchUpOnBoot: true },
  'classification-reassessment-triggers': { intervalMs: DAY, catchUpOnBoot: true },
  'classification-economic-dependency': { intervalMs: DAY, catchUpOnBoot: true },
  'form-1099k-tracker': { intervalMs: DAY, catchUpOnBoot: true },
  'inpost-status-poll': { intervalMs: HOUR },
  'job-health': { intervalMs: 5 * MINUTE },
  'late-interest-pdf-reaper': { intervalMs: 5 * MINUTE },
  'trial-notifications': { intervalMs: DAY, catchUpOnBoot: true },
  reminders: { intervalMs: DAY, catchUpOnBoot: true, maxMs: 10 * MINUTE },
  'stripe-reconcile': { intervalMs: DAY, catchUpOnBoot: true },
};

/** jobName → nominal cadence (ms). Consumed by `job-health` staleness detection. */
export const CRON_JOB_INTERVALS_MS: Record<string, number> = Object.fromEntries(
  Object.entries(JOB_STATIC_META).map(([name, m]) => [name, m.intervalMs]),
);

/** Build the live `JobMeta` for a scheduled job, folding in its static metadata. */
export function buildJobMeta(name: string, schedule: string, defaultMaxMs: number): JobMeta {
  const s = JOB_STATIC_META[name];
  return {
    name,
    schedule,
    maxMs: s?.maxMs ?? defaultMaxMs,
    intervalMs: s?.intervalMs,
    catchUpOnBoot: s?.catchUpOnBoot ?? false,
  };
}
