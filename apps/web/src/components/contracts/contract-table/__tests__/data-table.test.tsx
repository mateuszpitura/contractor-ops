import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import type { ContractRow } from '../columns';
import { ContractDataTable } from '../data-table';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: { items: [], totalCount: 0 },
      isLoading: false,
      isFetching: false,
      isPending: false,
    })),
    useMutation: () => ({ mutate: vi.fn(), isPending: false }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
    keepPreviousData: undefined,
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    contract: {
      list: {
        queryOptions: (input: unknown) => ({
          queryKey: ['contract', 'list', input],
        }),
      },
      bulkTransition: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

vi.mock('../use-contract-filters', () => ({
  useContractFilters: () => [
    {
      page: 1,
      pageSize: 25,
      search: '',
      sortBy: 'endDate',
      sortOrder: 'asc',
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
    },
    vi.fn(),
  ],
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
  differenceInDays: () => 30,
  isPast: () => false,
}));

describe('ContractDataTable', () => {
  it('renders toolbar and table', () => {
    render(<ContractDataTable onRowClick={vi.fn()} onNewContract={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<ContractDataTable onRowClick={vi.fn()} onNewContract={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders data rows when items are returned', () => {
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

    vi.mocked(useQuery).mockReturnValue({
      data: { items: [mockRow], totalCount: 1 },
      isLoading: false,
      isFetching: false,
      isPending: false,
    } as unknown);

    render(<ContractDataTable onRowClick={vi.fn()} onNewContract={vi.fn()} />);
    expect(screen.getByText('Service Agreement')).toBeInTheDocument();
  });

  it('calls onRowClick when a data row is clicked', async () => {
    const mockRow: ContractRow = {
      id: 'ct-1',
      title: 'Click Me Contract',
      type: 'B2B_MASTER_SERVICE',
      status: 'ACTIVE',
      startDate: null,
      endDate: null,
      currency: 'PLN',
      billingModel: 'HOURLY',
      rateType: 'PER_HOUR',
      rateValueMinor: null,
      complianceRiskLevel: null,
      contractor: { id: 'c-1', legalName: 'ACME Corp', displayName: null },
      internalOwner: null,
    };

    vi.mocked(useQuery).mockReturnValue({
      data: { items: [mockRow], totalCount: 1 },
      isLoading: false,
      isFetching: false,
      isPending: false,
    } as unknown);

    const onRowClick = vi.fn();
    const { user } = setup(<ContractDataTable onRowClick={onRowClick} onNewContract={vi.fn()} />);

    const cell = screen.getByText('Click Me Contract');
    const row = cell.closest('tr');
    if (row) await user.click(row);
    expect(onRowClick).toHaveBeenCalledWith(mockRow);
  });

  it('renders skeleton rows when loading', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isPending: true,
    } as unknown);

    render(<ContractDataTable onRowClick={vi.fn()} onNewContract={vi.fn()} />);
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders refetch overlay when isFetching with existing data', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { items: [], totalCount: 0 },
      isLoading: false,
      isFetching: true,
      isPending: false,
    } as unknown);

    render(<ContractDataTable onRowClick={vi.fn()} onNewContract={vi.fn()} />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
