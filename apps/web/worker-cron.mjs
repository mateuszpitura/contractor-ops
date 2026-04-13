/**
 * Background worker — node-cron scheduler for non-critical jobs.
 *
 * Critical jobs (token-refresh, data-purge) are scheduled as native Render
 * Cron Jobs so they survive worker restarts and have per-job observability.
 * This worker only handles best-effort, recoverable jobs:
 *   - reminders            (daily 09:00 UTC)
 *   - trial-notifications  (daily 09:00 UTC)
 *   - job-health           (every 30 min — Cronitor heartbeat)
 *
 * The worker process makes outbound HTTP calls to the web service via
 * WORKER_TARGET_URL (e.g. http://web-XXXX:3000 on Render's private network,
 * or http://127.0.0.1:3000 locally with `docker compose --profile worker`).
 *
 * Env: WORKER_TARGET_URL (required), CRON_SECRET (required).
 */

import cron from 'node-cron';
import pino from 'pino';

// Pino is used directly here (not @contractor-ops/logger) because this worker
// runs as a standalone Node ESM script outside the Next.js bundle and cannot
// import the TypeScript workspace package. Options mirror packages/logger.
const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: 'worker-cron' },
});

const TARGET = process.env.WORKER_TARGET_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!TARGET) {
  log.fatal('WORKER_TARGET_URL is required (e.g. http://web-XXXX:3000)');
  process.exit(1);
}
if (!CRON_SECRET) {
  log.fatal('CRON_SECRET is required');
  process.exit(1);
}

const jobs = [
  { schedule: '0 9 * * *', path: '/api/cron/reminders', name: 'reminders' },
  { schedule: '0 9 * * *', path: '/api/cron/trial-notifications', name: 'trial-notifications' },
  { schedule: '*/30 * * * *', path: '/api/cron/job-health', name: 'job-health' },
];

async function triggerCron(job) {
  const url = `${TARGET}${job.path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(120_000),
    });
    const durationMs = Date.now() - start;
    if (!res.ok) {
      log.error({ job: job.name, status: res.status, durationMs }, 'cron call failed');
      return;
    }
    log.info({ job: job.name, status: res.status, durationMs }, 'cron call ok');
  } catch (err) {
    log.error(
      { job: job.name, durationMs: Date.now() - start, err },
      'cron call threw',
    );
  }
}

const scheduled = jobs.map(job => {
  const task = cron.schedule(job.schedule, () => triggerCron(job), { timezone: 'UTC' });
  log.info({ job: job.name, schedule: job.schedule }, 'cron scheduled');
  return task;
});

function shutdown(signal) {
  log.info({ signal, scheduledCount: scheduled.length }, 'worker shutting down');
  for (const task of scheduled) task.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
