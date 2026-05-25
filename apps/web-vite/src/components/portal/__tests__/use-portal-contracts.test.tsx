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
  return {
    useTRPC: () => trpc,
    usePortalTRPC: () => trpc,
  };
});

const { usePortalContracts } = await import('../hooks/use-portal-contracts.js');

describe('usePortalContracts', () => {
  it('reports loading while query is pending', () => {
    setTRPCMock({
      'portal.listContracts': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => usePortalContracts());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.contracts).toBeUndefined();
    clearTRPCMock();
  });

  it('returns empty contracts list for empty data', async () => {
    setTRPCMock({
      'portal.listContracts': () => [],
    });
    const { result } = renderHookWithProviders(() => usePortalContracts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contracts).toEqual([]);
    clearTRPCMock();
  });

  it('exposes contracts from the portal router on success', async () => {
    const fixture = [
      {
        id: 'c1',
        title: 'Engagement A',
        type: 'B2B',
        status: 'ACTIVE',
        startDate: '2026-01-01',
        endDate: null,
        currency: 'EUR',
        rateType: 'MONTHLY',
        rateValueMinor: 500_000,
        contractNumber: 'CN-001',
      },
    ];
    setTRPCMock({
      'portal.listContracts': () => fixture,
    });
    const { result } = renderHookWithProviders(() => usePortalContracts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contracts).toEqual(fixture);
    clearTRPCMock();
  });

  it('does not surface query errors but reports finished loading state', async () => {
    setTRPCMock({
      'portal.listContracts': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalContracts());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contracts).toBeUndefined();
    clearTRPCMock();
  });
});
