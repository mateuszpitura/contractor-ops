/**
 * `useBacsPreview` — preview gating, submitter-not-configured detection,
 * generate mutation + invalidation/toast contracts.
 */

import { TRPCClientError } from '@trpc/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();
const windowOpen = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useBacsPreview } from '../use-bacs-preview.js';

const trpcProxy = createTRPCProxy();

describe('useBacsPreview', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    windowOpen.mockReset();
    setTRPCMock({});
    vi.spyOn(window, 'open').mockImplementation((...args) => {
      windowOpen(...args);
      return null;
    });
  });

  it('previewVisible=false initially and no fetch fires until onShowPreview', () => {
    const fetchSpy = vi.fn(() => ({ fileText: '...' }));
    setTRPCMock({ 'bacs.previewExport': fetchSpy });

    const { result } = renderHookWithProviders(() => useBacsPreview('run-1'));

    expect(result.current.previewVisible).toBe(false);
    expect(result.current.previewData).toBeUndefined();
    expect(result.current.submitterNotConfigured).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches preview after onShowPreview and exposes data', async () => {
    setTRPCMock({
      'bacs.previewExport': () => ({
        fileText: 'HEADER\nDETAIL',
        transliterationWarnings: [],
        modulusWarnings: [],
      }),
    });

    const { result } = renderHookWithProviders(() => useBacsPreview('run-1'));

    act(() => {
      result.current.onShowPreview();
    });

    expect(result.current.previewVisible).toBe(true);
    await waitFor(() => expect(result.current.previewData).toBeDefined());
    expect(result.current.previewData?.fileText).toBe('HEADER\nDETAIL');
    expect(result.current.previewError).toBeNull();
  });

  it('flags submitterNotConfigured when previewExport throws PRECONDITION_FAILED with "not configured" message', async () => {
    setTRPCMock({
      'bacs.previewExport': () => {
        throw new TRPCClientError('Submitter not configured', {
          result: {
            error: {
              code: -32603,
              message: 'Submitter not configured',
              data: { code: 'PRECONDITION_FAILED' },
            },
          } as any,
        });
      },
    });

    const { result } = renderHookWithProviders(() => useBacsPreview('run-1'));
    act(() => {
      result.current.onShowPreview();
    });

    await waitFor(() => expect(result.current.submitterNotConfigured).toBe(true));
    expect(result.current.previewError).toBeNull();
  });

  it('surfaces non-precondition errors via previewError', async () => {
    setTRPCMock({
      'bacs.previewExport': () => {
        throw new Error('boom');
      },
    });

    const { result } = renderHookWithProviders(() => useBacsPreview('run-1'));
    act(() => {
      result.current.onShowPreview();
    });

    await waitFor(() => expect(result.current.previewError).toBeTruthy());
    expect(result.current.submitterNotConfigured).toBe(false);
  });

  it('emits success toast, opens download url and invalidates on generate success', async () => {
    setTRPCMock({
      'bacs.previewExport': () => ({ fileText: 'X' }),
      'bacs.generateExport': () => ({ downloadUrl: 'https://example/file', filename: 'f.csv' }),
    });

    const { result, queryClient } = renderHookWithProviders(() => useBacsPreview('run-1'));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.onGenerate();
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(windowOpen).toHaveBeenCalledWith(
      'https://example/file',
      '_blank',
      'noopener,noreferrer',
    );
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits error toast on generate failure', async () => {
    setTRPCMock({
      'bacs.previewExport': () => ({ fileText: 'X' }),
      'bacs.generateExport': () => {
        throw new Error('export failed');
      },
    });

    const { result } = renderHookWithProviders(() => useBacsPreview('run-1'));

    await act(async () => {
      result.current.onGenerate();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
