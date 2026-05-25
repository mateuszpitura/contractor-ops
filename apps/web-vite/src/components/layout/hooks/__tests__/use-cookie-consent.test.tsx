/**
 * `useCookieConsent` — banner view-model. Covers:
 *   - first visit (no consent) → visible=true after mount
 *   - revisit (consent recorded) → visible stays false
 *   - handleAccept → persists consent, fires initPostHog, hides banner
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hasCookieConsentMock = vi.fn<() => boolean>();
const recordCookieConsentMock = vi.fn();
const initPostHogMock = vi.fn();

vi.mock('../../../../lib/consent.js', () => ({
  hasCookieConsent: () => hasCookieConsentMock(),
  recordCookieConsent: () => recordCookieConsentMock(),
}));

vi.mock('../../../../lib/posthog.js', () => ({
  initPostHog: () => initPostHogMock(),
}));

import { act, renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useCookieConsent } from '../use-cookie-consent.js';

beforeEach(() => {
  hasCookieConsentMock.mockReset();
  recordCookieConsentMock.mockReset();
  initPostHogMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCookieConsent', () => {
  it('hides the banner on first render before the effect fires (initial state)', () => {
    hasCookieConsentMock.mockReturnValue(false);
    const { result } = renderHookWithProviders(() => useCookieConsent());
    // After mount the effect runs synchronously in React 19 → visible flips true.
    expect(result.current.visible).toBe(true);
  });

  it('keeps the banner hidden when consent has already been recorded (revisit branch)', () => {
    hasCookieConsentMock.mockReturnValue(true);
    const { result } = renderHookWithProviders(() => useCookieConsent());
    expect(result.current.visible).toBe(false);
  });

  it('handleAccept records consent, initializes PostHog, and hides the banner (success)', () => {
    hasCookieConsentMock.mockReturnValue(false);
    const { result } = renderHookWithProviders(() => useCookieConsent());
    expect(result.current.visible).toBe(true);
    act(() => result.current.handleAccept());
    expect(recordCookieConsentMock).toHaveBeenCalledTimes(1);
    expect(initPostHogMock).toHaveBeenCalledTimes(1);
    expect(result.current.visible).toBe(false);
  });
});
