/**
 * Sentry SDK init for the public REST API (Hono on @hono/node-server).
 *
 * F-OBS-01: previously the public-api had zero error capture. A 500 was
 * recorded only as `log.error({ err }, 'unhandled error')` (see
 * `error-handler.ts`) with no requestId, no auth context, and no stack
 * trace anywhere visible to on-call. This module wires `@sentry/node`
 * with the same DSN env var the web app uses.
 *
 * Init is invoked at the top of `apps/public-api/src/index.ts` BEFORE any
 * application code that throws — the `--import` ESM pattern is awkward
 * for our build pipeline, so we accept the small risk of "errors thrown
 * during init are not captured" in exchange for a single-file entry.
 *
 * The init is idempotent (Sentry guards) so importing this module from
 * tests is safe.
 */

import * as Sentry from '@sentry/node';
import { scrubSentryEvent } from './sentry-scrub.js';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  // When unset, Sentry init is a no-op and `captureException` becomes a noop
  // too — safe in dev / CI / preview deploys without a Sentry project. Also
  // hard-disable uploads in `development` even if a DSN is set in `.env`,
  // so local runs do not burn the prod project's error quota. Mirror of the
  // api-server + cron-worker guards. Override with `SENTRY_DEV=true`.
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

    // Restoration of GAP-OBSERVABILITY-009 — tag every event with the
    // deploy's git commit (Render exposes `RENDER_GIT_COMMIT` at runtime).
    // Falls through to `undefined` locally / CI when unset.
    release: process.env.RENDER_GIT_COMMIT,

    // Tag the service so a single Sentry project can host both web + API.
    initialScope: { tags: { service: 'public-api' } },

    // Redact PII (passwords, OAuth tokens, IBANs, tax IDs, etc.) from
    // every event payload before it leaves the process — see
    // `sentry-scrub.ts` for the matched key list. Public-API receives
    // external API-key consumer payloads, so defining the scrubber but
    // not passing it as `beforeSend` is the historic failure mode that
    // GAP-OBSERVABILITY-008 surfaced; must stay wired.
    beforeSend: scrubSentryEvent,
  });

  initialized = true;
}

export { Sentry };
