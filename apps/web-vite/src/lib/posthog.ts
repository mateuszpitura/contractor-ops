/**
 * PostHog browser SDK init for @contractor-ops/web-vite.
 *
 * Conservative defaults: no-op when key absent, autocapture OFF, no auto
 * pageviews — explicit `capture()` calls only. Legacy `apps/web` does not
 * use PostHog client-side either; this fulfills the Facts.md observability
 * claim without introducing surprising data flow.
 *
 * GDPR gate: `initPostHog()` is a no-op until the user has accepted the
 * cookie-consent banner. Calling it before consent silently returns; the
 * banner's accept handler re-invokes this after writing the consent flag
 * (see `components/layout/cookie-consent-banner.tsx`). This prevents the
 * pre-consent cookie/event leak that the unconditional boot-time init had.
 */

import posthog from 'posthog-js';
import { getClientEnv } from '../env.js';
import { hasCookieConsent } from './consent.js';

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (!hasCookieConsent()) return;
  const env = getClientEnv();
  const key = env.VITE_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    persistence: 'localStorage+cookie',
  });
  posthog.capture('app_loaded');
  initialized = true;
}

export { posthog };
