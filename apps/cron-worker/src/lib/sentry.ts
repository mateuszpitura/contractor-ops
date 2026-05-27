/**
 * Sentry init for @contractor-ops/cron-worker.
 *
 * Mirrors apps/api/src/lib/sentry.ts so a single Sentry project can host
 * every backend service distinguished by `tags.service`.
 */

import * as Sentry from '@sentry/node';
import { loadEnv } from '../env.js';

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
    initialScope: { tags: { service: 'cron-worker' } },
  });
  initialized = true;
}

export { Sentry };
