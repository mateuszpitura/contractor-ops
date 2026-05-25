import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './_render-hook.js';

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useLinearProviderSection } = await import('../use-linear-provider-section.js');

describe('useLinearProviderSection', () => {
  it('loading: health query pending', () => {
    setTRPCMock({ 'integration.getHealth': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useLinearProviderSection());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('empty: null health reports not connected', async () => {
    setTRPCMock({ 'integration.getHealth': () => null });
    const { result } = renderHookWithProviders(() => useLinearProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.needsReauth).toBe(false);
    clearTRPCMock();
  });

  it('error: query throws keeps not connected', async () => {
    setTRPCMock({
      'integration.getHealth': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useLinearProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('success: PENDING_MAPPING auto-opens mapping dialog', async () => {
    setTRPCMock({
      'integration.getHealth': () => ({ status: 'PENDING_MAPPING', connectionId: 'c1' }),
    });
    const { result } = renderHookWithProviders(() => useLinearProviderSection());
    await waitFor(() => expect(result.current.isPendingMapping).toBe(true));
    expect(result.current.mappingOpen).toBe(true);
    clearTRPCMock();
  });

  it('success: CONNECTED status flips isConnected and openMappingDialog works', async () => {
    setTRPCMock({
      'integration.getHealth': () => ({ status: 'CONNECTED', connectionId: 'c1' }),
    });
    const { result } = renderHookWithProviders(() => useLinearProviderSection());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.mappingOpen).toBe(false);
    act(() => result.current.openMappingDialog());
    expect(result.current.mappingOpen).toBe(true);
    clearTRPCMock();
  });
});
