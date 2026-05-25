/**
 * `useWorkflowsList` — drives the /workflows page header + empty-state.
 * Covers: loading, empty (no runs, can manage → no empty state),
 * empty (no runs, cannot manage → empty state), success (runs > 0), error.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';

const canMock = vi.fn();

vi.mock('../../../../hooks/use-permissions.js', () => ({
  usePermissions: () => ({ can: canMock, isPlatformAdmin: false }),
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useWorkflowsList } = await import('../use-workflows-list.js');

describe('useWorkflowsList', () => {
  it('reports loading until the runs-count query resolves', () => {
    canMock.mockReturnValue(false);
    setTRPCMock({
      'workflow.listRuns': () => new Promise(() => undefined),
      'contractor.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowsList());
    expect(result.current.isCountLoading).toBe(true);
    expect(result.current.showEmptyState).toBe(false);
    clearTRPCMock();
  });

  it('shows the empty state for unprivileged users with no runs', async () => {
    canMock.mockReturnValue(false);
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowsList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    expect(result.current.showEmptyState).toBe(true);
    expect(result.current.canManageTemplates).toBe(false);
    expect(result.current.runsTotal).toBe(0);
    clearTRPCMock();
  });

  it('hides the empty state for template managers even with zero runs', async () => {
    canMock.mockReturnValue(true);
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [], total: 0 }),
      'contractor.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowsList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    expect(result.current.canManageTemplates).toBe(true);
    expect(result.current.showEmptyState).toBe(false);
    clearTRPCMock();
  });

  it('surfaces total run + contractor counts on success', async () => {
    canMock.mockReturnValue(false);
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [{ id: 'r1' }], total: 7 }),
      'contractor.list': () => ({ items: [], total: 3 }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowsList());
    await waitFor(() => expect(result.current.runsTotal).toBe(7));
    expect(result.current.contractorCount).toBe(3);
    expect(result.current.showEmptyState).toBe(false);
    clearTRPCMock();
  });

  it('treats query errors as zero counts (no empty-state crash)', async () => {
    canMock.mockReturnValue(false);
    setTRPCMock({
      'workflow.listRuns': () => {
        throw new Error('runs boom');
      },
      'contractor.list': () => {
        throw new Error('contractors boom');
      },
    });
    const { result } = renderHookWithProviders(() => useWorkflowsList());
    await waitFor(() => expect(result.current.isCountLoading).toBe(false));
    expect(result.current.runsTotal).toBe(0);
    expect(result.current.contractorCount).toBe(0);
    clearTRPCMock();
  });
});
