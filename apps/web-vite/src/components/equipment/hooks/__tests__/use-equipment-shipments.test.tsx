/**
 * Spec for `useEquipmentShipments` — listShipments query, conditional
 * getShipment detail, deleteShipment mutation + invalidation, and
 * fetchLabel data-url popup behaviour.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useEquipmentShipments } from '../use-equipment-shipments.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentShipments', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  it('starts in loading state with empty shipments array', () => {
    setTRPCMock({
      'equipment.listShipments': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    expect(result.current.listQuery.isLoading).toBe(true);
    expect(result.current.shipments).toEqual([]);
  });

  it('returns shipments on resolved payload', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [{ id: 's1', status: 'IN_TRANSIT' }],
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    await waitFor(() => expect(result.current.listQuery.isLoading).toBe(false));
    expect(result.current.shipments).toHaveLength(1);
  });

  it('skips detail query when no selectedShipmentId', async () => {
    const detailSpy = vi.fn(() => ({ id: 's1' }));
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.getShipment': detailSpy,
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    await waitFor(() => expect(result.current.listQuery.isLoading).toBe(false));
    expect(detailSpy).not.toHaveBeenCalled();
  });

  it('fetches detail when selectedShipmentId is provided', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.getShipment': () => ({ id: 's1', status: 'DELIVERED' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', 's1'));
    await waitFor(() => expect(result.current.detailQuery.data).toBeTruthy());
    expect((result.current.detailQuery.data as { id: string }).id).toBe('s1');
  });

  it('delete mutation emits success toast', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.deleteShipment': () => ({ id: 's1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    act(() => {
      result.current.deleteMutation.mutate({ id: 's1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('delete mutation emits error toast on failure', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.deleteShipment': () => {
        throw new Error('not allowed');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    act(() => {
      result.current.deleteMutation.mutate({ id: 's1' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('fetchLabel opens a data: window for the label', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.getShipmentLabel': () => ({
        contentType: 'application/pdf',
        data: 'BASE64==',
      }),
    });
    const openSpy = vi
      .spyOn(window, 'open')
      .mockImplementation(() => ({ focus: () => undefined }) as any);
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    await act(async () => {
      await result.current.fetchLabel('s1');
    });
    expect(openSpy).toHaveBeenCalled();
    const url = openSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain('data:application/pdf;base64,BASE64==');
    openSpy.mockRestore();
  });

  it('fetchLabel emits an error toast when popup is blocked', async () => {
    setTRPCMock({
      'equipment.listShipments': () => [],
      'equipment.getShipmentLabel': () => ({
        contentType: 'application/pdf',
        data: 'BASE64==',
      }),
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHookWithProviders(() => useEquipmentShipments('eq1', null));
    await act(async () => {
      await result.current.fetchLabel('s1');
    });
    expect(toastError).toHaveBeenCalled();
    openSpy.mockRestore();
  });
});
