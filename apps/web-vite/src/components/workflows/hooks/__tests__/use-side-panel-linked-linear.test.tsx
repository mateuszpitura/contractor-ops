/**
 * `useSidePanelLinkedLinear` — Linear sibling of the Jira side-panel hook.
 * Covers: disconnected, loading, empty (section hidden), success, error.
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

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useSidePanelLinkedLinear } = await import('../use-side-panel-linked-linear.js');

describe('useSidePanelLinkedLinear', () => {
  it('hides the section when Linear is disconnected', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => null,
      'linear.linkedIssues': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedLinear('run-1'));
    await waitFor(() => expect(result.current.showSection).toBe(false));
    clearTRPCMock();
  });

  it('shows the section while loading once Linear is connected', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.linkedIssues': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedLinear('run-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    expect(result.current.showSection).toBe(true);
    clearTRPCMock();
  });

  it('hides the section when the API returns no issues', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.linkedIssues': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedLinear('run-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.issues).toEqual([]);
    expect(result.current.showSection).toBe(false);
    clearTRPCMock();
  });

  it('surfaces issues on success', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.linkedIssues': () => ({
        items: [
          {
            id: 'i1',
            metadataJson: {
              identifier: 'ENG-1',
              title: 'Ship feature',
              status: 'In Progress',
              statusType: 'started',
              url: 'https://linear/ENG-1',
            },
            externalUrl: 'https://linear/ENG-1',
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedLinear('run-1'));
    await waitFor(() => expect(result.current.issues.length).toBe(1));
    expect(result.current.showSection).toBe(true);
    clearTRPCMock();
  });

  it('reports error and handleRetry refetches', async () => {
    let calls = 0;
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.linkedIssues': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedLinear('run-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
