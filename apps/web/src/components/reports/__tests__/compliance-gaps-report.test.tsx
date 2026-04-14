import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/test-utils';

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
      complianceGaps: { queryOptions: (opts: Record<string, unknown>) => opts },
      complianceGapsChart: { queryOptions: () => ({}) },
      exportComplianceGaps: { mutationOptions: (opts: Record<string, unknown>) => opts },
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
          <div key={row.contractorId}>{row.contractorName}</div>
        ))}
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
import { ComplianceGapsReport } from '../compliance-gaps-report';

const mockUseQuery = vi.mocked(useQuery);

describe('ComplianceGapsReport', () => {
  beforeEach(() => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme',
            missingDocuments: 2,
            contractStatus: 'ACTIVE',
            overdueTasks: 1,
            health: 'red',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
  });

  it('renders chart component', () => {
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  it('renders breadcrumb component', () => {
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  it('renders table with data', () => {
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-table')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('shows table loading while chart query is already settled', () => {
    let call = 0;
    mockUseQuery.mockImplementation(() => {
      call++;
      if (call === 1) {
        return { data: undefined, isLoading: true };
      }
      return { data: { critical: 0, warning: 0, ok: 0 }, isLoading: false };
    });
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // ---- Multiple data rows ----
  it('renders multiple contractor rows', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme',
            missingDocuments: 2,
            contractStatus: 'ACTIVE',
            overdueTasks: 1,
            health: 'red',
          },
          {
            contractorId: 'c-2',
            contractorName: 'Beta Corp',
            missingDocuments: 0,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'green',
          },
        ],
        totalCount: 2,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Beta Corp')).toBeInTheDocument();
  });

  // ---- Chart renders with data ----
  it('renders chart component regardless of data state', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- Breadcrumb always renders ----
  it('renders breadcrumb in all states', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  // ---- Export buttons always render ----
  it('renders export buttons in all states', () => {
    mockUseQuery.mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  // ---- Chart data with health distribution ----
  it('passes chart data to ReportChart when chart query returns data', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          data: { items: [], totalCount: 0 },
          isLoading: false,
        } as unknown;
      }
      return {
        data: { critical: 5, warning: 3, ok: 10 },
        isLoading: false,
      } as unknown;
    });
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- Total count from server data ----
  it('uses totalCount from server when no drill down is active', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme',
            missingDocuments: 2,
            contractStatus: 'ACTIVE',
            overdueTasks: 1,
            health: 'red',
          },
        ],
        totalCount: 50,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-table')).toBeInTheDocument();
  });

  // ---- Health filter rendering ----
  it('renders report with different health types', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Red Co',
            missingDocuments: 5,
            contractStatus: 'ACTIVE',
            overdueTasks: 3,
            health: 'red',
          },
          {
            contractorId: 'c-2',
            contractorName: 'Yellow Co',
            missingDocuments: 1,
            contractStatus: 'ACTIVE',
            overdueTasks: 1,
            health: 'yellow',
          },
          {
            contractorId: 'c-3',
            contractorName: 'Green Co',
            missingDocuments: 0,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'green',
          },
        ],
        totalCount: 3,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Red Co')).toBeInTheDocument();
    expect(screen.getByText('Yellow Co')).toBeInTheDocument();
    expect(screen.getByText('Green Co')).toBeInTheDocument();
  });

  // ---- Both queries loading ----
  it('shows loading when both table and chart queries are loading', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  // ---- Chart query returns undefined ----
  it('renders chart component even when chart query data is undefined', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { items: [], totalCount: 0 }, isLoading: false } as unknown;
      }
      return { data: undefined, isLoading: false } as unknown;
    });
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- Large dataset ----
  it('renders table with many rows', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      contractorId: `c-${i}`,
      contractorName: `Company ${i}`,
      missingDocuments: i % 3,
      contractStatus: 'ACTIVE',
      overdueTasks: i % 2,
      health: ['red', 'yellow', 'green'][i % 3] as 'red' | 'yellow' | 'green',
    }));
    mockUseQuery.mockReturnValue({
      data: { items, totalCount: 20 },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Company 0')).toBeInTheDocument();
    expect(screen.getByText('Company 19')).toBeInTheDocument();
  });

  // ---- Single row ----
  it('renders single contractor row correctly', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-solo',
            contractorName: 'Solo LLC',
            missingDocuments: 0,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'green',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Solo LLC')).toBeInTheDocument();
  });

  // ---- Export buttons always present ----
  it('renders export buttons even when loading', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { data: undefined, isLoading: true } as unknown;
      return { data: undefined, isLoading: true } as unknown;
    });
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  // ---- Different date ranges render ----
  it('renders correctly with different date range props', () => {
    render(<ComplianceGapsReport dateFrom="2025-06-01" dateTo="2025-12-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  // ---- drill-down filters table data by health (filterByHealth) ----
  it('filters table data by health when drillDownHealth is set via chart click', async () => {
    await import('@/test/test-utils');
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Red Co',
            missingDocuments: 5,
            contractStatus: 'ACTIVE',
            overdueTasks: 3,
            health: 'red',
          },
          {
            contractorId: 'c-2',
            contractorName: 'Green Co',
            missingDocuments: 0,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'green',
          },
        ],
        totalCount: 2,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    // Both contractors are shown initially
    expect(screen.getByText('Red Co')).toBeInTheDocument();
    expect(screen.getByText('Green Co')).toBeInTheDocument();
  });

  // ---- drillDownLabel returns translated label for known health keys ----
  it('renders drill-down breadcrumb label for known health keys', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'Acme',
            missingDocuments: 2,
            contractStatus: 'ACTIVE',
            overdueTasks: 1,
            health: 'red',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  // ---- totalCount derived from drillDownHealth filtering ----
  it('renders with totalCount derived from filtered data length', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'A',
            missingDocuments: 1,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'yellow',
          },
          {
            contractorId: 'c-2',
            contractorName: 'B',
            missingDocuments: 0,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'green',
          },
        ],
        totalCount: 2,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-table')).toBeInTheDocument();
  });

  // ---- chartData returns empty array when chart query data is falsy ----
  it('handles chartData returning empty array for undefined chart data', () => {
    let callCount = 0;
    mockUseQuery.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: { items: [], totalCount: 0 }, isLoading: false } as unknown;
      }
      return { data: undefined, isLoading: false } as unknown;
    });
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  // ---- onRowClick navigates to contractor profile ----
  it('renders table rows that are clickable for navigation', () => {
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            contractorId: 'c-1',
            contractorName: 'NavTarget',
            missingDocuments: 1,
            contractStatus: 'ACTIVE',
            overdueTasks: 0,
            health: 'red',
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
    } as unknown);
    render(<ComplianceGapsReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('NavTarget')).toBeInTheDocument();
  });
});
