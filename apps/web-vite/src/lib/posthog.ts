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
 *
 * posthog-js (~50-60KB gzip) is loaded via a dynamic import inside
 * `initPostHog()` — only after consent — so the SDK stays out of the entry
 * chunk and off the cold-boot critical path.
 */

import type Posthog from 'posthog-js';
import { getClientEnv } from '../env.js';
import { Sentry } from '../sentry.js';
import { hasCookieConsent } from './consent.js';

let ph: typeof Posthog | null = null;
let initialized = false;
let identifiedUserId: string | null = null;

export function initPostHog(): void {
  if (initialized) return;
  if (!hasCookieConsent()) return;
  const env = getClientEnv();
  const key = env.VITE_POSTHOG_KEY;
  if (!key) return;
  // Flip the flag synchronously so a concurrent call cannot double-load, then
  // lazy-import the SDK off the cold-boot critical path.
  initialized = true;
  void import('posthog-js')
    .then(({ default: posthog }) => {
      ph = posthog;
      posthog.init(key, {
        api_host: env.VITE_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        persistence: 'localStorage+cookie',
      });
      posthog.capture('app_loaded');
    })
    .catch((err: unknown) => {
      // Analytics is non-critical; report the chunk-load failure to Sentry
      // rather than dropping it silently.
      Sentry.captureException(err);
    });
}

/**
 * Stitch the current PostHog anonymous distinct id to a signed-in user
 * id. PostHog's `identify()` is idempotent — calling with the same id
 * a second time is a no-op. The first call after sign-in carries the
 * pre-auth anonymous distinct id forward so the conversion funnel
 * (anonymous landing visit → signup → first dashboard load) stays
 * stitched in one user timeline.
 *
 * Safe to call before the SDK has finished loading (e.g. before consent,
 * or while the dynamic import is in flight) — it short-circuits until `ph`
 * is set.
 */
export function identifyPostHogUser(userId: string, properties?: Record<string, unknown>): void {
  if (!ph) return;
  if (!userId) return;
  if (identifiedUserId === userId) return;
  ph.identify(userId, properties);
  identifiedUserId = userId;
}

/**
 * Drop the identified user — call on sign-out so the next session's
 * anonymous events do not get attributed to the previous user.
 */
export function resetPostHogIdentity(): void {
  if (!ph) return;
  ph.reset();
  identifiedUserId = null;
}
