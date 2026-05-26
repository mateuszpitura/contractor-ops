/**
 * `usePaymentsList` — loading/empty/filter/pagination flows + row-click.
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
import { usePaymentsList } from '../use-payments-list.js';

const trpcProxy = createTRPCProxy();

const onOpenSidePanel = vi.fn();

function mockHandlers(items: Record<string, unknown>[] = [], nextCursor?: string) {
  setTRPCMock({
    'payment.list': () => ({ items, nextCursor }),
    'payment.activityDates': () => [],
    'contractor.list': () => ({ total: items.length }),
  });
}

describe('usePaymentsList', () => {
  beforeEach(() => {
    onOpenSidePanel.mockReset();
    setTRPCMock({});
  });

  it('isLoading=true while runs query is pending', () => {
    setTRPCMock({
      'payment.list': () => new Promise(() => undefined),
      'payment.activityDates': () => [],
      'contractor.list': () => ({ total: 0 }),
    });
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.toolbarProps.isLoading).toBe(true);
  });

  it('shows empty state when there are no runs, no filters and no contractors', async () => {
    mockHandlers([]);
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showEmptyState).toBe(true);
    expect(result.current.contractorCount).toBe(0);
  });

  it('renders rows when data arrives and does not show empty state', async () => {
    mockHandlers([
      { id: 'run-1', runNumber: 'PR-001', status: 'DRAFT' },
      { id: 'run-2', runNumber: 'PR-002', status: 'COMPLETED' },
    ]);
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.showEmptyState).toBe(false);
    expect(result.current.tableProps.data).toHaveLength(2);
  });

  it('forwards row click to onOpenSidePanel callback', async () => {
    mockHandlers([{ id: 'run-1', runNumber: 'PR-001', status: 'DRAFT' }]);
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    await waitFor(() => expect(result.current.tableProps.data).toHaveLength(1));

    act(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test row payload narrows in callback
      result.current.tableProps.onRowClick(result.current.tableProps.data[0] as any);
    });
    expect(onOpenSidePanel).toHaveBeenCalledWith('run-1');
  });

  it('exposes hasNextPage when nextCursor is returned and advances pagination', async () => {
    mockHandlers([{ id: 'run-1', runNumber: 'PR-001', status: 'DRAFT' }], 'next-cursor-1');
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    await waitFor(() => expect(result.current.tableProps.hasNextPage).toBe(true));

    act(() => {
      result.current.tableProps.onNextPage();
    });
    expect(result.current.tableProps.hasPreviousPage).toBe(true);
  });

  it('clears all filters via onClearFilters', async () => {
    mockHandlers([{ id: 'run-1', runNumber: 'PR-001', status: 'DRAFT' }]);
    const { result } = renderHookWithProviders(() => usePaymentsList({ onOpenSidePanel }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toolbarProps.onStatusChange(['DRAFT']);
    });
    await waitFor(() => expect(result.current.hasActiveFilters).toBe(true));

    act(() => {
      result.current.tableProps.onClearFilters();
    });
    await waitFor(() => expect(result.current.hasActiveFilters).toBe(false));
  });
});
