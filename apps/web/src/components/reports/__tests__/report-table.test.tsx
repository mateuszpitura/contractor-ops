import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { ReportTable } from '../report-table';

vi.mock('next-intl', async importOriginal => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: () => (key: string, params?: any) => {
      if (params?.column) return `${key}(${params.column})`;
      return key;
    },
  };
});

type TestRow = { id: string; name: string; value: number };

const columns: ColumnDef<TestRow>[] = [
  { accessorKey: 'name', header: 'Name', enableSorting: true },
  { accessorKey: 'value', header: 'Value', enableSorting: true },
];

const data: TestRow[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: 200 },
];

const defaultProps = {
  columns,
  data,
  totalCount: 40,
  page: 1,
  pageSize: 20,
  onPageChange: vi.fn(),
  onSortChange: vi.fn(),
  sortBy: 'name',
  sortOrder: 'asc',
};

describe('ReportTable', () => {
  it('renders table with data rows', () => {
    render(<ReportTable<TestRow> {...defaultProps} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<ReportTable<TestRow> {...defaultProps} data={[]} isLoading />);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThanOrEqual(8);
  });

  it('renders empty state when no data', () => {
    render(
      <ReportTable<TestRow>
        {...defaultProps}
        data={[]}
        totalCount={0}
        emptyTitle="No results"
        emptyDescription="Try adjusting filters"
      />,
    );
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting filters')).toBeInTheDocument();
  });

  it('renders pagination when data exists', () => {
    render(<ReportTable<TestRow> {...defaultProps} />);
    expect(screen.getByText('Page 1 of 2 (40 total)')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('disables Previous on first page', () => {
    render(<ReportTable<TestRow> {...defaultProps} page={1} />);
    expect(screen.getByText('Previous')).toBeDisabled();
  });

  it('disables Next on last page', () => {
    render(<ReportTable<TestRow> {...defaultProps} page={2} />);
    expect(screen.getByText('Next')).toBeDisabled();
  });

  it('calls onPageChange on Next click', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(<ReportTable<TestRow> {...defaultProps} onPageChange={onPageChange} />);
    await user.click(screen.getByText('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn();
    const { user } = setup(<ReportTable<TestRow> {...defaultProps} onRowClick={onRowClick} />);
    await user.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alpha' }));
  });

  it('renders grand total row when provided', () => {
    render(
      <ReportTable<TestRow> {...defaultProps} grandTotalLabel="Total" grandTotalValue="300" />,
    );
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('renders sortable column headers with sort buttons', () => {
    render(<ReportTable<TestRow> {...defaultProps} />);
    // Sortable columns render as buttons
    const sortButtons = screen.getAllByRole('button', {
      name: /sortBy/,
    });
    expect(sortButtons.length).toBeGreaterThan(0);
  });

  it('shows refetch overlay when isFetching and not isLoading', () => {
    const { container } = render(
      <ReportTable<TestRow> {...defaultProps} isFetching isLoading={false} />,
    );
    expect(container.querySelector('.absolute.inset-0.z-10')).toBeTruthy();
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('does not show refetch overlay when isLoading (skeleton takes precedence)', () => {
    const { container } = render(
      <ReportTable<TestRow> {...defaultProps} data={[]} isLoading isFetching />,
    );
    expect(container.querySelector('.absolute.inset-0.z-10')).toBeNull();
  });

  it('calls onSortChange when a sortable header is clicked', async () => {
    const onSortChange = vi.fn();
    const { user } = setup(<ReportTable<TestRow> {...defaultProps} onSortChange={onSortChange} />);
    await user.click(screen.getByRole('button', { name: /sortBy.*Name/i }));
    expect(onSortChange).toHaveBeenCalled();
    const [col, order] = onSortChange.mock.calls[0]!;
    expect(col).toBe('name');
    expect(order === 'asc' || order === 'desc').toBe(true);
  });

  it('uses default No data title when empty state has no emptyTitle', () => {
    render(<ReportTable<TestRow> {...defaultProps} data={[]} totalCount={0} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('does not render pagination when totalCount is 0', () => {
    render(<ReportTable<TestRow> {...defaultProps} data={[]} totalCount={0} />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  it('hides pagination when loading', () => {
    render(<ReportTable<TestRow> {...defaultProps} data={[]} isLoading />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
  });

  it('renders empty icon when provided', () => {
    render(
      <ReportTable<TestRow>
        {...defaultProps}
        data={[]}
        totalCount={0}
        emptyIcon={<span data-testid="empty-icon">icon</span>}
        emptyTitle="Nothing here"
      />,
    );
    expect(screen.getByTestId('empty-icon')).toBeInTheDocument();
  });

  it('does not show cursor-pointer class when onRowClick is not provided', () => {
    render(<ReportTable<TestRow> {...defaultProps} onRowClick={undefined} />);
    const row = screen.getByText('Alpha').closest('tr');
    expect(row?.className).not.toContain('cursor-pointer');
  });

  it('shows cursor-pointer class when onRowClick is provided', () => {
    render(<ReportTable<TestRow> {...defaultProps} onRowClick={vi.fn()} />);
    const row = screen.getByText('Alpha').closest('tr');
    expect(row?.className).toContain('cursor-pointer');
  });

  it('calls onPageChange on Previous click when on page 2', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(
      <ReportTable<TestRow> {...defaultProps} page={2} onPageChange={onPageChange} />,
    );
    await user.click(screen.getByText('Previous'));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('does not render grand total row when only label is provided without value', () => {
    render(<ReportTable<TestRow> {...defaultProps} grandTotalLabel="Total" />);
    // grandTotalValue is not provided, so the total row should not render
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('renders correct page count for large datasets', () => {
    render(<ReportTable<TestRow> {...defaultProps} totalCount={100} pageSize={20} page={3} />);
    expect(screen.getByText('Page 3 of 5 (100 total)')).toBeInTheDocument();
  });
});
