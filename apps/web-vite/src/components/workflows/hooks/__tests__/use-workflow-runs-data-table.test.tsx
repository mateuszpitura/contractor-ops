/**
 * `useWorkflowRunsDataTable` — drives the Runs tab table on /workflows.
 * Covers: loading, empty, success, filter wiring, pagination,
 * clear-filters reset, error visibility.
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

const { useWorkflowRunsDataTable } = await import('../use-workflow-runs-data-table.js');

const sampleRun = {
  id: 'r1',
  workflowTemplate: { id: 't1', name: 'Onboarding', type: 'ONBOARDING' },
  contractor: { id: 'c1', legalName: 'Acme', displayName: 'Acme' },
  status: 'IN_PROGRESS',
  startedAt: '2026-05-01',
  dueAt: null,
};

describe('useWorkflowRunsDataTable', () => {
  it('reports loading while the runs query is pending', () => {
    setTRPCMock({
      'workflow.listRuns': () => new Promise(() => undefined),
      'workflow.listTemplates': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.totalRows).toBe(0);
    clearTRPCMock();
  });

  it('returns an empty data set when the API has no runs', async () => {
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [], total: 0 }),
      'workflow.listTemplates': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalRows).toBe(0);
    expect(result.current.hasFiltersOrSearch).toBe(false);
    clearTRPCMock();
  });

  it('surfaces runs on success', async () => {
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [sampleRun], total: 1 }),
      'workflow.listTemplates': () => ({ items: [{ id: 't1', name: 'Onboarding' }] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    await waitFor(() => expect(result.current.totalRows).toBe(1));
    expect(result.current.templates).toHaveLength(1);
    clearTRPCMock();
  });

  it('handleFiltersChange + clearFilters round-trip', async () => {
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [], total: 0 }),
      'workflow.listTemplates': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handleFiltersChange({ status: ['IN_PROGRESS'] }));
    await waitFor(() => expect(result.current.filters.status).toEqual(['IN_PROGRESS']));
    expect(result.current.activeFilterCount).toBe(1);
    expect(result.current.hasFiltersOrSearch).toBe(true);

    act(() => result.current.clearFilters());
    await waitFor(() => expect(result.current.filters.status).toEqual([]));
    expect(result.current.activeFilterCount).toBe(0);
    clearTRPCMock();
  });

  it('handlePageChange + handlePageSizeChange update filters', async () => {
    setTRPCMock({
      'workflow.listRuns': () => ({ items: [], total: 0 }),
      'workflow.listTemplates': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.handlePageChange(3));
    await waitFor(() => expect(result.current.filters.page).toBe(3));

    act(() => result.current.handlePageSizeChange(50));
    await waitFor(() => expect(result.current.filters.pageSize).toBe(50));
    expect(result.current.filters.page).toBe(1);
    clearTRPCMock();
  });

  it('falls back to empty data when the API errors', async () => {
    setTRPCMock({
      'workflow.listRuns': () => {
        throw new Error('runs boom');
      },
      'workflow.listTemplates': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() => useWorkflowRunsDataTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.totalRows).toBe(0);
    clearTRPCMock();
  });
});
