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

const { usePortalLogin } = await import('../hooks/use-portal-login.js');

describe('usePortalLogin', () => {
  it('loading: starts not pending and not sent', () => {
    setTRPCMock({ 'portal.requestMagicLink': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() => usePortalLogin());
    expect(result.current.sent).toBe(false);
    expect(result.current.isPending).toBe(false);
    clearTRPCMock();
  });

  it('empty: resetSent clears sent state and email', async () => {
    setTRPCMock({ 'portal.requestMagicLink': () => ({ ok: true }) });
    const { result } = renderHookWithProviders(() => usePortalLogin());
    await act(async () => {
      await result.current.submitEmail('jan@example.com');
    });
    expect(result.current.sent).toBe(true);
    expect(result.current.sentEmail).toBe('jan@example.com');
    act(() => {
      result.current.resetSent();
    });
    expect(result.current.sent).toBe(false);
    expect(result.current.sentEmail).toBe('');
    clearTRPCMock();
  });

  it('error: mutation failure does not flip sent flag (toast emitted)', async () => {
    toastError.mockClear();
    setTRPCMock({
      'portal.requestMagicLink': () => {
        throw new Error('rate limit');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalLogin());
    await act(async () => {
      await result.current.submitEmail('jan@example.com');
    });
    expect(result.current.sent).toBe(false);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: invalidates portal cache + emits success toast', async () => {
    toastSuccess.mockClear();
    setTRPCMock({ 'portal.requestMagicLink': () => ({ ok: true }) });
    const { result, queryClient } = renderHookWithProviders(() => usePortalLogin());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      await result.current.submitEmail('jan@example.com');
    });
    expect(result.current.sent).toBe(true);
    expect(result.current.sentEmail).toBe('jan@example.com');
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    clearTRPCMock();
  });
});
