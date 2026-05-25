/**
 * `useLoginForm` covers:
 *   - initial idle props bag exposes register + submit handlers
 *   - magic-link aborts when no email is set and shows validation toast
 *   - magic-link success flips isMagicLinkSent + posts redirect callback
 *   - magic-link auth-error response surfaces toast
 *   - onBackFromMagicLink resets the confirmation view
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signInEmailMock, signInMagicLinkMock, sentryCaptureMock, navigateMock, toastErrorMock } =
  vi.hoisted(() => ({
    signInEmailMock: vi.fn(),
    signInMagicLinkMock: vi.fn(),
    sentryCaptureMock: vi.fn(),
    navigateMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    signIn: { email: signInEmailMock, magicLink: signInMagicLinkMock },
  }),
}));

vi.mock('../../../../sentry.js', () => ({
  Sentry: { captureException: (...args: unknown[]) => sentryCaptureMock(...args) },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}));

import { act, renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { useLoginForm } from '../use-login-form.js';

/**
 * Drive a react-hook-form field by going through its `register` ref
 * callback — `register(...).onChange` requires a synthetic event, so we
 * imitate one with the minimum shape the resolver consumes.
 */
async function setField(
  register: ReturnType<typeof useLoginForm>['register'],
  name: 'email' | 'password',
  value: string,
): Promise<void> {
  const reg = register(name);
  await reg.onChange({
    target: { name, value },
    type: 'change',
  } as unknown as React.ChangeEvent<HTMLInputElement>);
}

beforeEach(() => {
  signInEmailMock.mockReset();
  signInMagicLinkMock.mockReset();
  sentryCaptureMock.mockReset();
  navigateMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLoginForm', () => {
  it('returns an idle bag with register + submit helpers', () => {
    const { result } = renderHookWithProviders(() => useLoginForm());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.magicLinkLoading).toBe(false);
    expect(result.current.isMagicLinkSent).toBe(false);
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.onSubmit).toBe('function');
  });

  it('magic-link without email shows a validation toast and skips the mutation', async () => {
    const { result } = renderHookWithProviders(() => useLoginForm());
    await act(async () => {
      await result.current.onMagicLink();
    });
    expect(signInMagicLinkMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalled();
  });

  it('magic-link success flips isMagicLinkSent and forwards the redirect URL', async () => {
    signInMagicLinkMock.mockResolvedValue({ error: null });
    const { result } = renderHookWithProviders(() => useLoginForm());
    await act(async () => {
      await setField(result.current.register, 'email', 'user@example.com');
    });
    await act(async () => {
      await result.current.onMagicLink();
    });
    await waitFor(() => expect(result.current.isMagicLinkSent).toBe(true));
    expect(signInMagicLinkMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      callbackURL: '/',
    });
  });

  it('surfaces an error toast when the magic-link mutation returns an auth error', async () => {
    signInMagicLinkMock.mockResolvedValue({ error: { message: 'rate limited' } });
    const { result } = renderHookWithProviders(() => useLoginForm());
    await act(async () => {
      await setField(result.current.register, 'email', 'user@example.com');
    });
    await act(async () => {
      await result.current.onMagicLink();
    });
    expect(toastErrorMock).toHaveBeenCalledWith('rate limited');
    expect(result.current.isMagicLinkSent).toBe(false);
  });

  it('captures to Sentry when the magic-link mutation throws', async () => {
    signInMagicLinkMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHookWithProviders(() => useLoginForm());
    await act(async () => {
      await setField(result.current.register, 'email', 'user@example.com');
    });
    await act(async () => {
      await result.current.onMagicLink();
    });
    expect(sentryCaptureMock).toHaveBeenCalled();
    expect(sentryCaptureMock.mock.calls[0]?.[1]).toMatchObject({
      tags: { 'auth.flow': 'login.magic_link' },
    });
  });

  it('onBackFromMagicLink leaves isMagicLinkSent false', () => {
    const { result } = renderHookWithProviders(() => useLoginForm());
    act(() => result.current.onBackFromMagicLink());
    expect(result.current.isMagicLinkSent).toBe(false);
  });
});
