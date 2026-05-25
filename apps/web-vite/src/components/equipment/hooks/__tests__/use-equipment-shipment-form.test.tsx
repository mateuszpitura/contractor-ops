/**
 * Spec for `useEquipmentShipmentForm` — single createShipment mutation
 * with toast emission, onSuccess chaining, and isPending merge.
 */

import { describe, expect, it, vi } from 'vitest';

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
import { useEquipmentShipmentForm } from '../use-equipment-shipment-form.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentShipmentForm', () => {
  it('starts not pending', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useEquipmentShipmentForm({ equipmentId: 'eq1', onSuccess: vi.fn() }),
    );
    expect(result.current.isPending).toBe(false);
  });

  it('create success emits toast and calls onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.createShipment': () => ({ id: 's1' }),
    });
    const { result } = renderHookWithProviders(() =>
      useEquipmentShipmentForm({ equipmentId: 'eq1', onSuccess }),
    );
    act(() => {
      result.current.createMutation.mutate({
        equipmentId: 'eq1',
        direction: 'OUTBOUND',
        carrier: 'manual',
      });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('create error emits error toast and skips onSuccess', async () => {
    toastError.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.createShipment': () => {
        throw new Error('bad address');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useEquipmentShipmentForm({ equipmentId: 'eq1', onSuccess }),
    );
    act(() => {
      result.current.createMutation.mutate({
        equipmentId: 'eq1',
        direction: 'OUTBOUND',
        carrier: 'manual',
      });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
