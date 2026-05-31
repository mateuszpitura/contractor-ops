/**
 * Landing cookie-consent state shared between PostHogProvider and the
 * banner UI.
 *
 * Soft-consent model:
 * - Anonymous pageviews fire from first paint (no cookie set yet) so we
 *   keep funnel data above the consent floor.
 * - Autocapture, session recording, and identified events stay off until
 *   the visitor accepts.
 * - Rejecting persists the choice; pageviews continue but no other PostHog
 *   feature is enabled.
 *
 * Persistence: localStorage `landing_consent` = 'accepted' | 'rejected' +
 * ISO timestamp. 12-month re-prompt cadence checked at read time.
 */

export type ConsentState = 'unknown' | 'accepted' | 'rejected';

const STORAGE_KEY = 'landing_consent';
const TIMESTAMP_KEY = 'landing_consent_at';
const REPROMPT_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

export function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const value = window.localStorage.getItem(STORAGE_KEY) as ConsentState | null;
    const at = window.localStorage.getItem(TIMESTAMP_KEY);
    if (!(value && at)) return 'unknown';
    const expiresAt = Number.parseInt(at, 10) + REPROMPT_AFTER_MS;
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) return 'unknown';
    return value;
  } catch {
    return 'unknown';
  }
}

export function writeConsent(state: Exclude<ConsentState, 'unknown'>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
    window.localStorage.setItem(TIMESTAMP_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent<ConsentState>('landing-consent', { detail: state }));
    // safe-swallow: consent persistence blocked (Safari ITP/private mode); banner re-prompts next visit
  } catch {
    // localStorage may be blocked (Safari ITP, private mode); silently
    // degrade — banner re-prompts next visit.
  }
}

export function subscribeConsent(listener: (state: ConsentState) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<ConsentState>).detail;
    listener(detail);
  };
  window.addEventListener('landing-consent', handler);
  return () => window.removeEventListener('landing-consent', handler);
}
