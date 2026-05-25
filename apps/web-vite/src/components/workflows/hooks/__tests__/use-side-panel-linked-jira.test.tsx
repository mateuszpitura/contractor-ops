/**
 * `useSidePanelLinkedJira` — drives the workflow-run side panel's Jira list.
 * Covers: integration disconnected, loading, empty, success, error (retry).
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

const { useSidePanelLinkedJira } = await import('../use-side-panel-linked-jira.js');

describe('useSidePanelLinkedJira', () => {
  it('hides the section when the Jira integration is not connected', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => null,
      'jira.linkedIssues': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedJira('run-1'));
    await waitFor(() => expect(result.current.showSection).toBe(false));
    clearTRPCMock();
  });

  it('reports loading once Jira is connected and issues are pending', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ connected: true }),
      'jira.linkedIssues': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedJira('run-1'));
    await waitFor(() => expect(result.current.showSection).toBe(true));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.issues).toEqual([]);
    clearTRPCMock();
  });

  it('exposes an empty issue list when the API returns none', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ connected: true }),
      'jira.linkedIssues': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedJira('run-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.issues).toEqual([]);
    expect(result.current.isError).toBe(false);
    clearTRPCMock();
  });

  it('surfaces issues on success', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ connected: true }),
      'jira.linkedIssues': () => ({
        items: [
          {
            id: 'i1',
            metadataJson: {
              key: 'OPS-1',
              summary: 'Fix bug',
              status: 'In Progress',
              statusCategory: 'indeterminate',
              url: 'https://jira/OPS-1',
            },
            externalUrl: 'https://jira/OPS-1',
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedJira('run-1'));
    await waitFor(() => expect(result.current.issues.length).toBe(1));
    expect(result.current.issues[0]?.metadataJson.key).toBe('OPS-1');
    clearTRPCMock();
  });

  it('reports isError and handleRetry refetches', async () => {
    let calls = 0;
    setTRPCMock({
      'jira.connectionStatus': () => ({ connected: true }),
      'jira.linkedIssues': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useSidePanelLinkedJira('run-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
