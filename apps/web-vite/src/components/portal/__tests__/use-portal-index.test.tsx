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

const { usePortalIndex } = await import('../hooks/use-portal-index.js');

describe('usePortalIndex', () => {
  it('loading: both queries pending', () => {
    setTRPCMock({
      'portal.overview': () => new Promise(() => undefined),
      'portal.getSession': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => usePortalIndex());
    expect(result.current.isLoading).toBe(true);
    clearTRPCMock();
  });

  it('empty: zero-state overview + session resolve', async () => {
    const overview = {
      activeContracts: 0,
      pendingInvoices: 0,
      recentPaymentsMinor: 0,
      recentPaymentsCurrency: 'EUR',
      upcomingDeadline: null,
      recentActivity: [],
    };
    const session = {
      contractor: { id: 'k1', displayName: 'Kovács Eszter' },
      organization: { id: 'o1', name: 'Org A' },
    };
    setTRPCMock({
      'portal.overview': () => overview,
      'portal.getSession': () => session,
    });
    const { result } = renderHookWithProviders(() => usePortalIndex());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overview).toEqual(overview);
    expect(result.current.session).toEqual(session);
    clearTRPCMock();
  });

  it('error: query errors do not block isLoading from settling', async () => {
    setTRPCMock({
      'portal.overview': () => {
        throw new Error('boom');
      },
      'portal.getSession': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalIndex());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overview).toBeUndefined();
    expect(result.current.session).toBeUndefined();
    clearTRPCMock();
  });

  it('success: populated overview returned alongside session', async () => {
    const overview = {
      activeContracts: 3,
      pendingInvoices: 2,
      recentPaymentsMinor: 750_000,
      recentPaymentsCurrency: 'PLN',
      upcomingDeadline: '2026-06-15',
      recentActivity: [{ event: 'Invoice submitted', timestamp: '2026-05-20' }],
    };
    const session = {
      contractor: { id: 'k1', displayName: 'Müller Anna' },
      organization: { id: 'o1', name: 'Org A' },
    };
    setTRPCMock({
      'portal.overview': () => overview,
      'portal.getSession': () => session,
    });
    const { result } = renderHookWithProviders(() => usePortalIndex());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.overview?.activeContracts).toBe(3);
    expect(result.current.session?.contractor.displayName).toBe('Müller Anna');
    clearTRPCMock();
  });
});
