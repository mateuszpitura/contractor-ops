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

const { useLinearTaskConfig } = await import('../use-linear-task-config.js');

describe('useLinearTaskConfig', () => {
  it('loading: queries pending', () => {
    setTRPCMock({
      'linear.connectionStatus': () => new Promise(() => undefined),
      'linear.teams': () => [],
      'jira.getTaskConfig': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useLinearTaskConfig('tt-1'));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.linearEnabled).toBe(false);
    clearTRPCMock();
  });

  it('empty: connection ok with no teams keeps selection null', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [],
      'jira.getTaskConfig': () => ({ linearEnabled: false }),
    });
    const { result } = renderHookWithProviders(() => useLinearTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.teams).toEqual([]);
    expect(result.current.selectedTeamId).toBeNull();
    clearTRPCMock();
  });

  it('error: save failure emits toast and reverts state', async () => {
    toastError.mockReset();
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [{ id: 't1', key: 'T', name: 'Team' }],
      'jira.getTaskConfig': () => ({
        linearEnabled: false,
        linearTeamId: 't1',
      }),
      'linear.saveTaskConfig': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useLinearTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.selectedTeamId).toBe('t1'));
    act(() => result.current.handleToggle(true));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.linearEnabled).toBe(false);
    clearTRPCMock();
  });

  it('success: handleToggle saves and emits toast', async () => {
    toastSuccess.mockReset();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [{ id: 't1', key: 'T', name: 'Team' }],
      'jira.getTaskConfig': () => ({
        linearEnabled: false,
        linearTeamId: 't1',
      }),
      'linear.saveTaskConfig': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useLinearTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.selectedTeamId).toBe('t1'));
    act(() => result.current.handleToggle(true));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(saveCalls).toHaveLength(1);
    clearTRPCMock();
  });

  it('handleTeamChange: switches team and saves', async () => {
    toastSuccess.mockReset();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [
        { id: 't1', key: 'T', name: 'Team' },
        { id: 't2', key: 'U', name: 'Other' },
      ],
      'jira.getTaskConfig': () => ({ linearEnabled: false }),
      'linear.saveTaskConfig': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useLinearTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.teams.length).toBe(2));
    act(() => result.current.handleTeamChange('t2'));
    expect(result.current.selectedTeamId).toBe('t2');
    await waitFor(() => expect(saveCalls.length).toBe(1));
    clearTRPCMock();
  });
});
