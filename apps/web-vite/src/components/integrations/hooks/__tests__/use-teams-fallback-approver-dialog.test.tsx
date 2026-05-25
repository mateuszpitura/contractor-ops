import { describe, expect, it, vi } from 'vitest';

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from './_render-hook.js';

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { useTeamsFallbackApproverDialog } = await import('../use-teams-fallback-approver-dialog.js');

describe('useTeamsFallbackApproverDialog', () => {
  it('loading: initial state seeds selectedUserId from prop', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useTeamsFallbackApproverDialog({
        teamId: 't1',
        currentFallbackApproverId: 'u1',
        open: true,
        onOpenChange: () => undefined,
      }),
    );
    expect(result.current.selectedUserId).toBe('u1');
    clearTRPCMock();
  });

  it('empty: no current id leaves selection undefined', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useTeamsFallbackApproverDialog({
        teamId: 't1',
        currentFallbackApproverId: null,
        open: true,
        onOpenChange: () => undefined,
      }),
    );
    expect(result.current.selectedUserId).toBeUndefined();
    clearTRPCMock();
  });

  it('error: mutation failure emits error toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'teams.setFallbackApprover': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useTeamsFallbackApproverDialog({
        teamId: 't1',
        currentFallbackApproverId: 'u1',
        open: true,
        onOpenChange: () => undefined,
      }),
    );
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: handleSave invokes mutation + closes; handleClear sends null id', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const calls: unknown[] = [];
    setTRPCMock({
      'teams.setFallbackApprover': vars => {
        calls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useTeamsFallbackApproverDialog({
        teamId: 't1',
        currentFallbackApproverId: 'u1',
        open: true,
        onOpenChange,
      }),
    );
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(calls[0]).toEqual({ teamId: 't1', fallbackApproverId: 'u1' });

    act(() => result.current.handleClear());
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1]).toEqual({ teamId: 't1', fallbackApproverId: null });
    clearTRPCMock();
  });

  it('handleSave no-op when nothing selected', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useTeamsFallbackApproverDialog({
        teamId: 't1',
        currentFallbackApproverId: null,
        open: true,
        onOpenChange: () => undefined,
      }),
    );
    act(() => result.current.handleSave());
    expect(result.current.setFallbackMutation.isPending).toBe(false);
    clearTRPCMock();
  });
});
