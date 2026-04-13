/**
 * Worker cron scheduler — replaces Vercel Crons when running in Docker.
 *
 * Starts the Next.js standalone server, then uses node-cron to hit the
 * /api/cron/* endpoints on schedule. Matches the schedules in vercel.json.
 *
 * Usage: node worker-cron.mjs
 * Env:   PORT (default 3000), CRON_SECRET (required), HOSTNAME (default 0.0.0.0)
 */

import { spawn } from 'node:child_process';
import cron from 'node-cron';

const PORT = process.env.PORT || '3000';
const HOST = process.env.HOSTNAME || '0.0.0.0';
const BASE = `http://127.0.0.1:${PORT}`;
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('[worker-cron] CRON_SECRET is required');
  process.exit(1);
}

// ── Start the Next.js standalone server ────────────────────────────────────

const server = spawn('node', ['server.js'], {
  env: { ...process.env, HOSTNAME: HOST, PORT },
  stdio: 'inherit',
  cwd: process.cwd(),
});

server.on('exit', code => {
  console.error(`[worker-cron] Next.js server exited with code ${code}`);
  process.exit(code ?? 1);
});

// Give the server a moment to bind before scheduling
await new Promise(resolve => setTimeout(resolve, 3000));

// ── Cron schedules (mirrors vercel.json) ───────────────────────────────────

const jobs = [
  { schedule: '*/15 * * * *', path: '/api/cron/token-refresh', name: 'token-refresh' },
  { schedule: '0 9 * * *', path: '/api/cron/reminders', name: 'reminders' },
  { schedule: '0 9 * * *', path: '/api/cron/trial-notifications', name: 'trial-notifications' },
  { schedule: '0 3 * * *', path: '/api/cron/data-purge', name: 'data-purge' },
  { schedule: '*/30 * * * *', path: '/api/cron/job-health', name: 'job-health' },
];

async function triggerCron(job) {
  const url = `${BASE}${job.path}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(120_000),
    });
    const _status = res.ok ? 'OK' : `FAIL(${res.status})`;
  } catch (err) {
    console.error(`[worker-cron] ${job.name} → ERROR: ${err.message}`);
  }
}

for (const job of jobs) {
  cron.schedule(job.schedule, () => triggerCron(job), { timezone: 'UTC' });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────

function shutdown(signal) {
  server.kill(signal);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
