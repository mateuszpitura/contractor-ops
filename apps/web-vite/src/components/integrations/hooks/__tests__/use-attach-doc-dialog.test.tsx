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

const { useAttachDocDialog } = await import('../use-attach-doc-dialog.js');

const noop = () => undefined;

describe('useAttachDocDialog', () => {
  it('loading: search query disabled until debounced query has content', () => {
    setTRPCMock({ 'docs.search': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() =>
      useAttachDocDialog({ workflowTaskRunId: 'wtr-1', open: true, onOpenChange: noop }),
    );
    // search is disabled while debouncedQuery is empty
    expect(result.current.results).toEqual([]);
    expect(result.current.searchQuery.isLoading).toBe(false);
    clearTRPCMock();
  });

  it('empty: closed dialog clears local state', () => {
    setTRPCMock({ 'docs.search': () => [] });
    const { result, rerender } = renderHookWithProviders(
      (props: { open: boolean }) =>
        useAttachDocDialog({
          workflowTaskRunId: 'wtr-1',
          open: props.open,
          onOpenChange: noop,
        }),
      { initialProps: { open: true } },
    );
    act(() => result.current.setQuery('hello'));
    expect(result.current.query).toBe('hello');
    rerender({ open: false });
    expect(result.current.query).toBe('');
    clearTRPCMock();
  });

  it('error: attach mutation failure surfaces error toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'docs.search': () => [],
      'docs.attach': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useAttachDocDialog({ workflowTaskRunId: 'wtr-1', open: true, onOpenChange: noop }),
    );
    act(() =>
      result.current.handleSelect({
        id: 'notion-1',
        title: 'Doc',
        subtitle: 'space',
        url: 'https://notion.so/x',
        provider: 'notion',
      }),
    );
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('success: attach mutation closes dialog and emits success toast', async () => {
    toastSuccess.mockReset();
    const onOpenChange = vi.fn();
    const attachCalls: unknown[] = [];
    setTRPCMock({
      'docs.search': () => [],
      'docs.attach': vars => {
        attachCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useAttachDocDialog({ workflowTaskRunId: 'wtr-1', open: true, onOpenChange }),
    );
    act(() =>
      result.current.handleSelect({
        id: 'notion-1',
        title: 'Doc',
        subtitle: 'space',
        url: 'https://notion.so/x',
        provider: 'notion',
        icon: null,
      }),
    );
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(attachCalls).toHaveLength(1);
    const firstCall = attachCalls[0] as { externalType: string; externalUrl: string };
    expect(firstCall.externalType).toBe('NOTION_PAGE');
    expect(firstCall.externalUrl).toBe('https://notion.so/x');
    clearTRPCMock();
  });
});
