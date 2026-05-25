/**
 * `usePaymentRunStepSelect` — invoices loading, debounced contractor search,
 * row-selection bridge.
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
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { usePaymentRunStepSelect } from '../use-payment-run-step-select.js';

const trpcProxy = createTRPCProxy();
const onSelectionChange = vi.fn();

describe('usePaymentRunStepSelect', () => {
  beforeEach(() => {
    onSelectionChange.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while invoices query is pending', () => {
    setTRPCMock({ 'payment.readyForPayment': () => new Promise(() => undefined) });
    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepSelect({ selectedInvoiceIds: [], onSelectionChange }),
    );
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes allInvoices once query resolves', async () => {
    setTRPCMock({
      'payment.readyForPayment': () => ({
        items: [
          {
            id: 'inv-1',
            currency: 'EUR',
            amountToPayMinor: 100,
            contractor: { legalName: 'Acme' },
          },
          {
            id: 'inv-2',
            currency: 'EUR',
            amountToPayMinor: 200,
            contractor: { legalName: 'Bravo' },
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepSelect({ selectedInvoiceIds: [], onSelectionChange }),
    );
    await waitFor(() => expect(result.current.allInvoices).toHaveLength(2));
    expect(result.current.filteredInvoices).toHaveLength(2);
  });

  it('filters by debounced contractor search', async () => {
    vi.useFakeTimers();
    setTRPCMock({
      'payment.readyForPayment': () => ({
        items: [
          {
            id: 'inv-1',
            currency: 'EUR',
            amountToPayMinor: 100,
            contractor: { legalName: 'Acme' },
          },
          {
            id: 'inv-2',
            currency: 'EUR',
            amountToPayMinor: 200,
            contractor: { legalName: 'Bravo' },
          },
        ],
      }),
    });
    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepSelect({ selectedInvoiceIds: [], onSelectionChange }),
    );

    await vi.waitFor(() => expect(result.current.allInvoices).toHaveLength(2));

    act(() => {
      result.current.setContractorSearch('acm');
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });

    await vi.waitFor(() => expect(result.current.filteredInvoices).toHaveLength(1));
    expect(result.current.filteredInvoices[0]?.id).toBe('inv-1');
    vi.useRealTimers();
  });

  it('handleRowSelectionChange forwards selected ids to caller', async () => {
    setTRPCMock({
      'payment.readyForPayment': () => ({ items: [] }),
    });
    const { result } = renderHookWithProviders(() =>
      usePaymentRunStepSelect({ selectedInvoiceIds: [], onSelectionChange }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.handleRowSelectionChange({ 'inv-1': true, 'inv-2': false });
    });
    expect(onSelectionChange).toHaveBeenCalledWith(['inv-1']);
  });
});
