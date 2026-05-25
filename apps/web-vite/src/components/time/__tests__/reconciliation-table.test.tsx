/**
 * Variant-pick coverage moved to the container after the passthrough
 * refactor: the view is now data-only and the container decides
 * loading / error / empty / data. We mock the domain hook to drive each
 * branch and `DeviationFlag` to keep the test focused on row + variant
 * rendering.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('../deviation-flag.js', () => ({
  DeviationFlag: () => <span data-testid="deviation-flag" />,
}));

const useReconciliationTableMock = vi.fn();
vi.mock('../hooks/use-reconciliation-table.js', () => ({
  useReconciliationTable: () => useReconciliationTableMock(),
}));

import { render, screen } from '../../../test/test-utils.js';
import type { UseReconciliationTableReturn } from '../hooks/use-reconciliation-table.js';
import { ReconciliationTable } from '../reconciliation-table-container.js';

function makeItem(over: Record<string, unknown> = {}) {
  return {
    invoice: {
      id: 'inv-1',
      invoiceNumber: 'FV/2026/001',
      issueDate: '2026-04-15',
      totalMinor: 100000,
      currency: 'PLN',
      servicePeriodStart: '2026-04-01',
      servicePeriodEnd: '2026-04-30',
    },
    contractor: { id: 'c-1', legalName: 'Acme Sp z o.o.' },
    reconciliation: {
      approvedMinutes: 60 * 40,
      rateValueMinor: 10000,
      rateType: 'HOURLY',
      hoursPerDay: 8,
      expectedAmountMinor: 100000,
      invoicedAmountMinor: 100000,
      deviationMinor: 0,
      deviationPercent: 0,
      withinThreshold: true,
      thresholdPercent: 5,
    },
    ...over,
  };
}

function makeHookValue(
  over: Partial<UseReconciliationTableReturn> = {},
): UseReconciliationTableReturn {
  return {
    isLoading: false,
    isError: false,
    isEmpty: false,
    showData: true,
    onRetry: vi.fn(),
    onLoadMore: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    items: [makeItem()] as never,
    totalCount: 1,
    ...over,
  } as UseReconciliationTableReturn;
}

describe('ReconciliationTable container (web-vite)', () => {
  it('renders the contractor row when items are present', () => {
    useReconciliationTableMock.mockReturnValue(makeHookValue());
    render(<ReconciliationTable />);
    expect(screen.getByText('Acme Sp z o.o.')).toBeInTheDocument();
    expect(screen.getByTestId('deviation-flag')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    useReconciliationTableMock.mockReturnValue(
      makeHookValue({ isLoading: true, showData: false, items: [] as never, totalCount: 0 }),
    );
    const { container } = render(<ReconciliationTable />);
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders the network-error retry surface when isError', () => {
    useReconciliationTableMock.mockReturnValue(
      makeHookValue({ isError: true, showData: false, items: [] as never, totalCount: 0 }),
    );
    render(<ReconciliationTable />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders the empty state when items are empty and no error', () => {
    useReconciliationTableMock.mockReturnValue(
      makeHookValue({ isEmpty: true, showData: false, items: [] as never, totalCount: 0 }),
    );
    render(<ReconciliationTable />);
    expect(screen.getByText(/No reconciliation data/i)).toBeInTheDocument();
  });
});
