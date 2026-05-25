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

const { useNotificationPreferencesSection } = await import(
  '../hooks/use-notification-preferences-section.js'
);

describe('useNotificationPreferencesSection', () => {
  it('loading: starts pending', () => {
    setTRPCMock({
      'portal.getNotificationPreferences': () => new Promise(() => undefined),
      'portal.updateNotificationPreference': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferencesSection());
    expect(result.current.isPending).toBe(true);
    clearTRPCMock();
  });

  it('empty: defaults to true when category has no stored preference', async () => {
    setTRPCMock({
      'portal.getNotificationPreferences': () => [],
      'portal.updateNotificationPreference': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferencesSection());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.getChecked('INVOICE_UPDATES')).toBe(true);
    clearTRPCMock();
  });

  it('success: getChecked reads stored emailEnabled flag', async () => {
    setTRPCMock({
      'portal.getNotificationPreferences': () => [
        { category: 'INVOICE_UPDATES', emailEnabled: false },
        { category: 'PAYMENT_CONFIRMATIONS', emailEnabled: true },
      ],
      'portal.updateNotificationPreference': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferencesSection());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.getChecked('INVOICE_UPDATES')).toBe(false);
    expect(result.current.getChecked('PAYMENT_CONFIRMATIONS')).toBe(true);
    clearTRPCMock();
  });

  it('handleToggle: emits success toast on mutation success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'portal.getNotificationPreferences': () => [],
      'portal.updateNotificationPreference': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferencesSection());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => {
      result.current.handleToggle('INVOICE_UPDATES', false);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('handleToggle: emits error toast on mutation failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'portal.getNotificationPreferences': () => [],
      'portal.updateNotificationPreference': () => {
        throw new Error('rate limit');
      },
    });
    const { result } = renderHookWithProviders(() => useNotificationPreferencesSection());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => {
      result.current.handleToggle('INVOICE_UPDATES', false);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});
