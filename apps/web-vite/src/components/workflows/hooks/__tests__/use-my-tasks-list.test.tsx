/**
 * `useMyTasksList` — drives the "My Tasks" tab on /workflows.
 * Covers: loading, empty list, error (handleRetry refetches), success,
 * and the overdue toggle wiring (filter flips, query re-issues).
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

const { useMyTasksList } = await import('../use-my-tasks-list.js');

const sampleTask = {
  id: 't1',
  title: 'Collect NDA',
  status: 'TODO',
  taskType: 'DOCUMENT_COLLECTION',
  dueAt: '2026-04-10',
  isOverdue: false,
  workflowRun: {
    id: 'run-1',
    status: 'IN_PROGRESS',
    contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
    workflowTemplate: { name: 'Onboarding', type: 'ONBOARDING' },
  },
};

describe('useMyTasksList', () => {
  it('reports loading and an empty list while the query is pending', () => {
    setTRPCMock({
      'workflow.myTasks': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useMyTasksList());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.tasks).toEqual([]);
    clearTRPCMock();
  });

  it('returns an empty task list when the API has no items', async () => {
    setTRPCMock({
      'workflow.myTasks': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useMyTasksList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isError).toBe(false);
    clearTRPCMock();
  });

  it('exposes tasks when the API returns items', async () => {
    setTRPCMock({
      'workflow.myTasks': () => ({ items: [sampleTask], total: 1 }),
    });
    const { result } = renderHookWithProviders(() => useMyTasksList());
    await waitFor(() => expect(result.current.tasks.length).toBe(1));
    expect(result.current.tasks[0]?.title).toBe('Collect NDA');
    clearTRPCMock();
  });

  it('flips overdueOnly and re-issues the query with overdueOnly=true', async () => {
    let lastInput: { overdueOnly?: boolean } | undefined;
    setTRPCMock({
      'workflow.myTasks': (input?: unknown) => {
        lastInput = input as { overdueOnly?: boolean };
        return { items: [], total: 0 };
      },
    });
    const { result } = renderHookWithProviders(() => useMyTasksList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(lastInput?.overdueOnly).toBeUndefined();

    act(() => result.current.setOverdueOnly(true));

    await waitFor(() => expect(result.current.overdueOnly).toBe(true));
    await waitFor(() => expect(lastInput?.overdueOnly).toBe(true));
    clearTRPCMock();
  });

  it('reports isError and exposes handleRetry on failure', async () => {
    let calls = 0;
    setTRPCMock({
      'workflow.myTasks': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useMyTasksList());
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
