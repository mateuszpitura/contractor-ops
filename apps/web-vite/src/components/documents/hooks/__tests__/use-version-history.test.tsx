/**
 * `useVersionHistory` — collapsible per-document version list.
 *
 * Covers: enabled-on-expand gating (no fetch while collapsed), success
 * mapping, error pass-through, and the `onDownloadVersion` proxy that
 * forwards each version's id to the shared download trigger.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => createTRPCProxy(),
}));

const downloadFnMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../use-document-download.js', () => ({
  useDocumentDownload: () => downloadFnMock,
}));

import {
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useVersionHistory } from '../use-version-history.js';

describe('useVersionHistory', () => {
  beforeEach(() => {
    downloadFnMock.mockClear();
  });

  afterEach(() => {
    clearTRPCMock();
  });

  it('does not call the query while collapsed', async () => {
    const handler = vi.fn();
    setTRPCMock({ 'document.getVersionHistory': handler });
    const { result } = renderHookWithProviders(() => useVersionHistory('doc-1'));
    expect(result.current.expanded).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(result.current.versions).toEqual([]);
  });

  it('fetches and exposes versions once toggled open', async () => {
    const handler = vi.fn(() => [
      { id: 'v1', originalFileName: 'a.pdf', createdAt: '2026-01-01', status: 'ACTIVE' },
      { id: 'v2', originalFileName: 'a.pdf', createdAt: '2025-12-01', status: 'SUPERSEDED' },
    ]);
    setTRPCMock({ 'document.getVersionHistory': handler });
    const { result } = renderHookWithProviders(() => useVersionHistory('doc-1'));

    act(() => result.current.onToggle());
    expect(result.current.expanded).toBe(true);

    await waitFor(() => expect(result.current.versions).toHaveLength(2));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('exposes the loading flag while the query resolves', async () => {
    let resolve: ((value: unknown) => void) | undefined;
    setTRPCMock({
      'document.getVersionHistory': () =>
        new Promise(r => {
          resolve = r;
        }),
    });
    const { result } = renderHookWithProviders(() => useVersionHistory('doc-1'));
    act(() => result.current.onToggle());
    await waitFor(() => expect(result.current.isLoading).toBe(true));
    resolve?.([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('forwards version ids to the shared download trigger', () => {
    setTRPCMock({ 'document.getVersionHistory': () => [] });
    const { result } = renderHookWithProviders(() => useVersionHistory('doc-1'));
    result.current.onDownloadVersion('v-77');
    expect(downloadFnMock).toHaveBeenCalledWith('v-77');
  });

  it('keeps versions empty when the query errors', async () => {
    setTRPCMock({
      'document.getVersionHistory': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => useVersionHistory('doc-1'));
    act(() => result.current.onToggle());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.versions).toEqual([]);
  });
});
