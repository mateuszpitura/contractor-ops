/**
 * `useWhtCertificates` — generate-all success/error mutation contract.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

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
import { useWhtCertificates } from '../use-wht-certificates.js';

const trpcProxy = createTRPCProxy();

describe('useWhtCertificates', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isGenerating=false initially', () => {
    const { result } = renderHookWithProviders(() => useWhtCertificates());
    expect(result.current.isGenerating).toBe(false);
  });

  it('emits success toast and invalidates per generated certificate', async () => {
    setTRPCMock({
      'tax.generateWhtCertificate': () => ({ certificateNumber: 'WHT-2026-0001' }),
    });

    const { result, queryClient } = renderHookWithProviders(() => useWhtCertificates());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.onGenerateAll(['item-1', 'item-2']);
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits error toast when generation fails', async () => {
    setTRPCMock({
      'tax.generateWhtCertificate': () => {
        throw new Error('cert-fail');
      },
    });

    const { result } = renderHookWithProviders(() => useWhtCertificates());

    await act(async () => {
      result.current.onGenerateAll(['item-1']);
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('does not generate when called with empty itemIds', async () => {
    const handler = vi.fn(() => ({ certificateNumber: 'noop' }));
    setTRPCMock({ 'tax.generateWhtCertificate': handler });

    const { result } = renderHookWithProviders(() => useWhtCertificates());
    await act(async () => {
      result.current.onGenerateAll([]);
    });
    expect(handler).not.toHaveBeenCalled();
  });
});
