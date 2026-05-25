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

const { useJiraTaskConfig } = await import('../use-jira-task-config.js');

describe('useJiraTaskConfig', () => {
  it('loading: queries pending', () => {
    setTRPCMock({
      'jira.connectionStatus': () => new Promise(() => undefined),
      'jira.getTaskConfig': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useJiraTaskConfig('tt-1'));
    expect(result.current.jiraEnabled).toBe(false);
    expect(result.current.hasMappingConfigured).toBe(false);
    clearTRPCMock();
  });

  it('empty: no mapping yields notConfigured summary', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'jira.getTaskConfig': () => ({ jiraEnabled: false }),
    });
    const { result } = renderHookWithProviders(() => useJiraTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.config).toBeDefined());
    expect(result.current.hasMappingConfigured).toBe(false);
    expect(typeof result.current.mappingSummary).toBe('string');
    clearTRPCMock();
  });

  it('error: save mutation failure restores previous enabled state', async () => {
    toastError.mockReset();
    setTRPCMock({
      'jira.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'jira.getTaskConfig': () => ({
        jiraEnabled: false,
        jiraProjectId: 'p1',
        jiraProjectName: 'Proj',
        jiraIssueTypeId: 'it1',
        jiraIssueTypeName: 'Bug',
      }),
      'jira.saveTaskConfig': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useJiraTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.hasMappingConfigured).toBe(true));
    act(() => result.current.handleToggle(true));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.jiraEnabled).toBe(false);
    clearTRPCMock();
  });

  it('success: handleToggle calls saveTaskConfig and surfaces toast', async () => {
    toastSuccess.mockReset();
    const saveCalls: unknown[] = [];
    setTRPCMock({
      'jira.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'jira.getTaskConfig': () => ({
        jiraEnabled: false,
        jiraProjectId: 'p1',
        jiraProjectKey: 'PROJ',
        jiraProjectName: 'Proj',
        jiraIssueTypeId: 'it1',
        jiraIssueTypeName: 'Bug',
      }),
      'jira.saveTaskConfig': vars => {
        saveCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() => useJiraTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.hasMappingConfigured).toBe(true));
    act(() => result.current.handleToggle(true));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(saveCalls).toHaveLength(1);
    const first = saveCalls[0] as { taskTemplateId: string };
    expect(first.taskTemplateId).toBe('tt-1');
    clearTRPCMock();
  });

  it('handleToggle no-op when mapping not configured', async () => {
    setTRPCMock({
      'jira.connectionStatus': () => ({ id: 'c1', status: 'CONNECTED' }),
      'jira.getTaskConfig': () => ({ jiraEnabled: false }),
    });
    const { result } = renderHookWithProviders(() => useJiraTaskConfig('tt-1'));
    await waitFor(() => expect(result.current.config).toBeDefined());
    act(() => result.current.handleToggle(true));
    expect(result.current.jiraEnabled).toBe(false);
    clearTRPCMock();
  });
});
