/**
 * Cookie-consent helpers shared between the banner and any caller that needs
 * to gate non-essential SDK initialization (analytics, session replay).
 *
 * GDPR posture: PostHog (the only SDK touched here today) must NOT initialize
 * until the user has accepted the banner. The legacy lift-and-shift wired
 * `initPostHog()` unconditionally at boot in `main.tsx`, which dropped a
 * tracking cookie and fired `app_loaded` before the banner was even visible.
 * This module is the choke-point that prevents that regression — gate every
 * non-essential SDK on `hasCookieConsent()`, and call its `init*()` from
 * `recordCookieConsent()`'s caller after the user clicks accept.
 */

const COOKIE_CONSENT_KEY = 'cookie-consent-acknowledged';

export function hasCookieConsent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(COOKIE_CONSENT_KEY));
  } catch {
    // localStorage access can throw in tightly-locked browsing modes
    // (Safari private, Firefox "Always private"). Treat as no-consent.
    return false;
  }
}

export function recordCookieConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
  } catch {
    // Same lock-down case as above — accept the click in-memory but skip
    // persistence so the banner doesn't refuse to dismiss. A re-visit will
    // re-show the banner, which matches the spec for storage-unavailable
    // browsers.
  }
}
