/**
 * `useZatcaSubmissionDetail` — resubmit mutation behind the invoice detail
 * panel. Covers initial idle state, success path (toast + status invalidation),
 * and error path (toast.error).
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
import { useZatcaSubmissionDetail } from '../use-zatca-submission-detail.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaSubmissionDetail', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts with isResubmitPending=false (idle)', () => {
    const { result } = renderHookWithProviders(() => useZatcaSubmissionDetail('inv-1'));
    expect(result.current.isResubmitPending).toBe(false);
  });

  it('emits a success toast and invalidates getStatus on a successful resubmit', async () => {
    setTRPCMock({
      'zatca.resubmit': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useZatcaSubmissionDetail('inv-1'),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.resubmit();
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits an error toast when the resubmit mutation rejects', async () => {
    setTRPCMock({
      'zatca.resubmit': () => {
        throw new Error('rejected by ZATCA');
      },
    });
    const { result } = renderHookWithProviders(() => useZatcaSubmissionDetail('inv-1'));

    await act(async () => {
      result.current.resubmit();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
