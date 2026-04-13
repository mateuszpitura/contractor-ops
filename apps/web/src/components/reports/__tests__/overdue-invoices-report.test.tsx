import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    report: {
      overdueInvoices: { queryOptions: (opts: Record<string, unknown>) => opts },
      exportOverdueInvoices: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../report-table', () => ({
  ReportTable: ({
    data,
    emptyTitle,
    isLoading,
  }: {
    data: Record<string, unknown>[];
    emptyTitle: string;
    isLoading: boolean;
  }) =>
    isLoading ? (
      <div data-testid="loading" />
    ) : data.length === 0 ? (
      <div data-testid="empty">{emptyTitle}</div>
    ) : (
      <div data-testid="report-table">
        {data.map(row => (
          <div key={row.invoiceId}>{row.invoiceNumber}</div>
        ))}
      </div>
    ),
}));

vi.mock('../export-buttons', () => ({
  ExportButtons: () => <div data-testid="export-buttons" />,
  downloadBase64File: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { OverdueInvoicesReport } from '../overdue-invoices-report';

const mockUseQuery = vi.mocked(useQuery);

describe('OverdueInvoicesReport', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            invoiceId: 'inv-1',
            invoiceNumber: 'FV/001',
            contractorId: 'c-1',
            contractorName: 'Acme',
            amountMinor: 500000,
            currency: 'PLN',
            dueDate: '2026-03-01',
            daysOverdue: 35,
            status: 'OVERDUE',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
  });

  it('renders table with data', () => {
    render(<OverdueInvoicesReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('FV/001')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(<OverdueInvoicesReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<OverdueInvoicesReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
    expect(screen.getByText('emptyOverdueInvoices')).toBeInTheDocument();
  });

  it('renders table loading when query is loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);
    render(<OverdueInvoicesReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('does not render chart (table-only report)', () => {
    render(<OverdueInvoicesReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.queryByTestId('report-chart')).not.toBeInTheDocument();
  });
});
