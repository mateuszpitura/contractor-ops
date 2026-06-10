/**
 * Spec for `useEquipmentRetire`, `useEquipmentUnassign`,
 * `useEquipmentReturnApproval`, `useEquipmentShipmentEvent` — each
 * mutation must emit a success or error toast and chain the onSuccess
 * caller hook.
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
import {
  useEquipmentRetire,
  useEquipmentReturnApproval,
  useEquipmentShipmentEvent,
  useEquipmentUnassign,
} from '../use-equipment-detail-actions.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentRetire', () => {
  it('mutate emits success toast and calls onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.retire': () => ({ id: 'eq1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentRetire({ onSuccess }));
    act(() => result.current.retire('eq1'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it('emits error toast on failure and does not call onSuccess', async () => {
    toastError.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.retire': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentRetire({ onSuccess }));
    act(() => result.current.retire('eq1'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('useEquipmentUnassign', () => {
  it('mutate emits success toast and calls onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.unassign': () => ({ id: 'eq1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentUnassign({ onSuccess }));
    act(() => result.current.unassign('eq1'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'equipment.unassign': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentUnassign());
    act(() => result.current.unassign('eq1'));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});

describe('useEquipmentReturnApproval', () => {
  it('approve emits success toast', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'equipment.approveReturnRequest': () => ({ id: 'rr1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentReturnApproval());
    act(() => {
      result.current.approveMutation.mutate({ id: 'rr1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('reject emits success toast', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'equipment.rejectReturnRequest': () => ({ id: 'rr1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentReturnApproval());
    act(() => {
      result.current.rejectMutation.mutate({ id: 'rr1' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it('approve error emits error toast', async () => {
    toastError.mockClear();
    setTRPCMock({
      'equipment.approveReturnRequest': () => {
        throw new Error('bad');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentReturnApproval());
    act(() => {
      result.current.approveMutation.mutate({ id: 'rr1' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});

describe('useEquipmentShipmentEvent', () => {
  it('mutate emits success toast and calls onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.addShipmentEvent': () => ({ id: 'evt1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipmentEvent({ onSuccess }));
    act(() => {
      result.current.mutation.mutate({ shipmentId: 's1', status: 'PICKED_UP' });
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'equipment.addShipmentEvent': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentShipmentEvent());
    act(() => {
      result.current.mutation.mutate({ shipmentId: 's1', status: 'PICKED_UP' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
