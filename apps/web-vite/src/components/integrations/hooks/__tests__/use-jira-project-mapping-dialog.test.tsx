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

const { useJiraProjectMappingDialog } = await import('../use-jira-project-mapping-dialog.js');

const baseParams = {
  open: true,
  onOpenChange: () => undefined,
  taskTemplateId: 'tt-1',
  connectionId: 'c1',
};

describe('useJiraProjectMappingDialog', () => {
  it('loading: projects pending', () => {
    setTRPCMock({
      'jira.getTaskConfig': () => new Promise(() => undefined),
      'jira.listProjects': () => new Promise(() => undefined),
      'jira.listIssueTypes': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useJiraProjectMappingDialog(baseParams));
    expect(result.current.projectsQuery.isLoading).toBe(true);
    expect(result.current.projects).toEqual([]);
    clearTRPCMock();
  });

  it('empty: no projects yields empty list', async () => {
    setTRPCMock({
      'jira.getTaskConfig': () => ({ jiraEnabled: false }),
      'jira.listProjects': () => [],
      'jira.listIssueTypes': () => [],
    });
    const { result } = renderHookWithProviders(() => useJiraProjectMappingDialog(baseParams));
    await waitFor(() => expect(result.current.projectsQuery.isLoading).toBe(false));
    expect(result.current.projects).toEqual([]);
    clearTRPCMock();
  });

  it('error: save mutation error emits toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'jira.getTaskConfig': () => ({ jiraEnabled: false }),
      'jira.listProjects': () => [{ id: 'p1', key: 'P', name: 'Proj' }],
      'jira.listIssueTypes': () => [],
      'jira.saveTaskConfig': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useJiraProjectMappingDialog(baseParams));
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: selecting project + save calls saveTaskConfig with payload', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'jira.getTaskConfig': () => ({ jiraEnabled: false }),
      'jira.listProjects': () => [{ id: 'p1', key: 'P', name: 'Proj' }],
      'jira.listIssueTypes': () => [{ id: 'it1', name: 'Bug' }],
      'jira.saveTaskConfig': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useJiraProjectMappingDialog({ ...baseParams, onOpenChange }),
    );
    await waitFor(() => expect(result.current.projects.length).toBe(1));
    act(() => result.current.handleProjectChange('p1'));
    await waitFor(() => expect(result.current.issueTypes.length).toBe(1));
    act(() => result.current.handleIssueTypeChange('it1'));
    act(() => result.current.handleSave());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(saveCalls).toHaveLength(1);
    const first = saveCalls[0] as {
      taskTemplateId: string;
      config: { jiraProjectId?: string; jiraIssueTypeId?: string };
    };
    expect(first.taskTemplateId).toBe('tt-1');
    expect(first.config.jiraProjectId).toBe('p1');
    expect(first.config.jiraIssueTypeId).toBe('it1');
    clearTRPCMock();
  });
});
