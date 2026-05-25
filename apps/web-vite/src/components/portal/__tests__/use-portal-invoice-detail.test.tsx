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

const { usePortalInvoiceDetail } = await import('../hooks/use-portal-invoice-detail.js');

describe('usePortalInvoiceDetail', () => {
  it('loading: query pending', () => {
    setTRPCMock({ 'portal.getInvoice': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalInvoiceDetail('inv-1'));
    expect(result.current.isLoading).toBe(true);
    clearTRPCMock();
  });

  it('empty/disabled: id missing keeps invoice undefined without error', () => {
    setTRPCMock({ 'portal.getInvoice': () => ({}) });
    const { result } = renderHookWithProviders(() => usePortalInvoiceDetail(''));
    expect(result.current.invoice).toBeUndefined();
    expect(result.current.isError).toBe(false);
    clearTRPCMock();
  });

  it('error not-found: NOT_FOUND code surfaces isNotFound', async () => {
    setTRPCMock({
      'portal.getInvoice': () => {
        const err = Object.assign(new Error('missing'), { data: { code: 'NOT_FOUND' } });
        throw err;
      },
    });
    const { result } = renderHookWithProviders(() => usePortalInvoiceDetail('inv-missing'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(true);
    clearTRPCMock();
  });

  it('success: exposes invoice payload', async () => {
    const fixture = {
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      contract: { id: 'c1', title: 'Engagement A' },
      status: 'UNDER_REVIEW',
      approvalStatus: 'PENDING',
      paymentStatus: 'UNPAID',
      subtotalMinor: 100_000,
      totalMinor: 123_000,
      currency: 'EUR',
      issueDate: '2026-05-01',
      dueDate: '2026-05-31',
      files: [],
      payment: null,
      activityLog: [],
    };
    setTRPCMock({ 'portal.getInvoice': () => fixture });
    const { result } = renderHookWithProviders(() => usePortalInvoiceDetail('inv-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.invoice).toEqual(fixture);
    clearTRPCMock();
  });
});
