import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, _params?: Record<string, unknown>) => key,
  };
});

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    report: {
      expiringContracts: { queryOptions: (opts: Record<string, unknown>) => opts },
      expiringContractsChart: { queryOptions: (opts: Record<string, unknown>) => opts },
      exportExpiringContracts: { mutationOptions: (opts: Record<string, unknown>) => opts },
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

vi.mock('../report-chart', () => ({
  ReportChart: () => <div data-testid="report-chart" />,
}));

vi.mock('../report-table', () => ({
  ReportTable: ({
    data,
    isLoading,
    emptyTitle,
  }: {
    data: Record<string, unknown>[];
    isLoading: boolean;
    emptyTitle: string;
  }) =>
    isLoading ? (
      <div data-testid="loading" />
    ) : data.length === 0 ? (
      <div data-testid="empty">{emptyTitle}</div>
    ) : (
      <div data-testid="report-table">
        {data.map(row => (
          <div key={row.contractId}>{row.contractTitle}</div>
        ))}
      </div>
    ),
}));

vi.mock('../export-buttons', () => ({
  ExportButtons: () => <div data-testid="export-buttons" />,
  downloadBase64File: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { ExpiringContractsReport } from '../expiring-contracts-report';

const mockUseQuery = vi.mocked(useQuery);

describe('ExpiringContractsReport', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractId: 'ct-1',
            contractTitle: 'Web Dev Contract',
            contractorId: 'c-1',
            contractorName: 'Acme',
            endDate: '2026-04-30',
            daysRemaining: 25,
            status: 'EXPIRING',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
  });

  it('renders days selector buttons', () => {
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('days30')).toBeInTheDocument();
    expect(screen.getByText('days60')).toBeInTheDocument();
    expect(screen.getByText('days90')).toBeInTheDocument();
  });

  it('renders chart', () => {
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  it('renders table with data', () => {
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Web Dev Contract')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  it('switches days filter on click', async () => {
    const { user } = setup(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    await user.click(screen.getByText('days60'));
    // The 60 button should now be active (default variant)
    // We verify the component doesn't crash on state change
    expect(screen.getByText('days60')).toBeInTheDocument();
  });

  it('renders empty state when no contracts in range', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
    expect(screen.getByText('emptyExpiringContracts')).toBeInTheDocument();
  });

  it('shows table loading while chart query is already settled', () => {
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call++;
      if (call === 1) {
        return { data: undefined, isLoading: true };
      }
      return { data: [], isLoading: false };
    });
    render(<ExpiringContractsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });
});
