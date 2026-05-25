/**
 * `useBacsSubmitterForm` — masks loading, save mutation success/error,
 * invalidation contract.
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
import { useBacsSubmitterForm } from '../use-bacs-submitter-form.js';

const trpcProxy = createTRPCProxy();

describe('useBacsSubmitterForm', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isMasksLoading=true while masks query is pending', () => {
    setTRPCMock({
      'bacs.getSubmitterMasks': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useBacsSubmitterForm());
    expect(result.current.isMasksLoading).toBe(true);
    expect(result.current.submitterNameDefault).toBe('');
  });

  it('exposes saved masks once query resolves', async () => {
    setTRPCMock({
      'bacs.getSubmitterMasks': () => ({
        sun: '••••56',
        sortCode: '••-••-78',
        accountNumber: '••••5678',
        submitterName: 'ACME LTD',
      }),
    });

    const { result } = renderHookWithProviders(() => useBacsSubmitterForm());
    await waitFor(() => expect(result.current.isMasksLoading).toBe(false));
    expect(result.current.masks?.sun).toBe('••••56');
    expect(result.current.submitterNameDefault).toBe('ACME LTD');
  });

  it('emits success toast and invalidates on save', async () => {
    setTRPCMock({
      'bacs.getSubmitterMasks': () => ({ submitterName: '' }),
      'bacs.saveSubmitterConfig': () => ({ ok: true }),
    });

    const { result, queryClient } = renderHookWithProviders(() => useBacsSubmitterForm());
    await waitFor(() => expect(result.current.isMasksLoading).toBe(false));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.onSave({
        serviceUserNumber: '123456',
        submitterSortCode: '123456',
        submitterAccountNumber: '12345678',
        submitterName: 'ACME LTD',
      });
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('emits error toast on save failure', async () => {
    setTRPCMock({
      'bacs.getSubmitterMasks': () => ({ submitterName: '' }),
      'bacs.saveSubmitterConfig': () => {
        throw new Error('save-failed');
      },
    });

    const { result } = renderHookWithProviders(() => useBacsSubmitterForm());
    await waitFor(() => expect(result.current.isMasksLoading).toBe(false));

    await act(async () => {
      result.current.onSave({
        serviceUserNumber: '123456',
        submitterSortCode: '123456',
        submitterAccountNumber: '12345678',
        submitterName: 'ACME LTD',
      });
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
