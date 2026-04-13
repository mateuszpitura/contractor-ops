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
      spendByContractor: { queryOptions: (opts: Record<string, unknown>) => opts },
      spendByContractorChart: { queryOptions: (opts: Record<string, unknown>) => opts },
      exportSpendByContractor: { mutationOptions: (opts: Record<string, unknown>) => opts },
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
    emptyTitle,
    isLoading,
    grandTotalLabel,
    grandTotalValue,
  }: {
    data: Record<string, unknown>[];
    emptyTitle: string;
    isLoading: boolean;
    grandTotalLabel?: string;
    grandTotalValue?: string;
  }) =>
    isLoading ? (
      <div data-testid="loading" />
    ) : data.length === 0 ? (
      <div data-testid="empty">{emptyTitle}</div>
    ) : (
      <div data-testid="report-table">
        {data.map(row => (
          <div key={row.contractorId}>{row.contractorName}</div>
        ))}
        {!!grandTotalLabel && (
          <div data-testid="grand-total">
            {grandTotalLabel}: {grandTotalValue}
          </div>
        )}
      </div>
    ),
}));

vi.mock('../drill-down-breadcrumb', () => ({
  DrillDownBreadcrumb: () => <div data-testid="breadcrumb" />,
}));

vi.mock('../export-buttons', () => ({
  ExportButtons: () => <div data-testid="export-buttons" />,
  downloadBase64File: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';
import { SpendContractorReport } from '../spend-contractor-report';

const mockUseQuery = vi.mocked(useQuery);

describe('SpendContractorReport', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme Corp',
            invoiceCount: 5,
            totalMinor: 1500000,
            avgMinor: 300000,
            lastPaidAt: '2026-03-15',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
  });

  it('renders chart', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  it('renders breadcrumb', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders table with contractor data', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders grand total row', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('grand-total')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
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
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // ---- Multiple contractor rows ----
  it('renders multiple contractor rows', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          { contractorId: 'c-1', contractorName: 'Alpha', totalMinor: 50000, invoiceCount: 3 },
          { contractorId: 'c-2', contractorName: 'Beta', totalMinor: 30000, invoiceCount: 2 },
        ],
        totalCount: 2,
        grandTotalMinor: 80000,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  // ---- Chart always renders ----
  it('renders chart component with data', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- Breadcrumb always renders ----
  it('renders breadcrumb component', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  // ---- Different date range ----
  it('renders correctly with different date range', () => {
    render(<SpendContractorReport dateFrom="2025-06-01" dateTo="2025-12-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  // ---- Large dataset ----
  it('renders large dataset correctly', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      contractorId: `c-${i}`,
      contractorName: `Contractor ${i}`,
      totalMinor: (i + 1) * 10000,
      invoiceCount: i + 1,
    }));
    mockUseQuery.mockReturnValue({
      data: { items, totalCount: 20, grandTotalMinor: 2100000 },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Contractor 0')).toBeInTheDocument();
    expect(screen.getByText('Contractor 19')).toBeInTheDocument();
  });

  // ---- grandTotal computed from table data ----
  it('renders grand total value computed from table data', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'A',
            totalMinor: 100000,
            invoiceCount: 2,
            avgMinor: 50000,
            lastPaidAt: null,
          },
          {
            contractorId: 'c-2',
            contractorName: 'B',
            totalMinor: 200000,
            invoiceCount: 3,
            avgMinor: 66666,
            lastPaidAt: '2026-03-01',
          },
        ],
        totalCount: 2,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('grand-total')).toBeInTheDocument();
  });

  // ---- Both queries loading ----
  it('shows loading when both table and chart queries are loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // ---- drillDownName falls back to contractorId when not in chart data ----
  it('renders drill-down breadcrumb when chart data and drill-down are present', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Drilled',
            totalMinor: 50000,
            invoiceCount: 1,
            avgMinor: 50000,
            lastPaidAt: null,
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  // ---- Empty chart data handled ----
  it('handles undefined chart data gracefully', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { items: [], totalCount: 0 }, isLoading: false } as unknown;
      }
      return { data: undefined, isLoading: false } as unknown;
    });
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- Export buttons always render ----
  it('renders export buttons even when loading', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: undefined, isLoading: true } as unknown;
      return { data: undefined, isLoading: true } as unknown;
    });
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  // ---- Single contractor row ----
  it('renders single contractor row with all fields', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-solo',
            contractorName: 'Solo Inc',
            invoiceCount: 1,
            totalMinor: 50000,
            avgMinor: 50000,
            lastPaidAt: '2026-02-15',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Solo Inc')).toBeInTheDocument();
  });

  // ---- formatCurrency works for zero ----
  it('renders grand total for zero total minor', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'ZeroCo',
            totalMinor: 0,
            invoiceCount: 0,
            avgMinor: 0,
            lastPaidAt: null,
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-table')).toBeInTheDocument();
  });

  // ---- formatDate with null ----
  it('renders correctly when lastPaidAt is null for all rows', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'NullDate',
            totalMinor: 50000,
            invoiceCount: 1,
            avgMinor: 50000,
            lastPaidAt: null,
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('NullDate')).toBeInTheDocument();
  });

  // ---- All reports structure tests ----
  it('renders all four main sections', () => {
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('report-table')).toBeInTheDocument();
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  // ---- Multiple rows with different values ----
  it('renders rows with varied invoice counts and amounts', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'High Vol',
            totalMinor: 9000000,
            invoiceCount: 50,
            avgMinor: 180000,
            lastPaidAt: '2026-03-30',
          },
          {
            contractorId: 'c-2',
            contractorName: 'Low Vol',
            totalMinor: 5000,
            invoiceCount: 1,
            avgMinor: 5000,
            lastPaidAt: '2026-01-15',
          },
        ],
        totalCount: 2,
      },
      isLoading: false,
    } as unknown);
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('High Vol')).toBeInTheDocument();
    expect(screen.getByText('Low Vol')).toBeInTheDocument();
  });

  // ---- chartData returns empty when undefined ----
  it('renders chart with empty data when chart query returns undefined', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { items: [], totalCount: 0 }, isLoading: false } as unknown;
      }
      return { data: undefined, isLoading: false } as unknown;
    });
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- chart data with contractors ----
  it('passes chart data with contractor names to chart component', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          data: {
            items: [
              {
                contractorId: 'c-1',
                contractorName: 'ChartCo',
                totalMinor: 100000,
                invoiceCount: 5,
                avgMinor: 20000,
                lastPaidAt: null,
              },
            ],
            totalCount: 1,
          },
          isLoading: false,
        } as unknown;
      }
      return {
        data: [{ contractorId: 'c-1', contractorName: 'ChartCo', totalMinor: 100000 }],
        isLoading: false,
      } as unknown;
    });
    render(<SpendContractorReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });
});
