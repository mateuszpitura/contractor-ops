/**
 * `useSkontoApply` — optimistic toggle, mutation success/error,
 * onSkontoToggle prop callback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useSkontoApply } from '../use-skonto-apply.js';

const trpcProxy = createTRPCProxy();

describe('useSkontoApply', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('applied=false initially', () => {
    const { result } = renderHookWithProviders(() =>
      useSkontoApply({ paymentRunItemId: 'item-1' }),
    );
    expect(result.current.applied).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('toggles applied=true, fires mutation, calls onSkontoToggle and shows success toast', async () => {
    const onSkontoToggle = vi.fn();
    setTRPCMock({ 'payment.applySkontoToItem': () => ({ ok: true }) });

    const { result, queryClient } = renderHookWithProviders(() =>
      useSkontoApply({ paymentRunItemId: 'item-1', onSkontoToggle }),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.handleToggle(true);
    });

    expect(result.current.applied).toBe(true);
    expect(onSkontoToggle).toHaveBeenCalledWith('item-1', true);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('reverts optimistic state when mutation fails', async () => {
    const onSkontoToggle = vi.fn();
    setTRPCMock({
      'payment.applySkontoToItem': () => {
        throw new Error('apply-failed');
      },
    });

    const { result } = renderHookWithProviders(() =>
      useSkontoApply({ paymentRunItemId: 'item-1', onSkontoToggle }),
    );

    await act(async () => {
      result.current.handleToggle(true);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    // Second toggle callback fired on rollback path with inverted value
    expect(onSkontoToggle).toHaveBeenCalledTimes(2);
  });
});
