/**
 * `useOverdueInvoicesReport` — paginated overdue invoices list + export
 * mutation. No chart / drill-down — narrowest of the five.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../providers/trpc-provider.js', () => ({
  useTRPC: () => trpcProxy,
  usePortalTRPC: () => trpcProxy,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock('../../../../i18n/useTranslations.js', () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  act,
  createTRPCProxy,
  renderHookWithProviders,
  setTRPCMock,
  waitFor,
} from '../../../../test-utils/render-hook.js';
import { useOverdueInvoicesReport } from '../use-overdue-invoices-report.js';

const trpcProxy = createTRPCProxy();

describe('useOverdueInvoicesReport', () => {
  it('loading state: query pending, no data', () => {
    setTRPCMock({
      'report.overdueInvoices': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    expect(result.current.tableQuery.isLoading).toBe(true);
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('empty state: settled with no rows', async () => {
    setTRPCMock({
      'report.overdueInvoices': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    await waitFor(() => expect(result.current.tableQuery.isLoading).toBe(false));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('success state: rows + totalCount', async () => {
    setTRPCMock({
      'report.overdueInvoices': () => ({
        items: [
          {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            contractorId: 'c-1',
            contractorName: 'Acme',
            amountMinor: 50000,
            currency: 'PLN',
            dueDate: '2026-05-01T00:00:00.000Z',
            daysOverdue: 20,
            status: 'OVERDUE',
          },
        ],
        total: 1,
      }),
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    await waitFor(() => expect(result.current.tableData.length).toBe(1));
    expect(result.current.totalCount).toBe(1);
  });

  it('error state: tableQuery.isError set; retry triggers refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'report.overdueInvoices': () => {
        calls += 1;
        throw new Error('boom');
      },
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    await waitFor(() => expect(result.current.tableQuery.isError).toBe(true));
    const before = calls;
    act(() => result.current.handleTableRetry());
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it('handleSortChange resets page', () => {
    setTRPCMock({
      'report.overdueInvoices': () => ({ items: [], total: 0 }),
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    act(() => result.current.setPage(7));
    act(() => result.current.handleSortChange('amount', 'desc'));
    expect(result.current.sortBy).toBe('amount');
    expect(result.current.sortOrder).toBe('desc');
    expect(result.current.page).toBe(1);
  });

  it('export success: toast.success + invalidate', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'report.overdueInvoices': () => ({ items: [], total: 0 }),
      'report.exportOverdueInvoices': () => ({ jobId: 'job-1' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useOverdueInvoicesReport());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleExportAll());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('export error: toast.error fired', async () => {
    toastError.mockClear();
    setTRPCMock({
      'report.overdueInvoices': () => ({ items: [], total: 0 }),
      'report.exportOverdueInvoices': () => {
        throw new Error('Something went wrong. Please try again.');
      },
    });
    const { result } = renderHookWithProviders(() => useOverdueInvoicesReport());
    act(() => result.current.handleExportPage());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
