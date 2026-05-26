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
 */

import * as Sentry from '@sentry/react';
import type { ClientEnv } from './env.js';
import { scrubSentryEvent } from './lib/sentry-scrub.js';

let initialized = false;

export function initBrowserSentry(env: ClientEnv): void {
  if (initialized) return;
  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    enabled: Boolean(env.VITE_SENTRY_DSN),
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.MODE === 'development' ? 1.0 : 0.1,
    initialScope: { tags: { service: 'web-vite' } },
    integrations: [Sentry.browserTracingIntegration()],
    beforeSend: scrubSentryEvent,
  });
  initialized = true;
}

export { Sentry };
