/**
 * Sentry init for @contractor-ops/cron-worker.
 *
 * Mirrors apps/api/src/lib/sentry.ts so a single Sentry project can host
 * every backend service distinguished by `tags.service`.
 */

import * as Sentry from '@sentry/node';
import { loadEnv } from '../env.js';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const env = loadEnv();
  const dsn = env.SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: env.NODE_ENV,
    // Restoration of GAP-OBSERVABILITY-009 — tag every event with the
    // deploy's git commit (Render exposes `RENDER_GIT_COMMIT` at runtime).
    // Falls through to `undefined` locally / CI when unset.
    release: process.env.RENDER_GIT_COMMIT,
    initialScope: { tags: { service: 'cron-worker' } },
    // GAP-OBSERVABILITY-007: redact PII (passwords, OAuth tokens, IBANs,
    // tax IDs, etc.) from every event before it leaves the process — see
    // `sentry-scrub.ts` for the matched key list. Must stay wired;
    // defining the scrubber but not passing it as `beforeSend` is the
    // historic failure mode this codebase has hit before (and the exact
    // gap this comment exists to prevent on cron-worker).
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

export { Sentry };
