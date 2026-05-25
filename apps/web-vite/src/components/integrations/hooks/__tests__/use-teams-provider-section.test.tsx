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

const { useTeamsProviderSection } = await import('../use-teams-provider-section.js');

describe('useTeamsProviderSection', () => {
  it('loading: queries pending', () => {
    setTRPCMock({
      'integration.getHealth': () => new Promise(() => undefined),
      'teams.connectionStatus': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useTeamsProviderSection());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('empty: nulls report not connected', async () => {
    setTRPCMock({
      'integration.getHealth': () => null,
      'teams.connectionStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => useTeamsProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.defaultTeamId).toBeUndefined();
    expect(result.current.defaultFallbackApproverId).toBeNull();
    clearTRPCMock();
  });

  it('error: query throws keeps not connected', async () => {
    setTRPCMock({
      'integration.getHealth': () => {
        throw new Error('boom');
      },
      'teams.connectionStatus': () => null,
    });
    const { result } = renderHookWithProviders(() => useTeamsProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('success: CONNECTED status + configJson defaults + dialog toggle', async () => {
    setTRPCMock({
      'integration.getHealth': () => ({ status: 'CONNECTED' }),
      'teams.connectionStatus': () => ({
        id: 'c1',
        status: 'CONNECTED',
        configJson: { defaultTeamId: 't1', defaultFallbackApproverId: 'u1' },
      }),
    });
    const { result } = renderHookWithProviders(() => useTeamsProviderSection());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.defaultTeamId).toBe('t1');
    expect(result.current.defaultFallbackApproverId).toBe('u1');
    expect(result.current.fallbackOpen).toBe(false);
    act(() => result.current.handleOpenFallback());
    expect(result.current.fallbackOpen).toBe(true);
    clearTRPCMock();
  });
});
