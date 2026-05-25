/**
 * `useReconciliationTable` — flattens the reconciliation infinite-query
 * pages into a single `items` array and exposes a `totalCount` plus the
 * decisive variant flags (`isLoading` / `isError` / `isEmpty` /
 * `showData`) the container consumes to pick a render path.
 *
 * Covers:
 *   - flattens items across pages
 *   - total comes from the last page when present
 *   - total falls back to items.length when missing
 *   - empty data → isEmpty flag flips, zero count
 *   - loading + error flags pass through from the inner query
 *   - onRetry / onLoadMore proxy to the inner query
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const useReconciliationListMock = vi.fn();

vi.mock('../use-reconciliation.js', () => ({
  useReconciliationList: () => useReconciliationListMock(),
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
  it('flattens items across pages and reports the last-page total', () => {
    useReconciliationListMock.mockReturnValue({
      data: {
        pages: [
          { items: [makeItem('a'), makeItem('b')], nextCursor: 'cursor-1', total: 5 },
          { items: [makeItem('c')], nextCursor: null, total: 5 },
        ],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.items.map(i => i.invoice.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.showData).toBe(true);
    expect(result.current.isEmpty).toBe(false);
  });

  it('falls back to items.length when last page lacks total', () => {
    useReconciliationListMock.mockReturnValue({
      data: {
        pages: [{ items: [makeItem('only'), makeItem('two')], nextCursor: null }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.totalCount).toBe(2);
  });

  it('returns empty list and flips isEmpty when the data set is empty', () => {
    useReconciliationListMock.mockReturnValue({
      data: { pages: [{ items: [], nextCursor: null }] },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
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
      hasNextPage: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
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
      hasNextPage: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    expect(result.current.isError).toBe(true);
    expect(result.current.showData).toBe(false);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.items).toEqual([]);
  });

  it('onRetry and onLoadMore proxy to the inner query', () => {
    const refetch = vi.fn();
    const fetchNextPage = vi.fn();
    useReconciliationListMock.mockReturnValue({
      data: { pages: [{ items: [makeItem('a')], nextCursor: 'c1' }] },
      isLoading: false,
      isError: false,
      hasNextPage: true,
      isFetchingNextPage: false,
      refetch,
      fetchNextPage,
    });
    const { result } = renderHookWithProviders(() => useReconciliationTable());
    result.current.onRetry();
    result.current.onLoadMore();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(result.current.hasNextPage).toBe(true);
  });
});
