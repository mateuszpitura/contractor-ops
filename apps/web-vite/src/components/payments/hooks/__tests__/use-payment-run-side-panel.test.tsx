/**
 * `usePaymentRunSidePanel` — gated fetch on runId+open, items/status passthrough,
 * mutations: cancel / markAllPaid / updateItemStatus / removeFromRun
 * — invalidation + toasts.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
    info: vi.fn(),
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
import { usePaymentRunSidePanel } from '../use-payment-run-side-panel.js';

const trpcProxy = createTRPCProxy();
const onOpenChange = vi.fn();

function runHook(runId: string | null, open: boolean) {
  return renderHookWithProviders(() => usePaymentRunSidePanel({ runId, open, onOpenChange }));
}

describe('usePaymentRunSidePanel', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    onOpenChange.mockReset();
    setTRPCMock({});
  });

  it('does not fetch when closed or runId is null', () => {
    const getHandler = vi.fn();
    setTRPCMock({ 'payment.get': getHandler });

    const { result } = runHook(null, false);
    expect(result.current.isLoading).toBe(false);
    expect(getHandler).not.toHaveBeenCalled();
  });

  it('returns isLoading=true while run query is pending (open + runId)', () => {
    setTRPCMock({
      'payment.get': () => new Promise(() => undefined),
      'payment.getFormatDetection': () => [],
    });
    const { result } = runHook('run-1', true);
    expect(result.current.isLoading).toBe(true);
  });

  it('returns run + items + status when fetched', async () => {
    setTRPCMock({
      'payment.get': () => ({
        id: 'run-1',
        runNumber: 'PR-001',
        status: 'EXPORTED',
        currency: 'EUR',
        items: [{ id: 'item-1' }],
      }),
      'payment.getFormatDetection': () => [],
    });
    const { result } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.status).toBe('EXPORTED');
    expect(result.current.items).toHaveLength(1);
  });

  it('detects formats and exposes counts when DRAFT', async () => {
    setTRPCMock({
      'payment.get': () => ({
        id: 'run-1',
        runNumber: 'PR-001',
        status: 'DRAFT',
        items: [],
      }),
      'payment.getFormatDetection': () => [
        { format: 'BACS_STD18' },
        { format: 'BACS_STD18' },
        { format: 'SEPA_XML' },
      ],
    });
    const { result } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.detectedFormatCounts.length).toBeGreaterThan(0));
    expect(result.current.showFormatHint).toBe(true);
    const bacs = result.current.detectedFormatCounts.find(([f]) => f === 'BACS_STD18');
    expect(bacs?.[1]).toBe(2);
  });

  it('emits success toast + invalidation on cancel and closes the panel', async () => {
    setTRPCMock({
      'payment.get': () => ({ id: 'run-1', status: 'DRAFT', items: [] }),
      'payment.getFormatDetection': () => [],
      'payment.cancel': () => ({ ok: true }),
    });
    const { result, queryClient } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      result.current.onCancelRun();
    });

    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('emits error toast when mark-all-paid fails', async () => {
    setTRPCMock({
      'payment.get': () => ({ id: 'run-1', status: 'EXPORTED', items: [] }),
      'payment.getFormatDetection': () => [],
      'payment.markAllPaid': () => {
        throw new Error('boom');
      },
    });
    const { result } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Double-confirmation: first click arms, second invokes
    await act(async () => {
      result.current.handleMarkAllPaid();
    });
    await act(async () => {
      result.current.handleMarkAllPaid();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('forwards updateItemStatus payload to the mutation', async () => {
    const updateHandler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'payment.get': () => ({ id: 'run-1', status: 'EXPORTED', items: [] }),
      'payment.getFormatDetection': () => [],
      'payment.updateItemStatus': updateHandler,
    });
    const { result } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.onUpdateItemStatus('item-1', 'PAID', 'REF-1');
    });

    await waitFor(() => expect(updateHandler).toHaveBeenCalled());
    expect(updateHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-1',
        status: 'PAID',
        paymentReference: 'REF-1',
      }),
    );
  });

  it('forwards removeFromRun payload with runId + invoiceId', async () => {
    const removeHandler = vi.fn(() => ({ ok: true }));
    setTRPCMock({
      'payment.get': () => ({ id: 'run-1', status: 'DRAFT', items: [] }),
      'payment.getFormatDetection': () => [],
      'payment.removeFromRun': removeHandler,
    });
    const { result } = runHook('run-1', true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.onRemoveFromRun('invoice-1');
    });

    await waitFor(() => expect(removeHandler).toHaveBeenCalled());
    expect(removeHandler).toHaveBeenCalledWith({
      runId: 'run-1',
      invoiceId: 'invoice-1',
    });
  });
});
