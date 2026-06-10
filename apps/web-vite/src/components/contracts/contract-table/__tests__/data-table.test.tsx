/**
 * ContractDataTable is presentational. All filter/data state
 * comes in via props (built by `useContractList` in the container). We
 * synthesize a minimal `ContractListTableProps` bag.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';

vi.mock('date-fns', async importOriginal => {
  const actual = await importOriginal<typeof import('date-fns')>();
  return {
    ...actual,
    formatDistanceToNow: () => '2 days ago',
    differenceInDays: () => 30,
    isPast: () => false,
  };
});

import type { ContractRow } from '../columns';
import { ContractDataTable } from '../data-table';

type Props = Parameters<typeof ContractDataTable>[0];

function makeProps(overrides: Partial<Props> = {}): Props {
  const filters: Props['filters'] = {
    page: 1,
    pageSize: 25,
    search: '',
    sortBy: 'endDate',
    sortOrder: 'asc',
    status: [],
    type: [],
    billingModel: [],
    ownerUserId: [],
    startDateFrom: '',
    startDateTo: '',
    endDateFrom: '',
    endDateTo: '',
    complianceRiskLevel: [],
  };
  return {
    data: [],
    totalRows: 0,
    users: [],
    filters,
    onFiltersChange: vi.fn(),
    onSearchChange: vi.fn(),
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    onSortChange: vi.fn(),
    clearFilters: vi.fn(),
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    bulkActions: { onBulkTerminate: vi.fn(), isTerminating: false },
    selectedRows: [],
    setSelectedRows: vi.fn(),
    columnVisibility: {},
    setColumnVisibility: vi.fn(),
    sorting: [],
    onSortingChange: vi.fn(),
    onRowClick: vi.fn(),
    onNewContract: vi.fn(),
    toolbar: <div data-testid="toolbar-slot" />,
    ...overrides,
  };
}

const mockRow: ContractRow = {
  id: 'ct-1',
  title: 'Service Agreement',
  type: 'B2B_MASTER_SERVICE',
  status: 'ACTIVE',
  startDate: '2024-01-01',
  endDate: '2025-12-31',
  currency: 'PLN',
  billingModel: 'HOURLY',
  rateType: 'PER_HOUR',
  rateValueMinor: 15000,
  complianceRiskLevel: null,
  contractor: { id: 'c-1', legalName: 'ACME Corp', displayName: 'ACME' },
  internalOwner: { id: 'u1', name: 'Jan' },
};

describe('ContractDataTable', () => {
  it('renders toolbar slot and the table', () => {
    render(<ContractDataTable {...makeProps()} />);
    expect(screen.getByTestId('toolbar-slot')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders data rows when items are present', () => {
    render(<ContractDataTable {...makeProps({ data: [mockRow], totalRows: 1 })} />);
    expect(screen.getByText('Service Agreement')).toBeInTheDocument();
  });

  it('calls onRowClick when a data row is clicked', async () => {
    const onRowClick = vi.fn();
    const { user } = setup(
      <ContractDataTable
        {...makeProps({
          data: [{ ...mockRow, title: 'Click Me Contract' }],
          totalRows: 1,
          onRowClick,
        })}
      />,
    );
    const cell = screen.getByText('Click Me Contract');
    const row = cell.closest('tr');
    if (row) await user.click(row);
    expect(onRowClick).toHaveBeenCalled();
  });

  it('renders skeleton placeholders when loading', () => {
    render(<ContractDataTable {...makeProps({ isLoading: true })} />);
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders pagination footer when there are rows', () => {
    render(<ContractDataTable {...makeProps({ data: [mockRow], totalRows: 50 })} />);
    // DataTablePagination renders a Previous/Next button pair when totalRows > 0.
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });
});
