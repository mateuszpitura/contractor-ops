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

const { usePortalReturnFlow } = await import('../hooks/use-portal-return-flow.js');

describe('usePortalReturnFlow', () => {
  it('loading: initial step 1 when no return request', () => {
    setTRPCMock({
      'portal.requestReturn': () => ({ ok: true }),
      'portal.getReturnLabel': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalReturnFlow({
        open: true,
        onOpenChange: () => undefined,
        returnRequest: null,
        onSuccess: () => undefined,
      }),
    );
    expect(result.current.step).toBe(1);
    clearTRPCMock();
  });

  it('empty: step 3 when shipment already created', () => {
    setTRPCMock({
      'portal.requestReturn': () => ({ ok: true }),
      'portal.getReturnLabel': () => ({ data: 'aGVsbG8=', contentType: 'application/pdf' }),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalReturnFlow({
        open: true,
        onOpenChange: () => undefined,
        returnRequest: {
          id: 'r1',
          status: 'SHIPMENT_CREATED',
          shipmentId: 's1',
          targetPointName: 'Paczkomat AB-12',
        },
        onSuccess: () => undefined,
      }),
    );
    expect(result.current.step).toBe(3);
    clearTRPCMock();
  });

  it('error: request mutation failure emits error toast', async () => {
    toastError.mockClear();
    setTRPCMock({
      'portal.requestReturn': () => {
        throw new Error('boom');
      },
      'portal.getReturnLabel': () => ({}),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalReturnFlow({
        open: true,
        onOpenChange: () => undefined,
        returnRequest: null,
        onSuccess: () => undefined,
      }),
    );
    act(() => {
      result.current.setSelectedPoint({ id: 'p1', name: 'Paczkomat', address: 'Address' });
    });
    await act(async () => {
      result.current.handleRequestReturn();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: request mutation success invalidates queries + emits toast + calls onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'portal.requestReturn': () => ({ ok: true }),
      'portal.getReturnLabel': () => ({}),
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      usePortalReturnFlow({
        open: true,
        onOpenChange: () => undefined,
        returnRequest: null,
        onSuccess,
      }),
    );
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => {
      result.current.setSelectedPoint({ id: 'p1', name: 'Paczkomat', address: 'Address' });
    });
    await act(async () => {
      result.current.handleRequestReturn();
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('handleRequestReturn: noop without selected point', async () => {
    const requestSpy = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'portal.requestReturn': requestSpy,
      'portal.getReturnLabel': () => ({}),
    });
    const { result } = renderHookWithProviders(() =>
      usePortalReturnFlow({
        open: true,
        onOpenChange: () => undefined,
        returnRequest: null,
        onSuccess: () => undefined,
      }),
    );
    await act(async () => {
      result.current.handleRequestReturn();
    });
    expect(requestSpy).not.toHaveBeenCalled();
    clearTRPCMock();
  });
});
