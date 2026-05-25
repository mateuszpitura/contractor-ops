/**
 * `useCsrGeneration` — step 2 of the ZATCA onboarding wizard. Covers
 * idle/pending state, success path (csrPem captured + toast), error
 * path (toast.error, csrPem stays null).
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
import { useCsrGeneration } from '../use-csr-generation.js';

const trpcProxy = createTRPCProxy();

describe('useCsrGeneration', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts idle (isPending=false, csrPem=null)', () => {
    const { result } = renderHookWithProviders(() => useCsrGeneration());
    expect(result.current.isPending).toBe(false);
    expect(result.current.csrPem).toBeNull();
  });

  it('captures csrPem and toasts success on a successful generation', async () => {
    const expectedCsr =
      '-----BEGIN CERTIFICATE REQUEST-----\nMIIB...\n-----END CERTIFICATE REQUEST-----';
    setTRPCMock({
      'zatca.generateCsr': () => ({ csrPem: expectedCsr }),
    });
    const { result } = renderHookWithProviders(() => useCsrGeneration());

    await act(async () => {
      result.current.generateCsr();
    });

    await waitFor(() => expect(result.current.csrPem).toBe(expectedCsr));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('emits an error toast and keeps csrPem=null when the mutation rejects', async () => {
    setTRPCMock({
      'zatca.generateCsr': () => {
        throw new Error('key generation failed');
      },
    });
    const { result } = renderHookWithProviders(() => useCsrGeneration());

    await act(async () => {
      result.current.generateCsr();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.csrPem).toBeNull();
  });
});
