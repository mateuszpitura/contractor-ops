/**
 * `useRunHeader` — drives the workflow-run detail page header.
 * Covers: progress derivation, override visibility (permissions + IP task),
 * canCancel rules, cancel + override mutation flow (toast + close).
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

const { useRunHeader, calculateRunProgress, getDaysOverdue } = await import('../use-run-header.js');

const baseRun = {
  id: 'r1',
  status: 'IN_PROGRESS',
  startedAt: '2026-05-01',
  dueAt: null,
  startedByUserId: 'me',
  workflowTemplate: { id: 't1', name: 'Onboarding', type: 'ONBOARDING' },
  contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
  tasks: [{ status: 'DONE' }, { status: 'TODO' }, { status: 'TODO' }, { status: 'TODO' }],
};

describe('calculateRunProgress (pure)', () => {
  it('counts DONE + SKIPPED but ignores condition-skipped tasks', () => {
    const progress = calculateRunProgress([
      { status: 'DONE' },
      { status: 'SKIPPED' },
      { status: 'SKIPPED', resultJson: { skipReason: 'conditionNotMet' } },
      { status: 'TODO' },
    ]);
    expect(progress.done).toBe(2);
    expect(progress.total).toBe(3);
    expect(progress.percent).toBe(67);
  });

  it('returns 0% for an empty active task list', () => {
    const progress = calculateRunProgress([]);
    expect(progress).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe('getDaysOverdue (pure)', () => {
  it('returns 0 for due dates in the future', () => {
    const future = new Date(Date.now() + 86400_000);
    expect(getDaysOverdue(future)).toBe(0);
  });
});

describe('useRunHeader', () => {
  it('derives progress + cancelable + override hidden by default', async () => {
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({ workflow: [] }),
    });
    const { result } = renderHookWithProviders(() => useRunHeader(baseRun));
    await waitFor(() =>
      expect(result.current.progress).toEqual({ done: 1, total: 4, percent: 25 }),
    );
    expect(result.current.canCancel).toBe(true);
    expect(result.current.showOverride).toBe(false);
    clearTRPCMock();
  });

  it('hides cancel for completed runs', async () => {
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({ workflow: [] }),
    });
    const { result } = renderHookWithProviders(() =>
      useRunHeader({ ...baseRun, status: 'COMPLETED' }),
    );
    await waitFor(() => expect(result.current.canCancel).toBe(false));
    clearTRPCMock();
  });

  it('shows override when the user has the permission and an IP task is open', async () => {
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({
        workflow: ['override_blocking_task'],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useRunHeader({
        ...baseRun,
        tasks: [{ status: 'TODO', taskType: 'IP_VERIFICATION' }, { status: 'DONE' }],
      }),
    );
    await waitFor(() => expect(result.current.showOverride).toBe(true));
    clearTRPCMock();
  });

  it('cancel mutation closes the dialog and toasts on success', async () => {
    toastSuccess.mockClear();
    let cancelCalls = 0;
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({ workflow: [] }),
      'workflow.cancelRun': () => {
        cancelCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useRunHeader(baseRun));
    await waitFor(() => expect(result.current.progress.done).toBe(1));
    act(() => result.current.setCancelOpen(true));
    await act(async () => {
      result.current.handleCancel();
    });
    await waitFor(() => expect(cancelCalls).toBe(1));
    await waitFor(() => expect(result.current.cancelOpen).toBe(false));
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('override mutation closes the dialog and toasts on success', async () => {
    toastSuccess.mockClear();
    let overrideCalls = 0;
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({
        workflow: ['override_blocking_task'],
      }),
      'workflow.overrideBlockingTask': () => {
        overrideCalls += 1;
        return;
      },
    });
    const { result } = renderHookWithProviders(() =>
      useRunHeader({
        ...baseRun,
        tasks: [{ status: 'TODO', taskType: 'IP_VERIFICATION' }],
      }),
    );
    await waitFor(() => expect(result.current.showOverride).toBe(true));
    act(() => result.current.setOverrideOpen(true));
    await act(async () => {
      result.current.handleOverride('Reasonable, acknowledged override reason');
    });
    await waitFor(() => expect(overrideCalls).toBe(1));
    await waitFor(() => expect(result.current.overrideOpen).toBe(false));
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('cancel mutation toasts an error on failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'authPermissions.getCurrentUserPermissions': () => ({ workflow: [] }),
      'workflow.cancelRun': () => {
        throw new Error('cancel boom');
      },
    });
    const { result } = renderHookWithProviders(() => useRunHeader(baseRun));
    await waitFor(() => expect(result.current.progress.done).toBe(1));
    await act(async () => {
      result.current.handleCancel();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });
});
