/**
 * `useReconciliationTable` — cursor-paginated reconciliation list for the
 * table container (`isLoading` / `isError` / `isEmpty` / `showData`,
 * page size, prev/next via `onPageChange`).
 */

import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useReconciliationListMock = vi.fn();

vi.mock('../use-reconciliation.js', () => ({
  useReconciliationList: (options: { cursor?: string; limit: number }) =>
    useReconciliationListMock(options),
}));

import { renderHookWithProviders } from '../../../../test-utils/render-hook.js';
import { useReconciliationTable } from '../use-reconciliation-table.js';

function makeItem(id: string) {
  return {
    invoice: {
      id,
      invoiceNumber: `INV-${id}`,
      issueDate: '2026-01-15',
      totalMinor: 10_000,
      currency: 'EUR',
      servicePeriodStart: '2026-01-01',
      servicePeriodEnd: '2026-01-31',
    },
    contractor: { id: 'c-1', legalName: 'Acme GmbH' },
    reconciliation: {
      approvedMinutes: 480,
      rateValueMinor: 8_000,
      rateType: 'HOURLY',
      hoursPerDay: 8,
      expectedAmountMinor: 64_000,
      invoicedAmountMinor: 64_000,
      deviationMinor: 0,
      deviationPercent: 0,
      withinThreshold: true,
      thresholdPercent: 5,
    },
  };
}

beforeEach(() => {
  useReconciliationListMock.mockReset();
});

describe('useReconciliationTable', () => {
  it('returns items from the current page and estimates total when more pages exist', () => {
    useReconciliationListMock.mockReturnValue({
      data: { items: [makeItem('a'), makeItem('b')], nextCursor: 'cursor-1' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.items.map(i => i.invoice.id)).toEqual(['a', 'b']);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.showData).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it('uses item count as total when there is no next page', () => {
    useReconciliationListMock.mockReturnValue({
      data: { items: [makeItem('only'), makeItem('two')], nextCursor: null },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.totalCount).toBe(2);
  });

  it('returns empty list and flips isEmpty when the data set is empty', () => {
    useReconciliationListMock.mockReturnValue({
      data: { items: [], nextCursor: null },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.items).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.showData).toBe(false);
  });

  it('exposes loading state via the isLoading flag', () => {
    useReconciliationListMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.showData).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('exposes error state via the isError flag', () => {
    useReconciliationListMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      isFetching: false,
      refetch: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.isError).toBe(true);
    expect(result.current.showData).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('onRetry and onPageChange proxy to the inner query', () => {
    const refetch = vi.fn();
    useReconciliationListMock.mockReturnValue({
      data: { items: [makeItem('a')], nextCursor: 'c1' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch,
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    result.current.onRetry();
    expect(refetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.onPageChange(2);
    });
    expect(useReconciliationListMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'c1', limit: 10 }),
    );
  });
});
