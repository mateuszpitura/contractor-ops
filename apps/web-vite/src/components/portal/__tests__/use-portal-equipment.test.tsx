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

const { usePortalEquipment } = await import('../hooks/use-portal-equipment.js');

const ASSIGNED_LAPTOP = {
  assignmentId: 'a1',
  assignedAt: '2026-01-01',
  equipment: {
    id: 'e1',
    name: 'MacBook Pro',
    serialNumber: 'SN-12345',
    type: 'LAPTOP',
    status: 'ASSIGNED',
  },
  latestShipment: null,
};

const RETURNED_LAPTOP = {
  ...ASSIGNED_LAPTOP,
  equipment: { ...ASSIGNED_LAPTOP.equipment, status: 'RETURNED' },
};

describe('usePortalEquipment', () => {
  it('loading: pending while equipment query unresolved', () => {
    setTRPCMock({
      'portal.listEquipment': () => new Promise(() => undefined),
      'portal.getReturnStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    expect(result.current.isPending).toBe(true);
    clearTRPCMock();
  });

  it('empty: returns empty list and no returnable items', async () => {
    setTRPCMock({
      'portal.listEquipment': () => [],
      'portal.getReturnStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.equipment).toEqual([]);
    expect(result.current.canReturn).toBe(false);
    expect(result.current.returnableItems).toEqual([]);
    expect(result.current.hasActiveReturn).toBe(false);
    clearTRPCMock();
  });

  it('error: equipment query failure surfaces via isError', async () => {
    setTRPCMock({
      'portal.listEquipment': () => {
        throw new Error('boom');
      },
      'portal.getReturnStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isError).toBe(true);
    clearTRPCMock();
  });

  it('success: derives canReturn + returnableItems for assigned equipment', async () => {
    setTRPCMock({
      'portal.listEquipment': () => [ASSIGNED_LAPTOP, RETURNED_LAPTOP],
      'portal.getReturnStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.canReturn).toBe(true);
    expect(result.current.returnableItems).toEqual([
      { name: 'MacBook Pro', serialNumber: 'SN-12345' },
    ]);
    expect(result.current.hasActiveReturn).toBe(false);
    clearTRPCMock();
  });

  it('active return: hasActiveReturn true for PENDING_APPROVAL status', async () => {
    setTRPCMock({
      'portal.listEquipment': () => [ASSIGNED_LAPTOP],
      'portal.getReturnStatus': () => ({
        id: 'r1',
        status: 'PENDING_APPROVAL',
        shipmentId: null,
        targetPointName: null,
      }),
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.hasActiveReturn).toBe(true));
    clearTRPCMock();
  });

  it('confirmCancelReturn: invalidates queries + toasts on success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'portal.listEquipment': () => [ASSIGNED_LAPTOP],
      'portal.getReturnStatus': () => ({
        id: 'r1',
        status: 'PENDING_APPROVAL',
        shipmentId: null,
        targetPointName: null,
      }),
      'portal.cancelReturn': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.hasActiveReturn).toBe(true));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      result.current.confirmCancelReturn();
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidate).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('confirmCancelReturn: noop when no active return', async () => {
    setTRPCMock({
      'portal.listEquipment': () => [],
      'portal.getReturnStatus': () => null,
      'portal.cancelReturn': () => {
        throw new Error('should not be called');
      },
    });
    const { result } = renderHookWithProviders(() => usePortalEquipment());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    act(() => {
      result.current.confirmCancelReturn();
    });
    expect(result.current.isCancelling).toBe(false);
    clearTRPCMock();
  });
});
