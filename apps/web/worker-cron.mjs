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

const TARGET = process.env.WORKER_TARGET_URL;
const CRON_SECRET = process.env.CRON_SECRET;

if (!TARGET) {
  console.error('[worker-cron] WORKER_TARGET_URL is required (e.g. http://web-XXXX:3000)');
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error('[worker-cron] CRON_SECRET is required');
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
    const ms = Date.now() - start;
    if (!res.ok) {
      console.error(`[worker-cron] ${job.name} -> ${res.status} (${ms}ms)`);
      return;
    }
  } catch (err) {
    console.error(`[worker-cron] ${job.name} -> ERROR: ${err.message}`);
  }
}

const scheduled = jobs.map(job => {
  const task = cron.schedule(job.schedule, () => triggerCron(job), { timezone: 'UTC' });
  return task;
});

function shutdown(_signal) {
  for (const task of scheduled) task.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
