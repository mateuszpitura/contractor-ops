/**
 * `useProductionCertificate` — step 5 of the ZATCA onboarding wizard.
 * Covers idle, success path (completed=true + toast.success), and error
 * path (completed stays false + toast.error).
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
import { useProductionCertificate } from '../use-production-certificate.js';

const trpcProxy = createTRPCProxy();

describe('useProductionCertificate', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('starts idle (completed=false, isPending=false)', () => {
    const { result } = renderHookWithProviders(() => useProductionCertificate());
    expect(result.current.completed).toBe(false);
    expect(result.current.isPending).toBe(false);
  });

  it('flips completed=true and toasts success on a successful exchange', async () => {
    setTRPCMock({
      'zatca.exchangeProductionCert': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useProductionCertificate());

    await act(async () => {
      result.current.exchangeProductionCert();
    });

    await waitFor(() => expect(result.current.completed).toBe(true));
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('emits an error toast and keeps completed=false when the mutation rejects', async () => {
    setTRPCMock({
      'zatca.exchangeProductionCert': () => {
        throw new Error('exchange failed');
      },
    });
    const { result } = renderHookWithProviders(() => useProductionCertificate());

    await act(async () => {
      result.current.exchangeProductionCert();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.completed).toBe(false);
  });
});
