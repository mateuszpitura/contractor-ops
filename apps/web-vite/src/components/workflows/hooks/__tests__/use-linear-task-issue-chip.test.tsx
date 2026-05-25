/**
 * `useLinearTaskIssueChip` — Linear chip for a single workflow task run.
 * Covers: disconnected, no link, success, malformed metadata, error.
 */

import { describe, expect, it, vi } from 'vitest';

import {
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

const { useLinearTaskIssueChip } = await import('../use-linear-task-issue-chip.js');

describe('useLinearTaskIssueChip', () => {
  it('returns chip=null while loading', () => {
    setTRPCMock({
      'linear.connectionStatus': () => new Promise(() => undefined),
      'linear.getLinkedIssue': () => null,
    });
    const { result } = renderHookWithProviders(() => useLinearTaskIssueChip('task-1'));
    expect(result.current.chip).toBeNull();
    clearTRPCMock();
  });

  it('returns chip=null when Linear is disconnected', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => null,
      'linear.getLinkedIssue': () => null,
    });
    const { result } = renderHookWithProviders(() => useLinearTaskIssueChip('task-1'));
    await waitFor(() => expect(result.current.chip).toBeNull());
    clearTRPCMock();
  });

  it('returns chip=null when no Linear issue is linked', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.getLinkedIssue': () => null,
    });
    const { result } = renderHookWithProviders(() => useLinearTaskIssueChip('task-1'));
    await waitFor(() => expect(result.current.chip).toBeNull());
    clearTRPCMock();
  });

  it('builds chip from metadata on success', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => ({ connected: true }),
      'linear.getLinkedIssue': () => ({
        metadata: {
          identifier: 'ENG-7',
          title: 'Ship API',
          status: 'In Progress',
          statusType: 'started',
          url: 'https://linear/ENG-7',
        },
        externalUrl: 'https://linear/ENG-7',
      }),
    });
    const { result } = renderHookWithProviders(() => useLinearTaskIssueChip('task-1'));
    await waitFor(() => expect(result.current.chip).not.toBeNull());
    expect(result.current.chip?.identifier).toBe('ENG-7');
    expect(result.current.chip?.url).toBe('https://linear/ENG-7');
    clearTRPCMock();
  });

  it('returns chip=null on connection-query error', async () => {
    setTRPCMock({
      'linear.connectionStatus': () => {
        throw new Error('boom');
      },
      'linear.getLinkedIssue': () => null,
    });
    const { result } = renderHookWithProviders(() => useLinearTaskIssueChip('task-1'));
    await waitFor(() => expect(result.current.chip).toBeNull());
    clearTRPCMock();
  });
});
