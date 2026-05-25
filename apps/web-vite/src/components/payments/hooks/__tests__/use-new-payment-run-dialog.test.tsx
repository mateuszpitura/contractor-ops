/**
 * `useNewPaymentRunDialog` — wizard step state, handleComplete invalidation,
 * close-reset behaviour, onViewRun callback routing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
} from '../../../../test-utils/render-hook.js';
import { useNewPaymentRunDialog } from '../use-new-payment-run-dialog.js';

const trpcProxy = createTRPCProxy();
const onOpenChange = vi.fn();
const onViewRun = vi.fn();

describe('useNewPaymentRunDialog', () => {
  beforeEach(() => {
    onOpenChange.mockReset();
    onViewRun.mockReset();
    setTRPCMock({});
    vi.useFakeTimers();
  });

  it('starts at step 1 with no selection', () => {
    const { result } = renderHookWithProviders(() =>
      useNewPaymentRunDialog({ open: true, onOpenChange, onViewRun }),
    );
    expect(result.current.step).toBe(1);
    expect(result.current.selectedInvoiceIds).toEqual([]);
    expect(result.current.groupByCurrency).toBe(false);
    expect(result.current.confirmationData).toBeNull();
  });

  it('advances to step 3 with confirmation data on handleComplete and invalidates payment cache', () => {
    const { result, queryClient } = renderHookWithProviders(() =>
      useNewPaymentRunDialog({ open: true, onOpenChange, onViewRun }),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.handleComplete({
        runId: 'run-1',
        runNumber: 'PR-001',
        fileBase64: 'eA==',
        fileName: 'export.csv',
        invoiceCount: 2,
        totalMinor: 10_000,
        currency: 'EUR',
        exportFormat: 'CSV',
      });
    });

    expect(result.current.step).toBe(3);
    expect(result.current.confirmationData?.runId).toBe('run-1');
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('handleOpenChange(false) forwards close + resets wizard state after timeout', () => {
    const { result } = renderHookWithProviders(() =>
      useNewPaymentRunDialog({ open: true, onOpenChange, onViewRun }),
    );

    act(() => {
      result.current.setSelectedInvoiceIds(['inv-1', 'inv-2']);
      result.current.setStep(2);
    });
    expect(result.current.step).toBe(2);

    act(() => {
      result.current.handleOpenChange(false);
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.step).toBe(1);
    expect(result.current.selectedInvoiceIds).toEqual([]);
  });

  it('handleViewRunFromConfirmation closes the dialog and invokes onViewRun with runId', () => {
    const { result } = renderHookWithProviders(() =>
      useNewPaymentRunDialog({ open: true, onOpenChange, onViewRun }),
    );

    act(() => {
      result.current.handleComplete({
        runId: 'run-9',
        runNumber: 'PR-9',
        fileBase64: '',
        fileName: 'x',
        invoiceCount: 1,
        totalMinor: 100,
        currency: 'EUR',
        exportFormat: 'CSV',
      });
    });

    act(() => {
      result.current.handleViewRunFromConfirmation();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onViewRun).toHaveBeenCalledWith('run-9');
  });

  it('handleViewRunFromConfirmation is a no-op when there is no confirmation data', () => {
    const { result } = renderHookWithProviders(() =>
      useNewPaymentRunDialog({ open: true, onOpenChange, onViewRun }),
    );
    act(() => {
      result.current.handleViewRunFromConfirmation();
    });
    expect(onViewRun).not.toHaveBeenCalled();
  });
});
