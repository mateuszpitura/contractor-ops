/**
 * Spec for `useEquipmentForm` — create/update mutation router with
 * shared onSuccess callback, toast emission, and isPending merge.
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
import { useEquipmentForm } from '../use-equipment-form.js';

const trpcProxy = createTRPCProxy();

const sampleInput = {
  name: 'Laptop',
  serialNumber: 'SN-1',
  type: 'LAPTOP' as const,
};

describe('useEquipmentForm', () => {
  it('starts not pending and exposes submit + mutations', () => {
    setTRPCMock({});
    const onSuccess = vi.fn();
    const { result } = renderHookWithProviders(() => useEquipmentForm({ onSuccess }));
    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.submit).toBe('function');
  });

  it('submit(create) triggers create mutation + success toast + onSuccess', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.create': () => ({ id: 'eq1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentForm({ onSuccess }));
    act(() => {
      result.current.submit(false, undefined, sampleInput);
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('submit(edit) triggers update mutation with id', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    const updateSpy = vi.fn(() => ({ id: 'eq2' }));
    setTRPCMock({
      'equipment.update': updateSpy,
    });
    const { result } = renderHookWithProviders(() => useEquipmentForm({ onSuccess }));
    act(() => {
      result.current.submit(true, 'eq2', sampleInput);
    });
    await waitFor(() => expect(updateSpy).toHaveBeenCalled());
    const callVars = (updateSpy.mock.calls[0] as unknown as [unknown])[0] as { id?: string };
    expect(callVars?.id).toBe('eq2');
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it('emits error toast and skips onSuccess when create fails', async () => {
    toastError.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'equipment.create': () => {
        throw new Error('bad input');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentForm({ onSuccess }));
    act(() => {
      result.current.submit(false, undefined, sampleInput);
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not call create when isEdit=true but equipmentId is missing', () => {
    const onSuccess = vi.fn();
    const createSpy = vi.fn();
    const updateSpy = vi.fn();
    setTRPCMock({
      'equipment.create': createSpy,
      'equipment.update': updateSpy,
    });
    const { result } = renderHookWithProviders(() => useEquipmentForm({ onSuccess }));
    act(() => {
      result.current.submit(true, undefined, sampleInput);
    });
    expect(createSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
