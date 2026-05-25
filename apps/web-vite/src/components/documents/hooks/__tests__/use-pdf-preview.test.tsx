/**
 * `usePdfPreview` — dialog-driven presigned URL loader for PDF previews.
 *
 * Covers: lazy fetch (no request while closed), success → pdfUrl set, error
 * → pdfUrl null, loading-flag transitions, and reset behavior when the
 * dialog closes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => createTRPCProxy(),
}));

import {
  clearTRPCMock,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { usePdfPreview } from '../use-pdf-preview.js';

describe('usePdfPreview', () => {
  beforeEach(() => {
    // noop — keep the mock surface stable per test
  });

  afterEach(() => {
    clearTRPCMock();
  });

  it('does not fetch while the dialog is closed', () => {
    const handler = vi.fn();
    setTRPCMock({ 'document.getDownloadUrl': handler });
    const { result } = renderHookWithProviders(() => usePdfPreview('doc-1', false));
    expect(handler).not.toHaveBeenCalled();
    expect(result.current.pdfUrl).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('loads the presigned URL when opened', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => ({ url: 'https://files.example/preview' }),
    });
    const { result } = renderHookWithProviders(() => usePdfPreview('doc-1', true));
    await waitFor(() => expect(result.current.pdfUrl).toBe('https://files.example/preview'));
    expect(result.current.loading).toBe(false);
  });

  it('keeps pdfUrl null and stops loading when the query errors', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => {
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => usePdfPreview('doc-1', true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pdfUrl).toBeNull();
  });

  it('resets pdfUrl when the dialog closes', async () => {
    setTRPCMock({
      'document.getDownloadUrl': () => ({ url: 'https://files.example/preview' }),
    });
    const { result, rerender } = renderHookWithProviders(
      ({ open }: { open: boolean }) => usePdfPreview('doc-1', open),
      { initialProps: { open: true } },
    );
    await waitFor(() => expect(result.current.pdfUrl).toBe('https://files.example/preview'));
    rerender({ open: false });
    expect(result.current.pdfUrl).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
