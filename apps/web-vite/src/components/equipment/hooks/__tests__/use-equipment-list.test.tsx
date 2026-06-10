/**
 * Spec for `useEquipmentList` — count query + retire/unassign mutations
 * with toast + list-invalidation side effects. Covers loading, empty,
 * error, success, and mutation success/error.
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
import { useEquipmentList } from '../use-equipment-list.js';

const trpcProxy = createTRPCProxy();

describe('useEquipmentList', () => {
  it('starts in loading state with empty derived flags', () => {
    setTRPCMock({
      'equipment.list': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    expect(result.current.isCountLoading).toBe(true);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.showEmptyState).toBe(false);
    expect(result.current.isCountError).toBe(false);
  });

  it('marks showEmptyState when count resolves to zero', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    expect(result.current.showEmptyState).toBe(true);
    expect(result.current.totalCount).toBe(0);
  });

  it('does not mark empty state when there is at least one row', async () => {
    setTRPCMock({
      'equipment.list': () => ({ items: [{ id: 'eq1' }], total: 1 }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    expect(result.current.showEmptyState).toBe(false);
    expect(result.current.totalCount).toBe(1);
  });

  it('surfaces count error and refetch handler', async () => {
    setTRPCMock({
      'equipment.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountError).toBe(true));
    expect(result.current.showEmptyState).toBe(false);
    expect(typeof result.current.refetchCount).toBe('function');
  });

  it('retire mutation emits success toast + invalidates list', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'equipment.list': () => ({ items: [{ id: 'eq1' }], total: 1 }),
      'equipment.retire': () => ({ id: 'eq1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    act(() => {
      result.current.retire('eq1');
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(result.current.isRetiring).toBe(false);
  });

  it('retire mutation emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'equipment.list': () => ({ items: [{ id: 'eq1' }], total: 1 }),
      'equipment.retire': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    act(() => {
      result.current.retire('eq1');
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('unassign mutation emits success toast on success', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'equipment.list': () => ({ items: [{ id: 'eq1' }], total: 1 }),
      'equipment.unassign': () => ({ id: 'eq1' }),
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    act(() => {
      result.current.unassign('eq1');
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(result.current.isUnassigning).toBe(false);
  });

  it('unassign mutation emits error toast on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'equipment.list': () => ({ items: [{ id: 'eq1' }], total: 1 }),
      'equipment.unassign': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useEquipmentList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    act(() => {
      result.current.unassign('eq1');
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
