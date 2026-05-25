/**
 * `useWorkflowSidePanelRun` — drives the slide-out run summary panel.
 * Covers: disabled (null runId), loading, success, error + handleRetry.
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

const { useWorkflowSidePanelRun } = await import('../use-workflow-ui.js');

const sampleRun = {
  id: 'r1',
  status: 'IN_PROGRESS',
  workflowTemplate: { id: 't1', name: 'Onboarding' },
  contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
  startedAt: '2026-05-01',
  tasks: [],
};

describe('useWorkflowSidePanelRun', () => {
  it('stays idle when runId is null (query disabled)', async () => {
    setTRPCMock({
      'workflow.getRun': () => sampleRun,
    });
    const { result } = renderHookWithProviders(() => useWorkflowSidePanelRun(null));
    expect(result.current.run).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    clearTRPCMock();
  });

  it('reports loading while the run query is pending', () => {
    setTRPCMock({
      'workflow.getRun': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useWorkflowSidePanelRun('r1'));
    expect(result.current.isLoading).toBe(true);
    clearTRPCMock();
  });

  it('surfaces the run on success', async () => {
    setTRPCMock({
      'workflow.getRun': () => sampleRun,
    });
    const { result } = renderHookWithProviders(() => useWorkflowSidePanelRun('r1'));
    await waitFor(() => expect(result.current.run).toBeDefined());
    expect((result.current.run as { id: string }).id).toBe('r1');
    clearTRPCMock();
  });

  it('reports isError and handleRetry refetches', async () => {
    let calls = 0;
    setTRPCMock({
      'workflow.getRun': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowSidePanelRun('r1'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    const before = calls;
    await act(async () => {
      result.current.handleRetry();
    });
    await waitFor(() => expect(calls).toBeGreaterThan(before));
    clearTRPCMock();
  });
});
