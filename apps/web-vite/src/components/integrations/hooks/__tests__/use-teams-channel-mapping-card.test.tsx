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

const { useTeamsChannelMappingCard } = await import('../use-teams-channel-mapping-card.js');

describe('useTeamsChannelMappingCard', () => {
  it('loading: teams query pending', () => {
    setTRPCMock({
      'teams.getTeams': () => new Promise(() => undefined),
      'teams.getChannels': () => [],
      'teams.getChannelMapping': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useTeamsChannelMappingCard());
    expect(result.current.teams).toEqual([]);
    clearTRPCMock();
  });

  it('empty: no teams keeps selectedTeamId null', async () => {
    setTRPCMock({
      'teams.getTeams': () => [],
      'teams.getChannels': () => [],
      'teams.getChannelMapping': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useTeamsChannelMappingCard());
    await waitFor(() => expect(result.current.teams).toEqual([]));
    expect(result.current.selectedTeamId).toBeNull();
    clearTRPCMock();
  });

  it('error: save mutation error emits toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'teams.getTeams': () => [{ id: 't1', displayName: 'Team' }],
      'teams.getChannels': () => [{ id: 'ch1', displayName: 'General' }],
      'teams.getChannelMapping': () => ({}),
      'teams.saveChannelMapping': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTeamsChannelMappingCard());
    await waitFor(() => expect(result.current.selectedTeamId).toBe('t1'));
    act(() => result.current.handleChannelSelect('approvals', 'ch1'));
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: single team auto-selects, save calls mutation with mapping', async () => {
    toastSuccess.mockReset();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'teams.getTeams': () => [{ id: 't1', displayName: 'Team' }],
      'teams.getChannels': () => [{ id: 'ch1', displayName: 'General' }],
      'teams.getChannelMapping': () => ({}),
      'teams.saveChannelMapping': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useTeamsChannelMappingCard());
    await waitFor(() => expect(result.current.selectedTeamId).toBe('t1'));
    expect(result.current.channels).toEqual([{ id: 'ch1', displayName: 'General' }]);
    act(() => result.current.handleChannelSelect('approvals', 'ch1'));
    expect(result.current.localMapping).toEqual({ approvals: 'ch1' });
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(saveCalls).toHaveLength(1);
    const first = saveCalls[0] as { mapping: Record<string, string> };
    expect(first.mapping).toEqual({ approvals: 'ch1' });
    clearTRPCMock();
  });
});
