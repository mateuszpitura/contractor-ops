/**
 * Spec for `useLegalPrivacyPdfDownload` — wraps the
 * `legal.generatePrivacyNoticePdf` mutation with a success toast,
 * `legal.*` query invalidation, and an error toast that surfaces the
 * underlying error message.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useLegalPrivacyPdfDownload } from '../use-legal-privacy-pdf.js';

const trpcProxy = createTRPCProxy();

describe('useLegalPrivacyPdfDownload', () => {
  it('starts idle', () => {
    setTRPCMock({});
    const { result } = renderHookWithProviders(() => useLegalPrivacyPdfDownload());
    expect(result.current.isPending).toBe(false);
  });

  it('success emits queued toast and invalidates legal queries', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'legal.generatePrivacyNoticePdf': () => ({ queued: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useLegalPrivacyPdfDownload());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.mutation.mutate(undefined);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['legal'] });
    expect(result.current.isPending).toBe(false);
  });

  it('error toast forwards thrown error message', async () => {
    toastError.mockClear();
    setTRPCMock({
      'legal.generatePrivacyNoticePdf': () => {
        throw new Error('rate-limited');
      },
    });
    const { result } = renderHookWithProviders(() => useLegalPrivacyPdfDownload());

    act(() => {
      result.current.mutation.mutate(undefined);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('rate-limited'));
  });
});
