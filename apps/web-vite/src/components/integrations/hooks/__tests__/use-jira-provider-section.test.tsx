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

const { useJiraProviderSection } = await import('../use-jira-provider-section.js');

describe('useJiraProviderSection', () => {
  it('loading: connection query pending', () => {
    setTRPCMock({ 'jira.connectionStatus': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useJiraProviderSection());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('empty: connection null reports not connected', async () => {
    setTRPCMock({ 'jira.connectionStatus': () => null });
    const { result } = renderHookWithProviders(() => useJiraProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connection).toBeNull();
    clearTRPCMock();
  });

  it('error: marks not connected when query throws', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useJiraProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('success: CONNECTED status flips isConnected and dialog toggle works', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
    });
    const { result } = renderHookWithProviders(() => useJiraProviderSection());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.mappingDialogOpen).toBe(false);
    act(() => result.current.openMappingDialog());
    expect(result.current.mappingDialogOpen).toBe(true);
    clearTRPCMock();
  });
});
