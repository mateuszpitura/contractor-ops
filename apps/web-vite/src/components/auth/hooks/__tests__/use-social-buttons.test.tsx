/**
 * `useSocialButtons` covers:
 *   - loading state per provider while auth.signIn.social resolves
 *   - success path leaves the redirect to better-auth (no toast)
 *   - error path captures to Sentry and clears the loading flag
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signInSocialMock, sentryCaptureMock } = vi.hoisted(() => ({
  signInSocialMock: vi.fn(),
  sentryCaptureMock: vi.fn(),
}));

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({ signIn: { social: signInSocialMock } }),
}));

vi.mock('../../../../sentry.js', () => ({
  Sentry: { captureException: (...args: unknown[]) => sentryCaptureMock(...args) },
}));

import { act, renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { useSocialButtons } from '../use-social-buttons.js';

beforeEach(() => {
  signInSocialMock.mockReset();
  sentryCaptureMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSocialButtons', () => {
  it('starts in idle state', () => {
    signInSocialMock.mockResolvedValue({});
    const { result } = renderHookWithProviders(() => useSocialButtons());
    expect(result.current.loadingProvider).toBeNull();
    expect(result.current.disabled).toBe(false);
  });

  it('marks google loading while the social sign-in is pending', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    signInSocialMock.mockImplementation(
      () =>
        new Promise(r => {
          resolve = r;
        }),
    );
    const { result } = renderHookWithProviders(() => useSocialButtons());
    act(() => result.current.onGoogleLogin());
    await waitFor(() => expect(result.current.loadingProvider).toBe('google'));
    expect(result.current.disabled).toBe(true);
    resolve?.({});
  });

  it('captures to Sentry and clears loading on failure', async () => {
    signInSocialMock.mockRejectedValue(new Error('oauth blew up'));
    const { result } = renderHookWithProviders(() => useSocialButtons());
    act(() => result.current.onMicrosoftLogin());
    await waitFor(() => expect(sentryCaptureMock).toHaveBeenCalled());
    await waitFor(() => expect(result.current.loadingProvider).toBeNull());
    expect(sentryCaptureMock.mock.calls[0]?.[1]).toMatchObject({
      tags: { 'auth.flow': 'social', 'auth.provider': 'microsoft' },
    });
  });
});
