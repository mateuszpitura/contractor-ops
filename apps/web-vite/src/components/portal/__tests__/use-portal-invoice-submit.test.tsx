import { describe, expect, it, vi } from 'vitest';

import {
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

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { usePortalActiveContracts } = await import('../hooks/use-portal-invoice-submit.js');

describe('usePortalActiveContracts', () => {
  it('loading: pending until contracts resolve', () => {
    setTRPCMock({ 'portal.getActiveContracts': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalActiveContracts());
    expect(result.current.isPending).toBe(true);
    clearTRPCMock();
  });

  it('empty: empty array resolves cleanly', async () => {
    setTRPCMock({ 'portal.getActiveContracts': () => [] });
    const { result } = renderHookWithProviders(() => usePortalActiveContracts());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual([]);
    clearTRPCMock();
  });

  it('error: query failure surfaces via isError', async () => {
    setTRPCMock({
      'portal.getActiveContracts': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalActiveContracts());
    await waitFor(() => expect(result.current.isError).toBe(true));
    clearTRPCMock();
  });

  it('success: returns the contracts list', async () => {
    const fixture = [
      {
        id: 'c1',
        title: 'Engagement A',
        rateValueMinor: 100_000,
        currency: 'EUR',
        rateType: 'HOURLY',
        billingModel: 'TIME_AND_MATERIALS',
      },
    ];
    setTRPCMock({ 'portal.getActiveContracts': () => fixture });
    const { result } = renderHookWithProviders(() => usePortalActiveContracts());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual(fixture);
    clearTRPCMock();
  });
});
