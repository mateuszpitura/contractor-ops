/**
 * `useDocumentCard` — per-card UI state + delete + download orchestration.
 *
 * Covers initial flags (`isPdf` / `isInfected` / `canDownload` /
 * `canUploadNewVersion`), preview/delete dialog state transitions, delete
 * mutation success (toast + invalidation + dialog close), delete mutation
 * error (toast.error), download action, and upload-new-version forwarding.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => createTRPCProxy(),
}));

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (msg: string) => toastSuccessMock(msg),
    error: (msg: string) => toastErrorMock(msg),
    loading: vi.fn(),
  },
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
import type { DocumentListItem } from '../../types.js';
import { useDocumentCard } from '../use-document-card.js';

function makeDoc(overrides: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: 'doc-1',
    originalFileName: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 1024,
    virusScanStatus: 'CLEAN',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    uploadedByUserId: null,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('useDocumentCard', () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
    downloadFnMock.mockClear();
  });

  afterEach(() => {
    clearTRPCMock();
  });

  it('derives isPdf / isInfected / canDownload from the document', () => {
    const { result } = renderHookWithProviders(() => useDocumentCard({ document: makeDoc() }));
    expect(result.current.isPdf).toBe(true);
    expect(result.current.isInfected).toBe(false);
    expect(result.current.canDownload).toBe(true);
  });

  it('marks infected documents as not downloadable', () => {
    const { result } = renderHookWithProviders(() =>
      useDocumentCard({ document: makeDoc({ virusScanStatus: 'INFECTED' }) }),
    );
    expect(result.current.isInfected).toBe(true);
    expect(result.current.canDownload).toBe(false);
  });

  it('gates canUploadNewVersion behind ACTIVE status + onUploadNewVersion prop', () => {
    const onUpload = vi.fn();
    const { result, rerender } = renderHookWithProviders(
      ({ status }: { status: string }) =>
        useDocumentCard({
          document: makeDoc({ status }),
          onUploadNewVersion: onUpload,
        }),
      { initialProps: { status: 'ACTIVE' } },
    );
    expect(result.current.canUploadNewVersion).toBe(true);
    rerender({ status: 'SUPERSEDED' });
    expect(result.current.canUploadNewVersion).toBe(false);
  });

  it('opens and closes the preview dialog via callbacks', () => {
    const { result } = renderHookWithProviders(() => useDocumentCard({ document: makeDoc() }));
    expect(result.current.previewOpen).toBe(false);
    act(() => result.current.onOpenPreview());
    expect(result.current.previewOpen).toBe(true);
    act(() => result.current.onPreviewOpenChange(false));
    expect(result.current.previewOpen).toBe(false);
  });

  it('opens, closes, and clears delete dialog on successful mutation', async () => {
    setTRPCMock({
      'document.delete': () => ({ success: true }),
    });
    const { result } = renderHookWithProviders(() => useDocumentCard({ document: makeDoc() }));
    act(() => result.current.onOpenDelete());
    expect(result.current.deleteOpen).toBe(true);

    act(() => result.current.onConfirmDelete());
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalled());
    expect(result.current.deleteOpen).toBe(false);
    expect(result.current.isDeletePending).toBe(false);
  });

  it('shows toast.error and keeps dialog open on delete error', async () => {
    setTRPCMock({
      'document.delete': () => {
        throw new Error('forbidden');
      },
    });
    const { result } = renderHookWithProviders(() => useDocumentCard({ document: makeDoc() }));
    act(() => result.current.onOpenDelete());
    act(() => result.current.onConfirmDelete());
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('forbidden'));
    expect(result.current.deleteOpen).toBe(true);
  });

  it('forwards the document id to the shared download trigger', () => {
    const { result } = renderHookWithProviders(() =>
      useDocumentCard({ document: makeDoc({ id: 'doc-xyz' }) }),
    );
    act(() => result.current.onDownload());
    expect(downloadFnMock).toHaveBeenCalledWith('doc-xyz');
  });

  it('builds an onUploadNewVersion callback bound to the document id', () => {
    const onUpload = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useDocumentCard({
        document: makeDoc({ id: 'doc-99' }),
        onUploadNewVersion: onUpload,
      }),
    );
    expect(result.current.onUploadNewVersion).toBeDefined();
    result.current.onUploadNewVersion?.();
    expect(onUpload).toHaveBeenCalledWith('doc-99');
  });
});
