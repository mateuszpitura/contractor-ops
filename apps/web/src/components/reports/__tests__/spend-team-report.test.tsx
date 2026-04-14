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
      spendByTeam: { queryOptions: (opts: Record<string, unknown>) => opts },
      spendByTeamChart: { queryOptions: (opts: Record<string, unknown>) => opts },
      exportSpendByTeam: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../report-chart', () => ({
  ReportChart: ({ isLoading }: { isLoading?: boolean }) =>
    isLoading ? <div data-testid="chart-loading" /> : <div data-testid="report-chart" />,
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
        {data.map((row: Record<string, unknown>, i: number) => (
          <div key={row.teamId ?? i}>{row.teamName}</div>
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
import { SpendTeamReport } from '../spend-team-report';

const mockUseQuery = vi.mocked(useQuery);

describe('SpendTeamReport', () => {
  beforeEach(() => {
    // useQuery is called twice: table query then chart query
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          items: [
            {
              teamId: 't-1',
              teamName: 'Engineering',
              contractorCount: 4,
              invoiceCount: 12,
              totalMinor: 4800000,
            },
            {
              teamId: null,
              teamName: null,
              contractorCount: 2,
              invoiceCount: 3,
              totalMinor: 600000,
            },
          ],
          totalCount: 2,
        },
        isLoading: false,
      } as unknown)
      .mockReturnValueOnce({
        data: [{ teamId: 't-1', teamName: 'Engineering', totalMinor: 4800000 }],
        isLoading: false,
      } as unknown);
  });

  it('renders chart', () => {
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('report-chart')).toBeInTheDocument();
  });

  it('renders breadcrumb', () => {
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('renders table with team data', () => {
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });

  it('renders grand total row', () => {
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('grand-total')).toBeInTheDocument();
  });

  it('renders export buttons', () => {
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('export-buttons')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({
        data: { items: [], totalCount: 0 },
        isLoading: false,
      } as unknown)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
      } as unknown);
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('empty')).toBeInTheDocument();
  });

  it('shows loading skeleton for table while table query is loading', () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
      } as unknown)
      .mockReturnValueOnce({
        data: [],
        isLoading: false,
      } as unknown);
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows chart loading while table is already settled', () => {
    mockUseQuery.mockReset();
    mockUseQuery
      .mockReturnValueOnce({
        data: {
          items: [
            {
              teamId: 't-1',
              teamName: 'Engineering',
              contractorCount: 1,
              invoiceCount: 1,
              totalMinor: 100,
            },
          ],
          totalCount: 1,
        },
        isLoading: false,
      } as unknown)
      .mockReturnValueOnce({
        data: undefined,
        isLoading: true,
      } as unknown);
    render(<SpendTeamReport dateFrom="2026-01-01" dateTo="2026-03-31" />);
    expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
  });
});
