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

const { useGoogleWorkspaceProviderSection } = await import(
  '../use-google-workspace-provider-section.js'
);

describe('useGoogleWorkspaceProviderSection', () => {
  it('loading: health query pending', () => {
    setTRPCMock({ 'integration.getHealth': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() => useGoogleWorkspaceProviderSection());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('empty: null health reports not connected', async () => {
    setTRPCMock({ 'integration.getHealth': () => null });
    const { result } = renderHookWithProviders(() => useGoogleWorkspaceProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('error: query throws keeps not connected', async () => {
    setTRPCMock({
      'integration.getHealth': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useGoogleWorkspaceProviderSection());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isConnected).toBe(false);
    clearTRPCMock();
  });

  it('success: CONNECTED status and onImportClick opens wizard', async () => {
    setTRPCMock({
      'integration.getHealth': () => ({ status: 'CONNECTED', connectionId: 'c1' }),
    });
    const { result } = renderHookWithProviders(() => useGoogleWorkspaceProviderSection());
    await waitFor(() => expect(result.current.isConnected).toBe(true));
    expect(result.current.wizardOpen).toBe(false);
    act(() => result.current.onImportClick());
    expect(result.current.wizardOpen).toBe(true);
    clearTRPCMock();
  });
});
