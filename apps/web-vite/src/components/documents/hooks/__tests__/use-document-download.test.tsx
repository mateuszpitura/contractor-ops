/**
 * `useDocumentDownload` — imperative presigned-URL download trigger.
 *
 * Covers: success path opens window with the presigned URL, missing URL
 * surfaces a localized error toast, network error surfaces a toast with the
 * error message, and the cached fetchQuery is keyed by documentId.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => createTRPCProxy(),
}));

const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    error: (msg: string) => toastErrorMock(msg),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
} from '../../../../test-utils/render-hook.js';
import { useDocumentDownload } from '../use-document-download.js';

describe('useDocumentDownload', () => {
  let windowOpenMock: ReturnType<typeof vi.fn>;
  const originalOpen = window.open;

  beforeEach(() => {
    toastErrorMock.mockReset();
    windowOpenMock = vi.fn();
    window.open = windowOpenMock as unknown as typeof window.open;
  });

  afterEach(() => {
    clearTRPCMock();
    window.open = originalOpen;
  });

  it('opens the presigned URL in a new tab on success', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => ({ url: 'https://files.example/doc' }),
    });
    const { result } = renderHookWithProviders(() => useDocumentDownload());
    await result.current('doc-1');
    expect(windowOpenMock).toHaveBeenCalledWith(
      'https://files.example/doc',
      '_blank',
      'noopener,noreferrer',
    );
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('surfaces an error toast when the response has no url', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => ({}),
    });
    const { result } = renderHookWithProviders(() => useDocumentDownload());
    await result.current('doc-1');
    expect(windowOpenMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces the error message when the query throws', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useDocumentDownload());
    await result.current('doc-1');
    expect(windowOpenMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith('boom');
  });

  it('passes the documentId through to the query handler', async () => {
    const handler = vi.fn(() => ({ url: 'u' }));
    setTRPCMock({ 'document.getDownloadUrl': handler });
    const { result } = renderHookWithProviders(() => useDocumentDownload());
    await result.current('doc-42');
    expect(handler).toHaveBeenCalledWith({ documentId: 'doc-42' });
  });
});
