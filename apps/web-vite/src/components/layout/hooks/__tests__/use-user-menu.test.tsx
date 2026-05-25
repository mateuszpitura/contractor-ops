/**
 * `useUserMenu` — sidebar UserMenu view-model. Covers:
 *   - loading: session.isPending → isPending true, user null
 *   - empty: session resolved with no user → displayName null, initials fallback
 *   - success: user → displayName, initials derived
 *   - signOut success → navigates to `/${locale}/login`
 *   - signOut error → emits sonner toast.error
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionState: { data: unknown; isPending: boolean } = { data: null, isPending: false };
const signOutMock = vi.fn<(args: unknown) => Promise<{ error: { message: string } | null }>>();

vi.mock('../../../../providers/auth-provider.js', () => ({
  useAuth: () => ({
    useSession: () => sessionState,
    signOut: (args: unknown) => signOutMock(args),
  }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { act, renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { useUserMenu } from '../use-user-menu.js';

const originalLocation = window.location;

beforeEach(() => {
  sessionState.data = null;
  sessionState.isPending = false;
  signOutMock.mockReset();
  toastError.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/en/dashboard', href: 'http://localhost/en/dashboard' },
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

describe('useUserMenu', () => {
  it('reports isPending=true while the session query is loading', () => {
    sessionState.isPending = true;
    const { result } = renderHookWithProviders(() => useUserMenu());
    expect(result.current.isPending).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.displayName).toBeNull();
  });

  it('returns user=null and a fallback display state when the session has no user', () => {
    sessionState.data = { user: null };
    const { result } = renderHookWithProviders(() => useUserMenu());
    expect(result.current.user).toBeNull();
    expect(result.current.displayName).toBeNull();
    expect(typeof result.current.initials).toBe('string');
  });

  it('derives displayName + initials from the user record on success', () => {
    sessionState.data = {
      user: { name: 'Ada Lovelace', email: 'ada@example.com', image: null },
    };
    const { result } = renderHookWithProviders(() => useUserMenu());
    expect(result.current.displayName).toBe('Ada Lovelace');
    expect(result.current.user?.email).toBe('ada@example.com');
    expect(result.current.initials.length).toBeGreaterThan(0);
  });

  it('falls back to the email local-part when only an email is present', () => {
    sessionState.data = { user: { name: null, email: 'bob@example.com', image: null } };
    const { result } = renderHookWithProviders(() => useUserMenu());
    expect(result.current.displayName).toBe('bob');
  });

  it('handleSignOut invokes the auth client and navigates to /${locale}/login on success', async () => {
    sessionState.data = { user: { name: 'Ada', email: 'ada@example.com', image: null } };
    signOutMock.mockImplementation(async (args: unknown) => {
      const { fetchOptions } = args as {
        fetchOptions?: { onSuccess?: () => void };
      };
      fetchOptions?.onSuccess?.();
      return { error: null };
    });
    const { result } = renderHookWithProviders(() => useUserMenu());
    await act(async () => {
      await result.current.handleSignOut();
    });
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/en/login');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('handleSignOut surfaces a sonner error toast when the auth client returns an error', async () => {
    sessionState.data = { user: { name: 'Ada', email: 'ada@example.com', image: null } };
    signOutMock.mockResolvedValue({ error: { message: 'network down' } });
    const { result } = renderHookWithProviders(() => useUserMenu());
    await act(async () => {
      await result.current.handleSignOut();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
  });
});
