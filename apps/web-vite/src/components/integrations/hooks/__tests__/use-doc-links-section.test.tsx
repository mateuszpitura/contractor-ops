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

const { useDocLinksSection } = await import('../use-doc-links-section.js');

describe('useDocLinksSection', () => {
  it('loading: list query pending', () => {
    setTRPCMock({ 'docs.list': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    expect(result.current.listQuery.isLoading).toBe(true);
    expect(result.current.docLinks).toEqual([]);
    clearTRPCMock();
  });

  it('empty: resolves []', async () => {
    setTRPCMock({ 'docs.list': () => [] });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    await waitFor(() => expect(result.current.listQuery.isLoading).toBe(false));
    expect(result.current.docLinks).toEqual([]);
    clearTRPCMock();
  });

  it('error: list throws keeps docLinks []', async () => {
    setTRPCMock({
      'docs.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    await waitFor(() => expect(result.current.listQuery.isError).toBe(true));
    expect(result.current.docLinks).toEqual([]);
    clearTRPCMock();
  });

  it('success: exposes docLinks list', async () => {
    const fixture = [
      {
        id: 'l1',
        externalUrl: 'https://example.notion.so/page',
        externalType: 'NOTION_PAGE',
        metadataJson: { title: 'Specs' },
      },
    ];
    setTRPCMock({ 'docs.list': () => fixture });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    await waitFor(() => expect(result.current.listQuery.isLoading).toBe(false));
    expect(result.current.docLinks).toEqual(fixture);
    clearTRPCMock();
  });

  it('detach success: emits toast and clears pendingDetachId', async () => {
    toastSuccess.mockReset();
    const detachCalls: unknown[] = [];
    setTRPCMock({
      'docs.list': () => [],
      'docs.detach': vars => {
        detachCalls.push(vars);
        return { ok: true };
      },
    });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    act(() => result.current.handleRemove('l1'));
    expect(result.current.pendingDetachId).toBe('l1');
    act(() => result.current.confirmRemove());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(detachCalls).toEqual([{ externalLinkId: 'l1' }]);
    expect(result.current.pendingDetachId).toBeNull();
    clearTRPCMock();
  });

  it('detach error: emits error toast', async () => {
    toastError.mockReset();
    setTRPCMock({
      'docs.list': () => [],
      'docs.detach': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    act(() => result.current.handleRemove('l1'));
    act(() => result.current.confirmRemove());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    clearTRPCMock();
  });

  it('refresh: sets refreshingId, invalidates, clears on settle', async () => {
    toastSuccess.mockReset();
    setTRPCMock({
      'docs.list': () => [],
      'docs.refreshMetadata': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useDocLinksSection({ workflowTaskRunId: 'wtr-1' }),
    );
    act(() => result.current.handleRefresh('l1'));
    expect(result.current.refreshingId).toBe('l1');
    await waitFor(() => expect(result.current.refreshingId).toBeNull());
    expect(toastSuccess).toHaveBeenCalled();
    clearTRPCMock();
  });
});
