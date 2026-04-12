import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    time: {
      listReconciliations: { queryOptions: (opts: any) => opts },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/shared/empty-state', () => ({
  EmptyState: ({ heading }: { heading: string }) => <div data-testid="empty-state">{heading}</div>,
}));

vi.mock('@/components/time/deviation-flag', () => ({
  DeviationFlag: ({ deviationPercent }: { deviationPercent: number }) => (
    <span data-testid="deviation-flag">{deviationPercent}%</span>
  ),
}));

import { useQuery } from '@tanstack/react-query';
import { ReconciliationTable } from '../reconciliation-table';

const mockUseQuery = vi.mocked(useQuery);

const mockItem = {
  invoice: {
    id: 'inv-1',
    invoiceNumber: 'FV/001',
    issueDate: '2026-01-15',
    totalMinor: 2400000,
    currency: 'PLN',
    servicePeriodStart: '2026-01-01',
    servicePeriodEnd: '2026-01-31',
  },
  contractor: {
    id: 'c-1',
    legalName: 'Test Contractor',
  },
  reconciliation: {
    approvedMinutes: 9600,
    rateValueMinor: 15000,
    rateType: 'HOURLY',
    hoursPerDay: 8,
    expectedAmountMinor: 2400000,
    invoicedAmountMinor: 2500000,
    deviationMinor: 100000,
    deviationPercent: 4.17,
    withinThreshold: true,
    thresholdPercent: 10,
  },
};

describe('ReconciliationTable', () => {
  it('renders loading skeleton when isLoading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);
    const { container } = render(<ReconciliationTable />);
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it('renders empty state when no items', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);
    render(<ReconciliationTable />);
    expect(screen.getByTestId('empty-state')).toHaveTextContent('No reconciliation data');
  });

  it('renders table rows with data', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [mockItem] },
      isLoading: false,
    } as any);
    render(<ReconciliationTable />);
    expect(screen.getByText('Test Contractor')).toBeInTheDocument();
  });

  it('renders approved hours', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [mockItem] },
      isLoading: false,
    } as any);
    render(<ReconciliationTable />);
    // 9600 min = 160h
    expect(screen.getByText('160h')).toBeInTheDocument();
  });

  it('renders deviation flag', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [mockItem] },
      isLoading: false,
    } as any);
    render(<ReconciliationTable />);
    expect(screen.getByTestId('deviation-flag')).toHaveTextContent('4.17%');
  });

  it('renders invoice link', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [mockItem] },
      isLoading: false,
    } as any);
    render(<ReconciliationTable />);
    const link = screen.getByRole('link', { name: /View invoice/i });
    expect(link).toHaveAttribute('href', '/invoices/inv-1');
  });
});
