/**
 * Hook spec for `useKleinunternehmerToggle` — confirm dialog flow for
 * flipping § 19 UStG (DE-only). Toggling opens the confirm dialog; only
 * the explicit `handleConfirm` fires the mutation. Success / error paths
 * emit toasts; onSettled resets the dialog state.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useKleinunternehmerToggle } from '../use-kleinunternehmer-toggle.js';

const trpcProxy = createTRPCProxy();

describe('useKleinunternehmerToggle', () => {
  it('initial state: dialog closed, no pending value, mutation idle', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.pendingValue).toBeNull();
    expect(result.current.mutation.isPending).toBe(false);
  });

  it('handleCheckedChange stages the pending value and opens the dialog', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    act(() => result.current.handleCheckedChange(true));
    expect(result.current.confirmOpen).toBe(true);
    expect(result.current.pendingValue).toBe(true);
  });

  it('handleConfirm without a pending value is a no-op (does not fire mutation)', () => {
    setTRPCMock({
      'organization.setKleinunternehmer': () => {
        throw new Error('should not fire');
      },
    });
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    act(() => result.current.handleConfirm());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('confirm path: success toast + dialog resets', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'organization.setKleinunternehmer': () => ({ isKleinunternehmer: true }),
    });
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    act(() => result.current.handleCheckedChange(true));
    act(() => result.current.handleConfirm());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.pendingValue).toBeNull();
  });

  it('confirm path: error toast on mutation failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'organization.setKleinunternehmer': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    act(() => result.current.handleCheckedChange(false));
    act(() => result.current.handleConfirm());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0]?.[0]).toContain('forbidden');
  });

  it('setConfirmOpen(false) closes the dialog manually', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useKleinunternehmerToggle());
    act(() => result.current.handleCheckedChange(true));
    expect(result.current.confirmOpen).toBe(true);
    act(() => result.current.setConfirmOpen(false));
    expect(result.current.confirmOpen).toBe(false);
  });
});
