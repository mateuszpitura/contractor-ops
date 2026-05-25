/**
 * `useBankStatementImport` — initial state, file-validation gating, retry,
 * confirm flow (toast + invalidation + onClose), error toast.
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
import { useBankStatementImport } from '../use-bank-statement-import.js';

const trpcProxy = createTRPCProxy();
const onClose = vi.fn();

describe('useBankStatementImport', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    onClose.mockReset();
    setTRPCMock({});
  });

  it('initial state is upload step with no matches', () => {
    const { result } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );
    expect(result.current.step).toBe('upload');
    expect(result.current.matches).toEqual([]);
    expect(result.current.selectedMatches.size).toBe(0);
    expect(result.current.isConfirmPending).toBe(false);
  });

  it('switches to error step with INVALID_FORMAT message when file has invalid extension', async () => {
    const { result } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );

    const badFile = new File(['x'], 'statement.pdf', { type: 'application/pdf' });
    const event = {
      target: { files: [badFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;

    await act(async () => {
      await result.current.handleFileSelect(event);
    });

    expect(result.current.step).toBe('error');
    expect(result.current.parseError).toBeTruthy();
  });

  it('resets to upload step on retry', async () => {
    const { result } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );

    const badFile = new File(['x'], 'statement.pdf', { type: 'application/pdf' });
    const event = {
      target: { files: [badFile] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleFileSelect(event);
    });
    expect(result.current.step).toBe('error');

    act(() => {
      result.current.handleRetry();
    });
    expect(result.current.step).toBe('upload');
    expect(result.current.parseError).toBe('');
  });

  it('confirms selected matches: invalidates + emits success toast + closes', async () => {
    const confirmHandler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'payment.importStatement': () => ({
        matches: [
          { transactionIndex: 0, amountMinor: 100, iban: 'PL00', matched: true, itemId: 'i1' },
        ],
      }),
      'payment.confirmStatementMatches': confirmHandler,
    });

    const { result, queryClient } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );

    const file = new File(['HDR\nDTA'], 'statement.csv', { type: 'text/csv' });
    const event = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleFileSelect(event);
    });
    await waitFor(() => expect(result.current.step).toBe('results'));
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.selectedMatches.has(0)).toBe(true);

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await act(async () => {
      result.current.handleConfirm();
    });

    await waitFor(() => expect(confirmHandler).toHaveBeenCalled());
    expect(toastSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('emits error toast when confirm mutation fails', async () => {
    setTRPCMock({
      'payment.importStatement': () => ({
        matches: [
          { transactionIndex: 0, amountMinor: 100, iban: 'PL00', matched: true, itemId: 'i1' },
        ],
      }),
      'payment.confirmStatementMatches': () => {
        throw new Error('confirm-fail');
      },
    });

    const { result } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );

    const file = new File(['HDR'], 'statement.csv', { type: 'text/csv' });
    const event = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleFileSelect(event);
    });
    await waitFor(() => expect(result.current.step).toBe('results'));

    await act(async () => {
      result.current.handleConfirm();
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('toggleMatch flips a transaction in selectedMatches', async () => {
    setTRPCMock({
      'payment.importStatement': () => ({
        matches: [
          { transactionIndex: 0, amountMinor: 100, iban: 'PL00', matched: true, itemId: 'i1' },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      useBankStatementImport({ runId: 'run-1', onClose }),
    );
    const file = new File(['x'], 'statement.csv', { type: 'text/csv' });
    const event = {
      target: { files: [file] },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    await act(async () => {
      await result.current.handleFileSelect(event);
    });
    await waitFor(() => expect(result.current.step).toBe('results'));
    expect(result.current.selectedMatches.has(0)).toBe(true);

    act(() => {
      result.current.toggleMatch(0);
    });
    expect(result.current.selectedMatches.has(0)).toBe(false);
  });
});
