/**
 * `useApprovalActions` — wires four approval mutations to toasts + query
 * invalidation. Uses the shared `renderHookWithProviders` harness so the
 * tRPC proxy, QueryClient, and i18n provider are configured identically to
 * production callers.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../providers/trpc-provider.js', () => ({
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
} from '../../test-utils/render-hook.js';
import { useApprovalActions } from '../use-approval-actions.js';

const trpcProxy = createTRPCProxy();

describe('useApprovalActions', () => {
  it('starts with isPending = false and exposes all four actions', () => {
    setTRPCMock({});
    const onSuccess = vi.fn();
    const { result } = renderHookWithProviders(() => useApprovalActions('step-1', onSuccess));
    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.approve).toBe('function');
    expect(typeof result.current.reject).toBe('function');
    expect(typeof result.current.delegate).toBe('function');
    expect(typeof result.current.requestClarification).toBe('function');
  });

  it('approve fires success toast and onSuccess callback', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'approval.approve': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useApprovalActions('step-42', onSuccess));
    act(() => result.current.approve());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Approved.'));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('reject forwards comment and fires success toast', async () => {
    toastSuccess.mockClear();
    const onSuccess = vi.fn();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'approval.reject': handler,
    });
    const { result } = renderHookWithProviders(() => useApprovalActions('step-1', onSuccess));
    act(() => result.current.reject('not aligned'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Rejected.'));
    expect(handler).toHaveBeenCalledWith({ stepId: 'step-1', comment: 'not aligned' });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('delegate forwards delegateToUserId + comment', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'approval.delegate': handler,
    });
    const { result } = renderHookWithProviders(() => useApprovalActions('step-1', vi.fn()));
    act(() => result.current.delegate('user-2', 'pls review'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Delegated.'));
    expect(handler).toHaveBeenCalledWith({
      stepId: 'step-1',
      delegateToUserId: 'user-2',
      comment: 'pls review',
    });
  });

  it('requestClarification forwards comment and fires success toast', async () => {
    toastSuccess.mockClear();
    const handler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'approval.requestClarification': handler,
    });
    const { result } = renderHookWithProviders(() => useApprovalActions('step-1', vi.fn()));
    act(() => result.current.requestClarification('need more context'));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Clarification requested.'));
    expect(handler).toHaveBeenCalledWith({
      stepId: 'step-1',
      comment: 'need more context',
    });
  });

  it('emits error toast and skips onSuccess when mutation throws', async () => {
    toastError.mockClear();
    const onSuccess = vi.fn();
    setTRPCMock({
      'approval.approve': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useApprovalActions('step-1', onSuccess));
    act(() => result.current.approve());
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to approve.'));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
