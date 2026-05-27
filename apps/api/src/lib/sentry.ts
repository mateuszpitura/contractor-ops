/**
 * Sentry SDK init for @contractor-ops/api-server.
 *
 * F-OBS-01: init runs before any application module that might throw, so
 * the SDK can wire its OpenTelemetry instrumentation hooks. Keep this as
 * the first executable statement of `index.ts`.
 *
 * Mirrors `apps/public-api/src/lib/sentry.ts` so a single Sentry project
 * can host every backend service (web, public-api, api-server, cron-worker)
 * distinguished by `tags.service`.
 */

import * as Sentry from '@sentry/node';
import { loadEnv } from '../env.js';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  // When unset, init is a no-op and `captureException` becomes a noop too —
  // safe in dev / CI / preview deploys without a Sentry project.
  const env = loadEnv();
  const dsn = env.SENTRY_DSN;

  Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    tracesSampleRate: env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: env.NODE_ENV,
    initialScope: { tags: { service: 'api-server' } },
    // Redact PII (passwords, OAuth tokens, IBANs, tax IDs, etc.) from
    // every event payload before it leaves the process — see
    // `sentry-scrub.ts` for the matched key list. Must stay wired;
    // defining the scrubber but not passing it as `beforeSend` is the
    // historic failure mode this codebase has hit before.
    beforeSend: scrubSentryEvent,
  });

  initialized = true;
}

export { Sentry };
