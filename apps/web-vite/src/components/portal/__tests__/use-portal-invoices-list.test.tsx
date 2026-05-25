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

const { usePortalInvoicesList } = await import('../hooks/use-portal-invoices-list.js');

describe('usePortalInvoicesList', () => {
  it('loading: pending state', () => {
    setTRPCMock({ 'portal.listInvoices': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalInvoicesList());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.invoices).toBeUndefined();
    clearTRPCMock();
  });

  it('empty: returns empty list', async () => {
    setTRPCMock({ 'portal.listInvoices': () => [] });
    const { result } = renderHookWithProviders(() => usePortalInvoicesList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toEqual([]);
    clearTRPCMock();
  });

  it('error: invoices stays undefined when query throws', async () => {
    setTRPCMock({
      'portal.listInvoices': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalInvoicesList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toBeUndefined();
    clearTRPCMock();
  });

  it('success: exposes invoices', async () => {
    const invoices = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        contract: { id: 'c1', title: 'Engagement A' },
        status: 'UNDER_REVIEW',
        approvalStatus: 'PENDING',
        paymentStatus: 'UNPAID',
        totalMinor: 500_000,
        currency: 'EUR',
        receivedAt: '2026-05-01',
      },
    ];
    setTRPCMock({ 'portal.listInvoices': () => invoices });
    const { result } = renderHookWithProviders(() => usePortalInvoicesList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoices).toEqual(invoices);
    clearTRPCMock();
  });
});
