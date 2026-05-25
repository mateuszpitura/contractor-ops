/**
 * `useInviteAcceptForm` covers:
 *   - idle bag with register + submit helpers
 *   - successful chain navigates to '/' after signUp + acceptInvitation
 *   - signUp error surfaces toast and skips acceptInvitation
 *   - acceptInvitation error surfaces toast and skips navigation
 *   - thrown exception captures to Sentry with the invite_accept tag
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signUpEmailMock, acceptInvitationMock, sentryCaptureMock, navigateMock, toastErrorMock } =
  vi.hoisted(() => ({
    signUpEmailMock: vi.fn(),
    acceptInvitationMock: vi.fn(),
    sentryCaptureMock: vi.fn(),
    navigateMock: vi.fn(),
    toastErrorMock: vi.fn(),
  }));

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    signUp: { email: signUpEmailMock },
    organization: { acceptInvitation: acceptInvitationMock },
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
import { useInviteAcceptForm } from '../use-invite-accept-form.js';

async function setPassword(
  register: ReturnType<typeof useInviteAcceptForm>['register'],
  value: string,
): Promise<void> {
  const reg = register('password');
  await reg.onChange({
    target: { name: 'password', value },
    type: 'change',
  } as unknown as React.ChangeEvent<HTMLInputElement>);
}

const args = { token: 'invite-token-1', email: 'invitee@example.com' };

beforeEach(() => {
  signUpEmailMock.mockReset();
  acceptInvitationMock.mockReset();
  sentryCaptureMock.mockReset();
  navigateMock.mockReset();
  toastErrorMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useInviteAcceptForm', () => {
  it('returns an idle bag with register + submit helpers', () => {
    const { result } = renderHookWithProviders(() => useInviteAcceptForm(args));
    expect(result.current.isLoading).toBe(false);
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.onSubmit).toBe('function');
  });

  it('navigates to / after signUp + acceptInvitation succeed', async () => {
    signUpEmailMock.mockResolvedValue({ error: null });
    acceptInvitationMock.mockResolvedValue({ error: null });
    const { result } = renderHookWithProviders(() => useInviteAcceptForm(args));
    await act(async () => {
      await setPassword(result.current.register, 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/', { replace: true }));
    expect(signUpEmailMock).toHaveBeenCalledWith({
      email: 'invitee@example.com',
      password: 'supersecret',
      name: 'invitee',
    });
    expect(acceptInvitationMock).toHaveBeenCalledWith({ invitationId: 'invite-token-1' });
  });

  it('signUp error surfaces toast and skips acceptInvitation', async () => {
    signUpEmailMock.mockResolvedValue({ error: { message: 'email in use' } });
    const { result } = renderHookWithProviders(() => useInviteAcceptForm(args));
    await act(async () => {
      await setPassword(result.current.register, 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('email in use'));
    expect(acceptInvitationMock).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('acceptInvitation error surfaces toast and skips navigation', async () => {
    signUpEmailMock.mockResolvedValue({ error: null });
    acceptInvitationMock.mockResolvedValue({ error: { message: 'token expired' } });
    const { result } = renderHookWithProviders(() => useInviteAcceptForm(args));
    await act(async () => {
      await setPassword(result.current.register, 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('token expired'));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('captures to Sentry when signUp throws', async () => {
    signUpEmailMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHookWithProviders(() => useInviteAcceptForm(args));
    await act(async () => {
      await setPassword(result.current.register, 'supersecret');
    });
    await act(async () => {
      await result.current.onSubmit({
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      } as unknown as React.FormEvent<HTMLFormElement>);
    });
    await waitFor(() => expect(sentryCaptureMock).toHaveBeenCalled());
    expect(sentryCaptureMock.mock.calls[0]?.[1]).toMatchObject({
      tags: { 'auth.flow': 'invite_accept' },
    });
  });
});
