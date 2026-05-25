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

const { usePortalContractDetail } = await import('../hooks/use-portal-contract-detail.js');

describe('usePortalContractDetail', () => {
  it('loading: query is pending when id is set', () => {
    setTRPCMock({ 'portal.getContract': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => usePortalContractDetail('c1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.contract).toBeUndefined();
    clearTRPCMock();
  });

  it('empty/disabled: stays unsettled when id is missing', () => {
    setTRPCMock({ 'portal.getContract': () => ({ id: 'never' }) });
    const { result } = renderHookWithProviders(() => usePortalContractDetail(''));
    // Disabled query: data undefined, no error, isLoading depends on tanstack — flag presence is enough
    expect(result.current.contract).toBeUndefined();
    expect(result.current.isError).toBe(false);
    clearTRPCMock();
  });

  it('error not-found: isNotFound true on NOT_FOUND tRPC code', async () => {
    setTRPCMock({
      'portal.getContract': () => {
        const err = Object.assign(new Error('not found'), {
          data: { code: 'NOT_FOUND' },
        });
        throw err;
      },
    });
    const { result } = renderHookWithProviders(() => usePortalContractDetail('c-missing'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(true);
    clearTRPCMock();
  });

  it('error other: isNotFound false on generic error', async () => {
    setTRPCMock({
      'portal.getContract': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalContractDetail('c1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
    clearTRPCMock();
  });

  it('success: exposes contract', async () => {
    const fixture = {
      id: 'c1',
      title: 'Engagement A',
      contractNumber: 'CN-001',
      type: 'B2B',
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      currency: 'EUR',
      rateType: 'MONTHLY',
      rateValueMinor: 500_000,
      billingModel: 'TIME_AND_MATERIALS',
      paymentTermsDays: 30,
      autoRenewal: false,
      noticePeriodDays: 14,
      ratePeriods: [],
      documents: [],
    };
    setTRPCMock({ 'portal.getContract': () => fixture });
    const { result } = renderHookWithProviders(() => usePortalContractDetail('c1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.contract).toEqual(fixture);
    expect(typeof result.current.handleRetry).toBe('function');
    clearTRPCMock();
  });
});
