/**
 * `usePaymentRunStepReview` — derived currency grouping, lockAndExport mutation
 * pipeline (create → lockAndExport → onComplete), error toast on failure.
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
import { usePaymentRunStepReview } from '../use-payment-run-step-review.js';

const trpcProxy = createTRPCProxy();
const onComplete = vi.fn();

describe('usePaymentRunStepReview', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    onComplete.mockReset();
    setTRPCMock({});
  });

  it('groups selected invoices by currency and flags hasPLN/hasEUR', async () => {
    setTRPCMock({
      'payment.readyForPayment': () => ({
        items: [
          { id: 'i1', currency: 'EUR', amountToPayMinor: 1000 },
          { id: 'i2', currency: 'EUR', amountToPayMinor: 2000 },
          { id: 'i3', currency: 'PLN', amountToPayMinor: 500 },
        ],
      }),
    });

    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepReview({
        selectedInvoiceIds: ['i1', 'i2', 'i3'],
        groupByCurrency: true,
        onComplete,
      }),
    );

    await waitFor(() => expect(result.current.currencies.length).toBeGreaterThan(0));
    expect(result.current.hasEUR).toBe(true);
    expect(result.current.hasPLN).toBe(true);
    expect(result.current.groupedByCurrency.EUR?.totalMinor).toBe(3000);
    expect(result.current.groupedByCurrency.PLN?.totalMinor).toBe(500);
    expect(result.current.grandTotal).toBe(3500);
  });

  it('handleLockAndExport: create → lockAndExport → onComplete success path', async () => {
    setTRPCMock({
      'payment.readyForPayment': () => ({
        items: [{ id: 'i1', currency: 'EUR', amountToPayMinor: 1000 }],
      }),
      'payment.create': () => [{ id: 'run-1', runNumber: 'PR-001' }],
      'payment.lockAndExport': () => ({ fileBase64: 'eA==', fileName: 'export.csv' }),
    });

    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepReview({
        selectedInvoiceIds: ['i1'],
        groupByCurrency: false,
        onComplete,
      }),
    );
    await waitFor(() => expect(result.current.currencies.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.handleLockAndExport();
    });

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        runNumber: 'PR-001',
        fileBase64: 'eA==',
        fileName: 'export.csv',
        exportFormat: 'CSV',
      }),
    );
  });

  it('emits error toast on create failure and clears locking flag', async () => {
    setTRPCMock({
      'payment.readyForPayment': () => ({
        items: [{ id: 'i1', currency: 'EUR', amountToPayMinor: 1 }],
      }),
      'payment.create': () => {
        throw new Error('boom');
      },
    });

    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepReview({
        selectedInvoiceIds: ['i1'],
        groupByCurrency: false,
        onComplete,
      }),
    );
    await waitFor(() => expect(result.current.currencies.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.handleLockAndExport();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(result.current.isLocking).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
