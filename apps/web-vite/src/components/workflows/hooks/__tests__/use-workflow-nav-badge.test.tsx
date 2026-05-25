/**
 * `useWorkflowNavBadge` — drives the overdue-task badge in the nav rail.
 * Covers: loading (no count yet), empty (count=0), success (count>0), error.
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

const { useWorkflowNavBadge } = await import('../use-workflow-nav-badge.js');

describe('useWorkflowNavBadge', () => {
  it('returns 0 while the query is still loading', () => {
    setTRPCMock({
      'workflow.overdueCount': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useWorkflowNavBadge());
    expect(result.current.count).toBe(0);
    clearTRPCMock();
  });

  it('returns 0 for an empty overdue list', async () => {
    setTRPCMock({
      'workflow.overdueCount': () => ({ count: 0 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowNavBadge());
    await waitFor(() => expect(result.current.count).toBe(0));
    clearTRPCMock();
  });

  it('surfaces the overdue count on success', async () => {
    setTRPCMock({
      'workflow.overdueCount': () => ({ count: 4 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowNavBadge());
    await waitFor(() => expect(result.current.count).toBe(4));
    clearTRPCMock();
  });

  it('falls back to 0 when the query errors', async () => {
    setTRPCMock({
      'workflow.overdueCount': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowNavBadge());
    await waitFor(() => expect(result.current.count).toBe(0));
    clearTRPCMock();
  });
});
