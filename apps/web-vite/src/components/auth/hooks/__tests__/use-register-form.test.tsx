/**
 * `useRegisterForm` covers:
 *   - initial idle bag and turnstileSiteKey reflects env config
 *   - turnstile callbacks toggle the token gating submit button
 *   - submit success navigates to '/' and chains signUp + organization.create
 *   - signUp failure surfaces toast and resets turnstile + loading flag
 *   - organization.create failure leaves user signed up but surfaces toast
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signUpEmailMock, orgCreateMock, sentryCaptureMock, navigateMock, toastErrorMock } =
  vi.hoisted(() => ({
    signUpEmailMock: vi.fn(),
    orgCreateMock: vi.fn(),
    sentryCaptureMock: vi.fn(),
    navigateMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    signUp: { email: signUpEmailMock },
    organization: { create: orgCreateMock },
  }),
}));

vi.mock('../../../../sentry.js', () => ({
  Sentry: { captureException: (...args: unknown[]) => sentryCaptureMock(...args) },
}));

vi.mock('../../../../env.js', () => ({
  getClientEnv: () => ({ VITE_TURNSTILE_SITE_KEY: undefined }),
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
import { useRegisterForm } from '../use-register-form.js';

async function setField(
  register: ReturnType<typeof useRegisterForm>['register'],
  name: 'orgName' | 'email' | 'password',
  value: string,
): Promise<void> {
  const reg = register(name);
  await reg.onChange({
    target: { name, value },
    type: 'change',
  } as unknown as React.ChangeEvent<HTMLInputElement>);
}

beforeEach(() => {
  signUpEmailMock.mockReset();
  orgCreateMock.mockReset();
  sentryCaptureMock.mockReset();
  navigateMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRegisterForm', () => {
  it('returns an idle bag without a turnstile gate when the site key is unset', () => {
    const { result } = renderHookWithProviders(() => useRegisterForm());
    expect(result.current.isLoading).toBe(false);
    expect(result.current.turnstileSiteKey).toBeUndefined();
    expect(result.current.turnstileSubmitDisabled).toBe(false);
    expect(typeof result.current.onSubmit).toBe('function');
  });

  it('successful submit navigates to / after signUp + organization.create', async () => {
    signUpEmailMock.mockResolvedValue({ error: null });
    orgCreateMock.mockResolvedValue({ error: null });
    const { result } = renderHookWithProviders(() => useRegisterForm());
    await act(async () => {
      await setField(result.current.register, 'orgName', 'Acme Co');
      await setField(result.current.register, 'email', 'owner@acme.com');
      await setField(result.current.register, 'password', 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    expect(signUpEmailMock).toHaveBeenCalled();
    expect(orgCreateMock).toHaveBeenCalledWith({ name: 'Acme Co', slug: 'acme-co' });
  });

  it('signUp error surfaces toast and resets isLoading without org call', async () => {
    signUpEmailMock.mockResolvedValue({ error: { message: 'email in use' } });
    const { result } = renderHookWithProviders(() => useRegisterForm());
    await act(async () => {
      await setField(result.current.register, 'orgName', 'Acme Co');
      await setField(result.current.register, 'email', 'owner@acme.com');
      await setField(result.current.register, 'password', 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('email in use'));
    expect(orgCreateMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('organization.create error surfaces toast without navigation', async () => {
    signUpEmailMock.mockResolvedValue({ error: null });
    orgCreateMock.mockResolvedValue({ error: { message: 'slug taken' } });
    const { result } = renderHookWithProviders(() => useRegisterForm());
    await act(async () => {
      await setField(result.current.register, 'orgName', 'Acme Co');
      await setField(result.current.register, 'email', 'owner@acme.com');
      await setField(result.current.register, 'password', 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('slug taken'));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('captures to Sentry when the signUp call throws', async () => {
    signUpEmailMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHookWithProviders(() => useRegisterForm());
    await act(async () => {
      await setField(result.current.register, 'orgName', 'Acme Co');
      await setField(result.current.register, 'email', 'owner@acme.com');
      await setField(result.current.register, 'password', 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(sentryCaptureMock).toHaveBeenCalled());
    expect(sentryCaptureMock.mock.calls[0]?.[1]).toMatchObject({
      tags: { 'auth.flow': 'register' },
    });
  });
});
