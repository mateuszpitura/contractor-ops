/**
 * `useDocumentDropZone` — multi-stage upload state machine.
 *
 * Covers: initial empty file list, full success flow (requestUpload →
 * XHR PUT → confirmUpload → scanning), failure mid-upload flips status to
 * 'error', tRPC error surfaces a toast, and removeFile filters by id.
 *
 * The XHR PUT is stubbed via `vi.stubGlobal('XMLHttpRequest', ...)` so the
 * test stays hermetic and finishes in <1s.
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
  act,
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useDocumentDropZone } from '../use-document-drop-zone.js';

interface FakeXhr {
  open: ReturnType<typeof vi.fn>;
  setRequestHeader: ReturnType<typeof vi.fn>;
  send: (body: unknown) => void;
  upload: { onprogress: ((event: ProgressEvent) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  status: number;
}

function installFakeXhr({ status }: { status: number }): FakeXhr[] {
  const created: FakeXhr[] = [];
  class FakeXMLHttpRequest implements FakeXhr {
    open = vi.fn();
    setRequestHeader = vi.fn();
    upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    status = status;
    constructor() {
      created.push(this);
    }
    send() {
      queueMicrotask(() => {
        if (this.status >= 200 && this.status < 300) {
          this.onload?.();
        } else {
          this.onerror?.();
        }
      });
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
  return created;
}

describe('useDocumentDropZone', () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
  });

  afterEach(() => {
    clearTRPCMock();
    vi.unstubAllGlobals();
  });

  it('starts with an empty file list', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() =>
      useDocumentDropZone({ entityType: 'CONTRACTOR', entityId: 'c-1' }),
    );
    expect(result.current.files).toEqual([]);
  });

  it('drives a file from uploading → confirming → scanning on success', async () => {
    installFakeXhr({ status: 200 });
    setTRPCMock({
      'document.requestUpload': () => ({
        documentId: 'doc-1',
        uploadUrl: 'https://r2.example/put',
      }),
      'document.confirmUpload': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useDocumentDropZone({ entityType: 'CONTRACTOR', entityId: 'c-1' }),
    );

    act(() => {
      result.current.onDrop([new File(['hello'], 'a.pdf', { type: 'application/pdf' })]);
    });

    await waitFor(() => expect(result.current.files).toHaveLength(1));
    await waitFor(() => expect(result.current.files[0].status).toBe('scanning'));
    expect(result.current.files[0].progress).toBe(100);
  });

  it('flips status to error when the XHR PUT fails', async () => {
    installFakeXhr({ status: 500 });
    setTRPCMock({
      'document.requestUpload': () => ({
        documentId: 'doc-1',
        uploadUrl: 'https://r2.example/put',
      }),
      'document.confirmUpload': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useDocumentDropZone({ entityType: 'CONTRACTOR', entityId: 'c-1' }),
    );

    act(() => {
      result.current.onDrop([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
    });

    await waitFor(() => expect(result.current.files[0]?.status).toBe('error'));
    expect(result.current.files[0].progress).toBe(0);
  });

  it('surfaces a toast and marks the file errored when requestUpload throws', async () => {
    setTRPCMock({
      'document.requestUpload': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() =>
      useDocumentDropZone({ entityType: 'CONTRACTOR', entityId: 'c-1' }),
    );

    act(() => {
      result.current.onDrop([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
    });

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('forbidden'));
    await waitFor(() => expect(result.current.files[0]?.status).toBe('error'));
  });

  it('removes a file by id', async () => {
    installFakeXhr({ status: 200 });
    setTRPCMock({
      'document.requestUpload': () => ({
        documentId: 'doc-1',
        uploadUrl: 'https://r2.example/put',
      }),
      'document.confirmUpload': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() =>
      useDocumentDropZone({ entityType: 'CONTRACTOR', entityId: 'c-1' }),
    );

    act(() => {
      result.current.onDrop([new File(['x'], 'a.pdf', { type: 'application/pdf' })]);
    });
    await waitFor(() => expect(result.current.files).toHaveLength(1));
    const id = result.current.files[0].id;
    act(() => result.current.removeFile(id));
    expect(result.current.files).toEqual([]);
  });
});
