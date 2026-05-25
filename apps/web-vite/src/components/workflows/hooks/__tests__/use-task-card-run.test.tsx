/**
 * `useTaskCardRun` + popover hooks — drives task-row actions in run detail.
 * Covers: complete mutation success/error,
 *   skip popover state + mutation success/error,
 *   reassign popover lazy users fetch + mutation success.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTaskCardRun, useSkipTaskPopover, useReassignTaskPopover } = await import(
  '../use-task-card-run.js'
);

describe('useTaskCardRun', () => {
  it('exposes complete + skip + reassign sub-hooks', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useTaskCardRun('run-1'));
    expect(typeof result.current.completeMutation.mutate).toBe('function');
    expect(typeof result.current.skip.handleSkip).toBe('function');
    expect(typeof result.current.reassign.handleReassign).toBe('function');
    clearTRPCMock();
  });

  it('completes a task and toasts on success', async () => {
    toastSuccess.mockClear();
    let completeCalls = 0;
    setTRPCMock({
      'workflow.completeTask': () => {
        completeCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useTaskCardRun('run-1'));
    await act(async () => {
      result.current.completeMutation.mutate({ taskRunId: 'task-1' });
    });
    await waitFor(() => expect(completeCalls).toBe(1));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('toasts an error if complete fails', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.completeTask': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTaskCardRun('run-1'));
    await act(async () => {
      result.current.completeMutation.mutate({ taskRunId: 'task-1' });
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});

describe('useSkipTaskPopover', () => {
  it('resets state and toasts on successful skip', async () => {
    toastSuccess.mockClear();
    let skipCalls = 0;
    setTRPCMock({
      'workflow.skipTask': () => {
        skipCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useSkipTaskPopover('run-1'));
    act(() => {
      result.current.setReason('Skipping for testing purposes');
      result.current.setOpen(true);
    });
    await act(async () => {
      result.current.handleSkip('task-1');
    });
    await waitFor(() => expect(skipCalls).toBe(1));
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(result.current.reason).toBe('');
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('toasts an error and keeps the popover open on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.skipTask': () => {
        throw new Error('skip boom');
      },
    });
    const { result } = renderHookWithProviders(() => useSkipTaskPopover('run-1'));
    act(() => {
      result.current.setReason('Reason');
      result.current.setOpen(true);
    });
    await act(async () => {
      result.current.handleSkip('task-1');
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.open).toBe(true);
    clearTRPCMock();
  });
});

describe('useReassignTaskPopover', () => {
  it('does not fetch users until the popover opens', async () => {
    let userCalls = 0;
    setTRPCMock({
      'user.list': () => {
        userCalls += 1;
        return [];
      },
      'workflow.reassignTask': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useReassignTaskPopover('run-1'));
    expect(result.current.members).toEqual([]);
    expect(userCalls).toBe(0);

    act(() => result.current.setOpen(true));
    await waitFor(() => expect(userCalls).toBeGreaterThanOrEqual(1));
    clearTRPCMock();
  });

  it('reassigns and toasts on success', async () => {
    toastSuccess.mockClear();
    let reassignCalls = 0;
    setTRPCMock({
      'user.list': () => [
        { userId: 'u1', name: 'Ada', email: 'ada@x.com' },
        { userId: 'u2', name: 'Linus', email: 'linus@x.com' },
      ],
      'workflow.reassignTask': () => {
        reassignCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useReassignTaskPopover('run-1'));
    act(() => {
      result.current.setOpen(true);
      result.current.setSelectedUserId('u2');
    });
    await waitFor(() => expect(result.current.members.length).toBe(2));
    await act(async () => {
      result.current.handleReassign('task-1');
    });
    await waitFor(() => expect(reassignCalls).toBe(1));
    await waitFor(() => expect(result.current.open).toBe(false));
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });
});
