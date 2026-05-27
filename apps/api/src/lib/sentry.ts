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
  // safe in dev / CI / preview deploys without a Sentry project. We also
  // hard-disable Sentry uploads in `development` even if a DSN is set in
  // `.env`, so local runs do not burn the prod project's error quota.
  // Mirror of the browser-side guard at `apps/web-vite/src/sentry.ts:40`.
  // Override for dev debugging by exporting `SENTRY_DEV=true`.
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
    // Restoration of GAP-OBSERVABILITY-009 — tag every event with the
    // deploy's git commit so Sentry's "first seen / regression in next
    // release" grouping works across deploys. Render exposes the SHA via
    // `RENDER_GIT_COMMIT` (full 40-char hash) on every build/runtime.
    // Falls through to `undefined` locally / CI when unset, which Sentry
    // accepts as "no release tagged".
    release: process.env.RENDER_GIT_COMMIT,
    // Restoration of GAP-OBSERVABILITY-005 — legacy server config opted
    // into Sentry's structured log capture so server-side `Sentry.logger.*`
    // calls flow into the same project as exceptions. Uses the v10 top-level
    // option (the `_experiments.enableLogs` variant is deprecated).
    enableLogs: true,
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
