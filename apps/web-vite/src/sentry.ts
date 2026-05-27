/**
 * Browser-side Sentry init for the SPA.
 *
 * Mirrors apps/api/src/lib/sentry.ts so a single Sentry project hosts
 * every service distinguished by `tags.service`. Init is a no-op when
 * `VITE_SENTRY_DSN` is unset — safe in dev / CI / preview deploys
 * without a Sentry project wired.
 *
 * `beforeSend: scrubSentryEvent` redacts PII (passwords, tokens, IBANs,
 * tax IDs, etc. — see `lib/sentry-scrub.ts`) from every event before it
 * leaves the browser. The scrubber must stay wired here; defining it but
 * not passing it as `beforeSend` is the failure mode this comment exists
 * to prevent.
 *
 * `tracePropagationTargets` keeps `sentry-trace` / `baggage` headers
 * flowing on cross-subdomain SPA→API requests (app.contractor-ops.com →
 * api.contractor-ops.com) so distributed traces stitch end-to-end. The
 * dev hard-disable (`MODE !== 'development'`) prevents real Sentry
 * traffic from leaving local machines even when a DSN is set in
 * `.env.local` — restoration of GAP-OBSERVABILITY-003 + GAP-OBSERVABILITY-006
 * from the post-migration parity audit.
 */

import * as Sentry from '@sentry/react';
import type { ClientEnv } from './env.js';
import { scrubSentryEvent } from './lib/sentry-scrub.js';

const TRACE_PROPAGATION_TARGETS: readonly (string | RegExp)[] = [
  'localhost',
  /^https:\/\/(?:[a-z0-9-]+\.)?contractor-ops\.com/,
];

let initialized = false;

export function initBrowserSentry(env: ClientEnv): void {
  if (initialized) return;
  const isDev = import.meta.env.MODE === 'development';
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    enabled: Boolean(env.VITE_SENTRY_DSN) && !isDev,
    environment: import.meta.env.MODE,
    tracesSampleRate: isDev ? 1.0 : 0.1,
    tracePropagationTargets: [...TRACE_PROPAGATION_TARGETS],
    initialScope: { tags: { service: 'web-vite' } },
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

export { Sentry };
