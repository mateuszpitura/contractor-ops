/**
 * `useDocumentList` — entity-scoped document list query.
 *
 * Covers loading → success transition, the derived `isEmpty` flag, error
 * pass-through, and pass-through of the imperative `onUploadNewVersion`
 * action from the shared hook.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => createTRPCProxy(),
}));

const uploadFnMock = vi.fn();
vi.mock('../../../../hooks/use-upload-new-version.js', () => ({
  useUploadNewVersion: () => uploadFnMock,
}));

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useDocumentList } from '../use-document-list.js';

describe('useDocumentList', () => {
  beforeEach(() => {
    uploadFnMock.mockReset();
  });

  afterEach(() => {
    clearTRPCMock();
  });

  it('returns documents and clears isLoading on success', async () => {
    const docs = [
      { id: 'd1', originalFileName: 'a.pdf' },
      { id: 'd2', originalFileName: 'b.pdf' },
    ];
    setTRPCMock({
      'document.list': () => ({ items: docs, total: docs.length }),
    });
    const { result } = renderHookWithProviders(() => useDocumentList('CONTRACTOR', 'c-1'));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toHaveLength(2);
    expect(result.current.isEmpty).toBe(false);
  });

  it('sets isEmpty when the items list is empty', async () => {
    setTRPCMock({
      'document.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useDocumentList('CONTRACTOR', 'c-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.documents).toEqual([]);
  });

  it('keeps isLoading false and surfaces no documents on error', async () => {
    setTRPCMock({
      'document.list': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useDocumentList('CONTRACTOR', 'c-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.documents).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
  });

  it('forwards the documentId to the shared upload-new-version hook', async () => {
    setTRPCMock({
      'document.list': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useDocumentList('CONTRACTOR', 'c-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    result.current.onUploadNewVersion('doc-99');
    expect(uploadFnMock).toHaveBeenCalledWith('doc-99');
  });
});
