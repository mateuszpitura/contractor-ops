/**
 * Sentry init for @contractor-ops/cron-worker. A single Sentry project
 * hosts every backend service distinguished by `tags.service`.
 */

import * as Sentry from '@sentry/node';
import { loadEnv } from '../env.js';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const env = loadEnv();
  const dsn = env.SENTRY_DSN;
  // Hard-disable uploads in `development` even when a DSN is set so local
  // runs do not burn the prod project's error quota. Export
  // `SENTRY_DEV=true` to override.
  const isDev = env.NODE_ENV === 'development';
  const sentryDevOverride = process.env.SENTRY_DEV === 'true';
  const enabled = Boolean(dsn) && (!isDev || sentryDevOverride);
  Sentry.init({
    dsn,
    enabled,
    tracesSampleRate: env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: env.NODE_ENV,
    // Tag events with the deploy's git commit (Render exposes
    // `RENDER_GIT_COMMIT` at runtime); falls through to `undefined`
    // locally / CI.
    release: process.env.RENDER_GIT_COMMIT,
    initialScope: { tags: { service: 'cron-worker' } },
    // Redact PII (passwords, OAuth tokens, IBANs, tax IDs, etc.) from
    // every event payload before it leaves the process — see
    // `sentry-scrub.ts` for the matched key list. Defining the scrubber
    // but not passing it as `beforeSend` would silently leak PII; keep
    // it wired.
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

export { Sentry };
