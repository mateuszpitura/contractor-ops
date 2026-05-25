/**
 * `useZatcaInvoiceChainTable` — paginated invoice chain table on the ZATCA
 * dashboard. Covers loading, empty entries, populated success, and the
 * resubmit mutation (open dialog → confirm → toast + multi-key invalidation
 * + dialog close; failure path emits an error toast).
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
import { useZatcaInvoiceChainTable } from '../use-zatca-invoice-chain-table.js';

const trpcProxy = createTRPCProxy();

describe('useZatcaInvoiceChainTable', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while the chain query is pending', () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns an empty entries array when the chain is empty', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({ entries: [] }),
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });

  it('exposes populated chain entries on success', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({
        entries: [
          {
            id: 'sub-1',
            icv: 7,
            invoiceId: 'inv-7',
            zatcaUuid: 'uuid-7',
            zatcaStatus: 'REJECTED',
            submittedAt: '2026-05-01T00:00:00Z',
            createdAt: '2026-05-01T00:00:00Z',
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.entries.length).toBe(1));
    expect(result.current.entries[0]?.icv).toBe(7);
  });

  it('toggles pendingResubmit via openResubmitDialog / closeResubmitDialog', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({ entries: [] }),
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openResubmitDialog('inv-1', 1));
    expect(result.current.pendingResubmit).toEqual({ invoiceId: 'inv-1', icv: 1 });

    act(() => result.current.closeResubmitDialog());
    expect(result.current.pendingResubmit).toBeNull();
  });

  it('invalidates chain + stats + status and toasts on a successful resubmit', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({ entries: [] }),
      'zatca.resubmit': () => ({ ok: true }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => result.current.openResubmitDialog('inv-1', 1));
    await act(async () => {
      result.current.confirmResubmit();
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    expect(result.current.pendingResubmit).toBeNull();
  });

  it('emits an error toast and keeps the dialog open when resubmit fails', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({ entries: [] }),
      'zatca.resubmit': () => {
        throw new Error('rejected by ZATCA');
      },
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.openResubmitDialog('inv-1', 1));
    await act(async () => {
      result.current.confirmResubmit();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.pendingResubmit).not.toBeNull();
  });

  it('confirmResubmit is a no-op when no pending dialog is open', async () => {
    setTRPCMock({
      'zatca.getInvoiceChain': () => ({ entries: [] }),
      'zatca.resubmit': () => ({ ok: true }),
    });
    const { result } = renderHookWithProviders(() => useZatcaInvoiceChainTable());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.confirmResubmit());
    // Should not fire any toast because no invoice id was queued.
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
