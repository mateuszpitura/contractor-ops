/**
 * Hook spec for `useApprovalQueueBulkActions` — bulk approve / reject
 * mutations + invalidation + toast wiring. Covers idle (no pending),
 * success (toast + invalidation + clear-selection), and error (toast
 * error) paths for both mutations.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useApprovalQueueBulkActions } from '../use-approval-queue-bulk-actions.js';

const trpcProxy = createTRPCProxy();

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
});

afterEach(() => {
  clearTRPCMock();
});

describe('useApprovalQueueBulkActions', () => {
  it('initial / idle state: nothing pending', () => {
    setTRPCMock({});
    const onClear = vi.fn();
    const { result } = renderHookWithProviders(() => useApprovalQueueBulkActions(onClear));
    expect(result.current.isBulkApproving).toBe(false);
    expect(result.current.isBulkRejecting).toBe(false);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('onBulkApprove: success path emits toast, clears selection, invalidates list', async () => {
    const approveSpy = vi.fn(() => ({ succeeded: 3, failed: 0 }));
    setTRPCMock({ 'approval.bulkApprove': approveSpy });

    const onClear = vi.fn();
    const { result, queryClient } = renderHookWithProviders(() =>
      useApprovalQueueBulkActions(onClear),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.onBulkApprove(['s1', 's2', 's3']);
    });

    await waitFor(() => expect(approveSpy).toHaveBeenCalledWith({ stepIds: ['s1', 's2', 's3'] }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('toast.bulkApproved');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [['approval', 'listPending']] });
  });

  it('onBulkApprove: error path emits error toast, does not clear selection', async () => {
    setTRPCMock({
      'approval.bulkApprove': () => {
        throw new Error('boom');
      },
    });
    const onClear = vi.fn();
    const { result } = renderHookWithProviders(() => useApprovalQueueBulkActions(onClear));

    act(() => {
      result.current.onBulkApprove(['s1']);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]?.[0]).toContain('errors.failedToApprove');
    expect(onClear).not.toHaveBeenCalled();
  });

  it('onBulkReject: success path forwards comment, clears selection, toast + invalidate', async () => {
    const rejectSpy = vi.fn(() => ({ succeeded: 2, failed: 0 }));
    setTRPCMock({ 'approval.bulkReject': rejectSpy });

    const onClear = vi.fn();
    const { result, queryClient } = renderHookWithProviders(() =>
      useApprovalQueueBulkActions(onClear),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.onBulkReject(['s1', 's2'], 'reason');
    });

    await waitFor(() =>
      expect(rejectSpy).toHaveBeenCalledWith({ stepIds: ['s1', 's2'], comment: 'reason' }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastSuccess.mock.calls[0]?.[0]).toContain('toast.bulkRejected');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [['approval', 'listPending']] });
  });

  it('onBulkReject: error path emits error toast', async () => {
    setTRPCMock({
      'approval.bulkReject': () => {
        throw new Error('boom');
      },
    });
    const onClear = vi.fn();
    const { result } = renderHookWithProviders(() => useApprovalQueueBulkActions(onClear));

    act(() => {
      result.current.onBulkReject(['s1'], 'reason');
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    expect(toastError.mock.calls[0]?.[0]).toContain('errors.failedToReject');
    expect(onClear).not.toHaveBeenCalled();
  });
});
