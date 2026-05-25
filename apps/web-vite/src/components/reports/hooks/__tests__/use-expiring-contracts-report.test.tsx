/**
 * `useExpiringContractsReport` — contracts expiring in next 30/60/90 days.
 * Covers loading/empty/error/success + days filter reset + export
 * mutation toast/invalidate paths.
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
import { useExpiringContractsReport } from '../use-expiring-contracts-report.js';

const trpcProxy = createTRPCProxy();

describe('useExpiringContractsReport', () => {
  it('initial state: days=30, page=1, queries loading', () => {
    setTRPCMock({
      'report.expiringContracts': () => new Promise(() => undefined),
      'report.expiringContractsChart': () => new Promise(() => undefined),
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    expect(result.current.days).toBe('30');
    expect(result.current.page).toBe(1);
    expect(result.current.tableQuery.isLoading).toBe(true);
  });

  it('empty state: no rows', async () => {
    setTRPCMock({
      'report.expiringContracts': () => ({ items: [], total: 0 }),
      'report.expiringContractsChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    await waitFor(() => expect(result.current.tableQuery.isLoading).toBe(false));
    expect(result.current.tableData).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('success state: rows + chart buckets', async () => {
    setTRPCMock({
      'report.expiringContracts': () => ({
        items: [
          {
            contractId: 'k-1',
            contractTitle: 'NDA',
            contractorId: 'c-1',
            contractorName: 'Acme',
            endDate: '2026-06-01T00:00:00.000Z',
            daysRemaining: 5,
            status: 'EXPIRING',
          },
        ],
        total: 1,
      }),
      'report.expiringContractsChart': () => [
        { bucket: '0-30', count: 4 },
        { bucket: '31-60', count: 2 },
      ],
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    await waitFor(() => expect(result.current.tableData.length).toBe(1));
    expect(result.current.totalCount).toBe(1);
    expect(result.current.chartData).toHaveLength(2);
  });

  it('error state: tableQuery.isError set; retry triggers refetch', async () => {
    let calls = 0;
    setTRPCMock({
      'report.expiringContracts': () => {
        calls += 1;
        throw new Error('down');
      },
      'report.expiringContractsChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    await waitFor(() => expect(result.current.tableQuery.isError).toBe(true));
    const before = calls;
    act(() => result.current.handleTableRetry());
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it('handleDaysChange swaps the window and resets page', () => {
    setTRPCMock({
      'report.expiringContracts': () => ({ items: [], total: 0 }),
      'report.expiringContractsChart': () => [],
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    act(() => result.current.setPage(4));
    act(() => result.current.handleDaysChange('90'));
    expect(result.current.days).toBe('90');
    expect(result.current.page).toBe(1);
  });

  it('export success: toast.success + invalidate', async () => {
    toastSuccess.mockClear();
    setTRPCMock({
      'report.expiringContracts': () => ({ items: [], total: 0 }),
      'report.expiringContractsChart': () => [],
      'report.exportExpiringContracts': () => ({ jobId: 'job-1' }),
    });
    const { result, queryClient } = renderHookWithProviders(() => useExpiringContractsReport());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    act(() => result.current.handleExportAll());
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('export error: toast.error fired', async () => {
    toastError.mockClear();
    setTRPCMock({
      'report.expiringContracts': () => ({ items: [], total: 0 }),
      'report.expiringContractsChart': () => [],
      'report.exportExpiringContracts': () => {
        throw new Error('nope');
      },
    });
    const { result } = renderHookWithProviders(() => useExpiringContractsReport());
    act(() => result.current.handleExportPage());
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });
});
