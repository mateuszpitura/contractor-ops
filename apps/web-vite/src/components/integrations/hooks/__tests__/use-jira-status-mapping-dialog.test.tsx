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

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const { useJiraStatusMappingDialog } = await import('../use-jira-status-mapping-dialog.js');

const baseParams = {
  open: true,
  onOpenChange: () => undefined,
  connectionId: 'c1',
};

describe('useJiraStatusMappingDialog', () => {
  it('loading: projects query pending', () => {
    setTRPCMock({
      'jira.listProjects': () => new Promise(() => undefined),
      'jira.listProjectStatuses': () => [],
      'jira.getStatusMapping': () => [],
    });
    const { result } = renderHookWithProviders(() => useJiraStatusMappingDialog(baseParams));
    expect(result.current.projectsQuery.isLoading).toBe(true);
    expect(result.current.projects).toEqual([]);
    clearTRPCMock();
  });

  it('empty: no projects yields empty selection', async () => {
    setTRPCMock({
      'jira.listProjects': () => [],
      'jira.listProjectStatuses': () => [],
      'jira.getStatusMapping': () => [],
    });
    const { result } = renderHookWithProviders(() => useJiraStatusMappingDialog(baseParams));
    await waitFor(() => expect(result.current.projectsQuery.isLoading).toBe(false));
    expect(result.current.projects).toEqual([]);
    expect(result.current.selectedProjectId).toBeNull();
    clearTRPCMock();
  });

  it('error: save mutation emits error toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'jira.listProjects': () => [{ id: 'p1', key: 'P', name: 'Proj' }],
      'jira.listProjectStatuses': () => [
        { id: 's1', name: 'Todo', statusCategory: { key: 'new', name: 'New' } },
      ],
      'jira.getStatusMapping': () => [],
      'jira.saveStatusMapping': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useJiraStatusMappingDialog(baseParams));
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    act(() => result.current.setSelectedProjectId('p1'));
    await waitFor(() => expect(result.current.jiraStatuses.length).toBe(1));
    act(() => result.current.handleStatusSelect('TODO', 's1'));
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: handleStatusSelect + save invalidates and emits success toast', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'jira.listProjects': () => [{ id: 'p1', key: 'P', name: 'Proj' }],
      'jira.listProjectStatuses': () => [
        { id: 's1', name: 'Todo', statusCategory: { key: 'new', name: 'New' } },
      ],
      'jira.getStatusMapping': () => [],
      'jira.saveStatusMapping': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useJiraStatusMappingDialog({ ...baseParams, onOpenChange }),
    );
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    act(() => result.current.setSelectedProjectId('p1'));
    await waitFor(() => expect(result.current.jiraStatuses.length).toBe(1));
    act(() => result.current.handleStatusSelect('TODO', 's1'));
    expect(result.current.getMappedJiraStatusId('TODO')).toBe('s1');
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveCalls).toHaveLength(1);
    clearTRPCMock();
  });
});
