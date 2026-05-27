/**
 * PostHog browser SDK init for @contractor-ops/web-vite.
 *
 * Conservative defaults: no-op when key absent, autocapture OFF, no auto
 * pageviews — explicit `capture()` calls only.
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
let identifiedUserId: string | null = null;

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

/**
 * Stitch the current PostHog anonymous distinct id to a signed-in user
 * id. PostHog's `identify()` is idempotent — calling with the same id
 * a second time is a no-op. The first call after sign-in carries the
 * pre-auth anonymous distinct id forward so the conversion funnel
 * (anonymous landing visit → signup → first dashboard load) stays
 * stitched in one user timeline.
 *
 * Safe to call before `initPostHog()` ran (e.g. when consent has not
 * yet been granted) — the call short-circuits.
 */
export function identifyPostHogUser(userId: string, properties?: Record<string, unknown>): void {
  if (!initialized) return;
  if (!userId) return;
  if (identifiedUserId === userId) return;
  posthog.identify(userId, properties);
  identifiedUserId = userId;
}

/**
 * Drop the identified user — call on sign-out so the next session's
 * anonymous events do not get attributed to the previous user.
 */
export function resetPostHogIdentity(): void {
  if (!initialized) return;
  posthog.reset();
  identifiedUserId = null;
}

export { posthog };
