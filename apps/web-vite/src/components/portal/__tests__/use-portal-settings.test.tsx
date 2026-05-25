import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './render-portal-hook.js';

vi.mock('../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const settings = await import('../hooks/use-portal-settings.js');

describe('usePortalProfile', () => {
  it('loading + success: query resolves to profile payload', async () => {
    const profile = {
      displayName: 'Jan Kowalski',
      email: 'jan@example.com',
      phone: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postalCode: null,
      countryCode: 'PL',
      billingProfile: null,
      pendingChangeRequest: null,
    };
    setTRPCMock({ 'portal.getProfile': () => profile });
    const { result } = renderHookWithProviders(() => settings.usePortalProfile());
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual(profile);
    clearTRPCMock();
  });

  it('error: surfaces via isError', async () => {
    setTRPCMock({
      'portal.getProfile': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => settings.usePortalProfile());
    await waitFor(() => expect(result.current.isError).toBe(true));
    clearTRPCMock();
  });
});

describe('usePortalUpdateContactInfo', () => {
  it('success: invalidates profile + emits success toast', async () => {
    toastSuccess.mockClear();
    setTRPCMock({ 'portal.updateContactInfo': () => ({ ok: true }) });
    const { result, queryClient } = renderHookWithProviders(() =>
      settings.usePortalUpdateContactInfo(),
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'Jan' } as never);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('error: emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'portal.updateContactInfo': () => {
        throw new Error('rate limit');
      },
    });
    const { result } = renderHookWithProviders(() => settings.usePortalUpdateContactInfo());
    await act(async () => {
      await result.current.mutateAsync({ displayName: 'X' } as never).catch(() => undefined);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});

describe('usePortalUpdateNotificationPreference', () => {
  it('success: invalidates preferences query', async () => {
    setTRPCMock({ 'portal.updateNotificationPreference': () => ({ ok: true }) });
    const { result, queryClient } = renderHookWithProviders(() =>
      settings.usePortalUpdateNotificationPreference(),
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.current.mutateAsync({
        category: 'INVOICE_UPDATES',
        emailEnabled: false,
      } as never);
    });
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    clearTRPCMock();
  });
});

describe('usePortalLogout', () => {
  it('loading: idle by default', () => {
    setTRPCMock({ 'portal.logout': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() => settings.usePortalLogout());
    expect(result.current.isPending).toBe(false);
    clearTRPCMock();
  });

  it('success: mutateAsync resolves', async () => {
    setTRPCMock({ 'portal.logout': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() => settings.usePortalLogout());
    await expect(result.current.mutateAsync()).resolves.toBeDefined();
    clearTRPCMock();
  });
});
