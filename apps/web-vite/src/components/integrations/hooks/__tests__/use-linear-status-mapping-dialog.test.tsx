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

const { useLinearStatusMappingDialog } = await import('../use-linear-status-mapping-dialog.js');

const baseParams = {
  open: true,
  onOpenChange: () => undefined,
};

describe('useLinearStatusMappingDialog', () => {
  it('loading: connection pending', () => {
    setTRPCMock({
      'linear.connectionStatus': () => new Promise(() => undefined),
      'linear.teams': () => [],
      'linear.getStatusMapping': () => [],
    });
    const { result } = renderHookWithProviders(() => useLinearStatusMappingDialog(baseParams));
    expect(result.current.teamsQuery.isLoading).toBe(false);
    expect(result.current.teams).toEqual([]);
    clearTRPCMock();
  });

  it('empty: no teams keeps selection null', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [],
      'linear.getStatusMapping': () => [],
    });
    const { result } = renderHookWithProviders(() => useLinearStatusMappingDialog(baseParams));
    await waitFor(() => expect(result.current.teamsQuery.isLoading).toBe(false));
    expect(result.current.teams).toEqual([]);
    expect(result.current.selectedTeamId).toBeNull();
    clearTRPCMock();
  });

  it('error: save mutation error emits toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [
        {
          id: 't1',
          name: 'Team',
          key: 'T',
          states: [{ id: 's1', name: 'Todo', type: 'unstarted', color: '#000', position: 0 }],
        },
      ],
      'linear.getStatusMapping': () => [],
      'linear.saveStatusMapping': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useLinearStatusMappingDialog(baseParams));
    await waitFor(() => expect(result.current.teams.length).toBe(1));
    act(() => result.current.setSelectedTeamId('t1'));
    await waitFor(() => expect(result.current.selectedTeam?.id).toBe('t1'));
    act(() => result.current.handleStateSelect('TODO', 's1'));
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: handleStateSelect + save invalidates and emits success toast', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'linear.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'linear.teams': () => [
        {
          id: 't1',
          name: 'Team',
          key: 'T',
          states: [{ id: 's1', name: 'Todo', type: 'unstarted', color: '#000', position: 0 }],
        },
      ],
      'linear.getStatusMapping': () => [],
      'linear.saveStatusMapping': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useLinearStatusMappingDialog({ ...baseParams, onOpenChange }),
    );
    await waitFor(() => expect(result.current.teams.length).toBe(1));
    act(() => result.current.setSelectedTeamId('t1'));
    await waitFor(() => expect(result.current.selectedTeam?.id).toBe('t1'));
    act(() => result.current.handleStateSelect('TODO', 's1'));
    expect(result.current.getMappedStateId('TODO')).toBe('s1');
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveCalls).toHaveLength(1);
    clearTRPCMock();
  });
});
