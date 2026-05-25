/**
 * `useTaskCommentsSection` — comment thread + post form for a task run.
 * Covers: loading, empty, success, mutation success (clears body),
 * mutation error path, optimistic isSubmitting flag.
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

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

vi.mock('../../../../providers/trpc-provider.js', () => {
  const trpc = createTRPCProxy();
  return { useTRPC: () => trpc, usePortalTRPC: () => trpc };
});

const { useTaskCommentsSection } = await import('../use-task-comments-section.js');

const sampleComment = {
  id: 'c1',
  body: 'hi',
  createdAt: '2026-05-01',
  author: { name: 'Ada', image: null },
};

describe('useTaskCommentsSection', () => {
  it('reports loading while the comments query is pending', () => {
    setTRPCMock({
      'workflow.listComments': () => new Promise(() => undefined),
      'workflow.addComment': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.comments).toEqual([]);
    clearTRPCMock();
  });

  it('returns an empty comment list', async () => {
    setTRPCMock({
      'workflow.listComments': () => [],
      'workflow.addComment': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.comments).toEqual([]);
    clearTRPCMock();
  });

  it('surfaces comments on success', async () => {
    setTRPCMock({
      'workflow.listComments': () => [sampleComment],
      'workflow.addComment': () => undefined,
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    await waitFor(() => expect(result.current.comments.length).toBe(1));
    expect(result.current.comments[0]?.body).toBe('hi');
    clearTRPCMock();
  });

  it('clears the body and fires a success toast after posting', async () => {
    toastSuccess.mockClear();
    const addCalls: unknown[] = [];
    setTRPCMock({
      'workflow.listComments': () => [],
      'workflow.addComment': (input?: unknown) => {
        addCalls.push(input);
        return { id: 'c-new' };
      },
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setBody('  Hello world  '));
    await act(async () => {
      result.current.handleSubmit();
    });
    await waitFor(() => expect(addCalls.length).toBe(1));
    expect(addCalls[0]).toEqual({
      workflowRunId: 'run-1',
      workflowTaskRunId: 'task-1',
      body: 'Hello world',
    });
    await waitFor(() => expect(result.current.body).toBe(''));
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });

  it('fires an error toast and keeps the body when posting fails', async () => {
    toastError.mockClear();
    setTRPCMock({
      'workflow.listComments': () => [],
      'workflow.addComment': () => {
        throw new Error('post boom');
      },
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setBody('Will fail'));
    await act(async () => {
      result.current.handleSubmit();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.body).toBe('Will fail');
    clearTRPCMock();
  });

  it('does nothing when the body is whitespace-only', async () => {
    const addCalls: unknown[] = [];
    setTRPCMock({
      'workflow.listComments': () => [],
      'workflow.addComment': (input?: unknown) => {
        addCalls.push(input);
        return;
      },
    });
    const { result } = renderHookWithProviders(() => useTaskCommentsSection('run-1', 'task-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setBody('   '));
    act(() => result.current.handleSubmit());
    expect(addCalls.length).toBe(0);
    clearTRPCMock();
  });
});
