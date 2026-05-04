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
 * The worker makes outbound HTTP calls to the web service. The target is
 * supplied as `host:port` via WORKER_TARGET_HOSTPORT (set from render.yaml
 * fromService.property: hostport, e.g. "web-abc:3000"), or as a full URL
 * via WORKER_TARGET_URL for local use.
 *
 * Env: WORKER_TARGET_HOSTPORT or WORKER_TARGET_URL (one required),
 *      CRON_SECRET (required).
 */

import * as Sentry from '@sentry/node';
import cron from 'node-cron';
import pino from 'pino';

// F-OBS-04: initialize Sentry as the first step so the process-level
// `uncaughtException` / `unhandledRejection` handlers below can forward
// errors to the same Sentry project the rest of the platform uses. Init
// is a no-op when NEXT_PUBLIC_SENTRY_DSN is unset (dev / preview), and
// captureException becomes a noop too.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  environment: process.env.NODE_ENV ?? 'development',
  initialScope: { tags: { service: 'worker-cron' } },
});

// Pino is used directly here (not @contractor-ops/logger) because this worker
// runs as a standalone Node ESM script outside the Next.js bundle and cannot
// import the TypeScript workspace package. Options mirror packages/logger.
//
// F-OBS-16: mirror the PII redact list from `packages/logger/src/pii-mask.ts`
// so a future field added to a cron-call log object cannot bypass the
// central allowlist (the `lint:logs` guard does not cover *.mjs).
// Keep this list in sync with PII_MASK_PATHS — any new entry there must be
// reflected here until this worker can be ported to TypeScript and import
// the shared list directly.
const PII_REDACT_PATHS = [
  // Authentication / secrets
  '*.password',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.apiKey',
  '*.authorization',
  '*.cookie',
  'headers.authorization',
  'headers.cookie',

  // UK contractor fields
  '*.utr',
  '*.UTR',
  '*.niNumber',
  '*.nationalInsuranceNumber',
  '*.companiesHouseNumber',
  '*.vatNumber',
  '*.vatRegistrationNumber',

  // German contractor fields — Phase 56
  '*.steuernummer',
  '*.ustIdNr',
  '*.ustIdnr',
  '*.vatIdNumber',
  '*.handelsregisterNumber',
  '*.sozialversicherungsnummer',
  '*.svNumber',
  '*.svNr',
  '*.socialInsuranceNumber',

  // Country-scoped bundles
  '*.countryFields.utr',
  '*.countryFields.UTR',
  '*.countryFields.niNumber',
  '*.countryFields.nationalInsuranceNumber',
  '*.countryFields.vatRegistrationNumber',
  '*.countryFields.companiesHouseNumber',
  '*.countryFields.steuernummer',
  '*.countryFields.ustIdNr',
  '*.countryFields.ustIdnr',
  '*.countryFields.sozialversicherungsnummer',
  '*.countryFields.svNumber',
  '*.countryFields.socialInsuranceNumber',
  '*.countryFields.handelsregister.*',

  // Default-redact request/response bodies (Phase 70 D-05).
  'body',
  '*.body',
];

const log = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: 'worker-cron' },
  redact: {
    paths: PII_REDACT_PATHS,
    censor: '[REDACTED]',
  },
});

// ---------------------------------------------------------------------------
// F-OBS-04: process-level error handlers
// ---------------------------------------------------------------------------
//
// Without these, an unhandled rejection inside `triggerCron` (or any
// future module-level promise) silently kills the worker. Render restarts
// the pod, but on-call sees only the symptom (cron jobs stop firing) with
// no last-gasp Sentry capture.

process.on('uncaughtException', err => {
  log.fatal({ err }, 'uncaughtException');
  try {
    Sentry.captureException(err);
  } catch {
    // Sentry capture itself failed — don't loop, just exit.
  }
  process.exit(1);
});

process.on('unhandledRejection', reason => {
  log.error({ err: reason }, 'unhandledRejection');
  try {
    Sentry.captureException(reason);
  } catch {
    // ignore secondary failures
  }
});

// Accept either a hostport (Render private network) or a full URL (local dev).
// If the value lacks a scheme we default to http:// since Render's private
// network is plaintext-only between services in the same region.
const rawTarget = process.env.WORKER_TARGET_HOSTPORT ?? process.env.WORKER_TARGET_URL;
const TARGET = rawTarget?.match(/^https?:\/\//) ? rawTarget : `http://${rawTarget}`;
const CRON_SECRET = process.env.CRON_SECRET;

if (!rawTarget) {
  log.fatal('WORKER_TARGET_HOSTPORT or WORKER_TARGET_URL is required');
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
    log.error({ job: job.name, durationMs: Date.now() - start, err }, 'cron call threw');
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
