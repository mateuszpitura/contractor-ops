/**
 * Sentry SDK init for @contractor-ops/api-server.
 *
 * Must run before any application module that might throw so the SDK
 * can wire its OpenTelemetry instrumentation hooks — keep this as the
 * first executable statement of `index.ts`. A single Sentry project hosts
 * every backend service, distinguished by `tags.service`.
 */

import * as Sentry from '@sentry/node';
import { loadEnv } from '../env.js';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  // When unset, init is a no-op and `captureException` becomes a noop too —
  // safe in dev / CI / preview deploys without a Sentry project. Also
  // hard-disable uploads in `development` even when a DSN is set so local
  // runs do not burn the prod project's error quota. Export
  // `SENTRY_DEV=true` to override.
  const env = loadEnv();
  const dsn = env.SENTRY_DSN;
  const isDev = env.NODE_ENV === 'development';
  const sentryDevOverride = process.env.SENTRY_DEV === 'true';
  const enabled = Boolean(dsn) && (!isDev || sentryDevOverride);

  Sentry.init({
    dsn,
    enabled,
    tracesSampleRate: env.NODE_ENV === 'development' ? 1.0 : 0.1,
    environment: env.NODE_ENV,
    // Tag events with the deploy's git commit so Sentry's "first seen /
    // regression in next release" grouping works across deploys. Render
    // exposes the SHA via `RENDER_GIT_COMMIT`; falls through to
    // `undefined` locally / CI when unset, which Sentry accepts as
    // "no release tagged".
    release: process.env.RENDER_GIT_COMMIT,
    // Route `Sentry.logger.*` calls into the same project as exceptions.
    enableLogs: true,
    initialScope: { tags: { service: 'api-server' } },
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
