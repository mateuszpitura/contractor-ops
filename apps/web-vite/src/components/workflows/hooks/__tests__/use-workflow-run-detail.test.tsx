/**
 * `useWorkflowRunDetail` — drives the /workflows/:id detail page.
 * Covers: loading, success, not-found (404 code), generic error,
 * handleRetry refetches.
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

vi.mock('../../layout/breadcrumb-context.js', () => ({
  useBreadcrumbOverride: () => undefined,
}));

vi.mock('../../../../lib/auth-client.js', () => ({
  authClient: () => ({ useSession: () => ({ data: { user: { id: 'me' } } }) }),
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useWorkflowRunDetail } = await import('../use-workflow-run-detail.js');

const sampleRun = {
  id: 'r1',
  status: 'IN_PROGRESS',
  workflowTemplate: { id: 't1', name: 'Onboarding', type: 'ONBOARDING' },
  contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
  startedAt: '2026-05-01',
  dueAt: null,
  startedByUserId: 'me',
  tasks: [],
};

describe('useWorkflowRunDetail', () => {
  it('reports loading while the run query is pending', () => {
    setTRPCMock({
      'workflow.getRun': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunDetail('r1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.run).toBeUndefined();
    expect(result.current.currentUserId).toBe('me');
    clearTRPCMock();
  });

  it('surfaces the run on success', async () => {
    setTRPCMock({
      'workflow.getRun': () => sampleRun,
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunDetail('r1'));
    await waitFor(() => expect(result.current.run).toBeDefined());
    expect(result.current.run?.id).toBe('r1');
    expect(result.current.isError).toBe(false);
    clearTRPCMock();
  });

  it('reports isNotFound when the error message includes "not found"', async () => {
    setTRPCMock({
      'workflow.getRun': () => {
        throw new Error('Workflow run not found');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunDetail('missing'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(true);
    clearTRPCMock();
  });

  it('reports a generic error when the error is not a 404', async () => {
    setTRPCMock({
      'workflow.getRun': () => {
        throw new Error('Internal server error');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunDetail('r1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isNotFound).toBe(false);
    clearTRPCMock();
  });

  it('handleRetry triggers a refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'workflow.getRun': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunDetail('r1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
