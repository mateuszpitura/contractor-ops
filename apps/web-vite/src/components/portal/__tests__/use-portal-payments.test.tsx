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

const { usePortalPayments } = await import('../hooks/use-portal-payments.js');

describe('usePortalPayments', () => {
  it('loading: pending query', () => {
    setTRPCMock({ 'portal.listPayments': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalPayments());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.payments).toBeUndefined();
    clearTRPCMock();
  });

  it('empty: empty list resolves cleanly', async () => {
    setTRPCMock({ 'portal.listPayments': () => [] });
    const { result } = renderHookWithProviders(() => usePortalPayments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.payments).toEqual([]);
    clearTRPCMock();
  });

  it('error: leaves payments undefined when query throws', async () => {
    setTRPCMock({
      'portal.listPayments': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalPayments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.payments).toBeUndefined();
    clearTRPCMock();
  });

  it('success: exposes the payments list', async () => {
    const fixture = [
      {
        id: 'p1',
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-001',
        amountMinor: 250_000,
        currency: 'EUR',
        paidAt: '2026-04-30',
      },
    ];
    setTRPCMock({ 'portal.listPayments': () => fixture });
    const { result } = renderHookWithProviders(() => usePortalPayments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.payments).toEqual(fixture);
    clearTRPCMock();
  });
});
