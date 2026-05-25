import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './_render-hook.js';

vi.mock('../../../../../providers/trpc-provider.js', () => {
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

const { useSyncStatusSection } = await import('../use-sync-status-section.js');

describe('useSyncStatusSection', () => {
  it('loading: sync status pending', () => {
    setTRPCMock({ 'googleWorkspace.syncStatus': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useSyncStatusSection());
    expect(result.current.syncStatusQuery.isLoading).toBe(true);
    expect(result.current.syncStatus).toBeUndefined();
    clearTRPCMock();
  });

  it('empty: null syncStatus surfaces undefined', async () => {
    setTRPCMock({ 'googleWorkspace.syncStatus': () => null });
    const { result } = renderHookWithProviders(() => useSyncStatusSection());
    await waitFor(() => expect(result.current.syncStatusQuery.isLoading).toBe(false));
    expect(result.current.syncStatus).toBeNull();
    clearTRPCMock();
  });

  it('error: triggerSync failure emits error toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'googleWorkspace.syncStatus': () => ({ state: 'IDLE' }),
      'googleWorkspace.triggerSync': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useSyncStatusSection());
    await waitFor(() => expect(result.current.syncStatus).toBeDefined());
    act(() => result.current.handleTriggerSync());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: triggerSync invokes mutation and emits toast', async () => {
    toastSuccess.mockReset();
    const calls: unknown[] = [];
    setTRPCMock({
      'googleWorkspace.syncStatus': () => ({ state: 'IDLE' }),
      'googleWorkspace.triggerSync': vars => {
        calls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useSyncStatusSection());
    await waitFor(() => expect(result.current.syncStatus).toBeDefined());
    act(() => result.current.handleTriggerSync());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(calls).toHaveLength(1);
    clearTRPCMock();
  });
});
