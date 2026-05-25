/**
 * `useSpendContractorReport` — spend-by-contractor table + chart + export.
 * Covers loading/empty/error/success states, sort + drill-down resets,
 * export mutation toast/invalidate paths, and grand total derivation.
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
import { useSpendContractorReport } from '../use-spend-contractor-report.js';

const trpcProxy = createTRPCProxy();

const DATE_FROM = '2026-01-01T00:00:00.000Z';
const DATE_TO = '2026-04-01T00:00:00.000Z';

describe('useSpendContractorReport', () => {
  it('loading state: table empty, chart empty, totals zero', () => {
    setTRPCMock({
      'report.spendByContractor': () => new Promise(() => undefined),
      'report.spendByContractorChart': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.chartData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.grandTotal).toBe(0);
    expect(result.current.tableQuery.isLoading).toBe(true);
  });

  it('empty state: settled with no items', async () => {
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableQuery.isLoading).toBe(false));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.grandTotal).toBe(0);
  });

  it('success state: items + chart + grand total derived from items', async () => {
    setTRPCMock({
      'report.spendByContractor': () => ({
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme',
            invoiceCount: 3,
            totalMinor: 1000,
            avgMinor: 333,
            lastPaidAt: null,
          },
          {
            contractorId: 'c-2',
            contractorName: 'Beta',
            invoiceCount: 1,
            totalMinor: 500,
            avgMinor: 500,
            lastPaidAt: null,
          },
        ],
        total: 2,
      }),
      'report.spendByContractorChart': () => [
        { contractorId: 'c-1', contractorName: 'Acme', totalMinor: 1000 },
      ],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableData.length).toBe(2));
    expect(result.current.totalCount).toBe(2);
    expect(result.current.grandTotal).toBe(1500);
    expect(result.current.chartData).toHaveLength(1);
  });

  it('error state: tableQuery.isError set, retry calls refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'report.spendByContractor': () => {
        calls += 1;
        throw new Error('boom');
      },
      'report.spendByContractorChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    await waitFor(() => expect(result.current.tableQuery.isError).toBe(true));
    const before = calls;
    act(() => result.current.handleTableRetry());
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it('handleSortChange resets page to 1 and stores sort state', async () => {
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    act(() => result.current.setPage(5));
    expect(result.current.page).toBe(5);
    act(() => result.current.handleSortChange('contractorName', 'asc'));
    expect(result.current.sortBy).toBe('contractorName');
    expect(result.current.sortOrder).toBe('asc');
    expect(result.current.page).toBe(1);
  });

  it('handleDrillDown toggles the contractor id and clears on second click', async () => {
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [
        { contractorId: 'c-1', contractorName: 'Acme', totalMinor: 1000 },
      ],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    act(() => result.current.handleDrillDown('c-1'));
    expect(result.current.drillDownContractorId).toBe('c-1');
    act(() => result.current.handleDrillDown('c-1'));
    expect(result.current.drillDownContractorId).toBeNull();
  });

  it('handleClearDrillDown resets drill-down + page', () => {
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    act(() => result.current.handleDrillDown('c-1'));
    act(() => result.current.setPage(3));
    act(() => result.current.handleClearDrillDown());
    expect(result.current.drillDownContractorId).toBeNull();
    expect(result.current.page).toBe(1);
  });

  it('export success: toast.success + queryClient invalidation', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [],
      'report.exportSpendByContractor': () => ({ jobId: 'job-1' }),
    });
    const { result, queryClient } = renderHookWithProviders(() =>
      useSpendContractorReport(DATE_FROM, DATE_TO),
    );
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleExportAll());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('export error: toast.error fired on mutation failure', async () => {
    toastError.mockClear();
    setTRPCMock({
      'report.spendByContractor': () => ({ items: [], total: 0 }),
      'report.spendByContractorChart': () => [],
      'report.exportSpendByContractor': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => useSpendContractorReport(DATE_FROM, DATE_TO));
    act(() => result.current.handleExportPage());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
