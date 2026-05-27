/**
 * Sentry SDK init for the public REST API (Hono on @hono/node-server).
 *
 * Invoked at the top of `apps/public-api/src/index.ts` BEFORE any
 * application code that throws — the `--import` ESM pattern is awkward
 * for the build pipeline, so accept the small "errors thrown during init
 * are not captured" risk in exchange for a single-file entry. Init is
 * idempotent, so importing this module from tests is safe.
 */

import * as Sentry from '@sentry/node';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  // When unset, Sentry init is a no-op and `captureException` becomes a noop
  // too — safe in dev / CI / preview deploys without a Sentry project. Also
  // hard-disable uploads in `development` even when a DSN is set so local
  // runs do not burn the prod project's error quota. Export
  // `SENTRY_DEV=true` to override.
  const dsn = process.env.SENTRY_DSN;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isDev = nodeEnv === 'development';
  const sentryDevOverride = process.env.SENTRY_DEV === 'true';
  const enabled = Boolean(dsn) && (!isDev || sentryDevOverride);

  Sentry.init({
    dsn,
    enabled,

    // Performance — 100% in dev, 10% in production (mirrors web).
    tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

    environment: process.env.NODE_ENV ?? 'development',

    // Tag events with the deploy's git commit (Render exposes
    // `RENDER_GIT_COMMIT` at runtime); falls through to `undefined`
    // locally / CI.
    release: process.env.RENDER_GIT_COMMIT,

    // Tag the service so a single Sentry project can host both web + API.
    initialScope: { tags: { service: 'public-api' } },

    // Redact PII (passwords, OAuth tokens, IBANs, tax IDs, etc.) from
    // every event payload before it leaves the process — see
    // `sentry-scrub.ts` for the matched key list. Public-API receives
    // external API-key consumer payloads, so defining the scrubber but
    // not passing it as `beforeSend` would silently leak PII on every
    // unhandled exception; keep it wired.
    beforeSend: scrubSentryEvent,
  });

  initialized = true;
}

export { Sentry };
