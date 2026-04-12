import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import type { ContractorRow } from '../columns';
import { ContractorDataTable } from '../data-table';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: { items: [], total: 0 },
    isLoading: false,
    isFetching: false,
    isPending: false,
  })),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  keepPreviousData: undefined,
}));

vi.mock('@/trpc/init', () => ({
  trpc: {
    contractor: {
      list: {
        queryOptions: (input: unknown) => ({
          queryKey: ['contractor', 'list', input],
        }),
      },
      bulkArchive: { mutationOptions: (opts: Record<string, unknown>) => opts },
      bulkAssignOwner: { mutationOptions: (opts: Record<string, unknown>) => opts },
      export: { mutationOptions: (opts: Record<string, unknown>) => opts },
    },
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

vi.mock('../use-contractor-filters', () => ({
  useContractorFilters: () => [
    {
      page: 1,
      pageSize: 25,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: [],
      lifecycleStage: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    },
    vi.fn(),
  ],
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/workflows/template-picker-dialog', () => ({
  TemplatePicker: () => null,
}));

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 days ago',
}));

describe('ContractorDataTable', () => {
  it('renders toolbar and table structure', () => {
    render(<ContractorDataTable onRowClick={vi.fn()} onAddContractor={vi.fn()} />);
    // Should have search input
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    // Should have a table
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(<ContractorDataTable onRowClick={vi.fn()} onAddContractor={vi.fn()} />);
    // Empty state should have a CTA button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders data rows when items are returned', () => {
    const mockRow: ContractorRow = {
      id: 'c-1',
      legalName: 'ACME Corp',
      displayName: 'ACME',
      type: 'COMPANY',
      status: 'ACTIVE',
      lifecycleStage: 'ACTIVE',
      currency: 'PLN',
      email: 'test@acme.pl',
      taxId: '1234567890',
      customFieldsJson: null,
      owner: null,
      primaryTeam: null,
      billingProfiles: [],
      createdAt: null,
      updatedAt: '2026-01-01T00:00:00Z',
      complianceHealth: 'green',
    };

    vi.mocked(useQuery).mockReturnValue({
      data: { items: [mockRow], total: 1 },
      isLoading: false,
      isFetching: false,
      isPending: false,
    } as unknown);

    render(<ContractorDataTable onRowClick={vi.fn()} onAddContractor={vi.fn()} />);
    expect(screen.getByText('ACME')).toBeInTheDocument();
  });

  it('calls onRowClick when a data row is clicked', async () => {
    const mockRow: ContractorRow = {
      id: 'c-1',
      legalName: 'ACME Corp',
      displayName: 'ACME',
      type: 'COMPANY',
      status: 'ACTIVE',
      lifecycleStage: 'ACTIVE',
      currency: 'PLN',
      email: null,
      taxId: null,
      customFieldsJson: null,
      owner: null,
      primaryTeam: null,
      billingProfiles: [],
      createdAt: null,
      updatedAt: null,
      complianceHealth: 'green',
    };

    vi.mocked(useQuery).mockReturnValue({
      data: { items: [mockRow], total: 1 },
      isLoading: false,
      isFetching: false,
      isPending: false,
    } as unknown);

    const onRowClick = vi.fn();
    const { user } = setup(
      <ContractorDataTable onRowClick={onRowClick} onAddContractor={vi.fn()} />,
    );

    // Click on a table row (the one containing "ACME")
    const acmeCell = screen.getByText('ACME');
    const row = acmeCell.closest('tr');
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

    render(<ContractorDataTable onRowClick={vi.fn()} onAddContractor={vi.fn()} />);
    // Skeleton rows produce Skeleton components
    const skeletons = document.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders refetch overlay when isFetching with existing data', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { items: [], total: 0 },
      isLoading: false,
      isFetching: true,
      isPending: false,
    } as unknown);

    render(<ContractorDataTable onRowClick={vi.fn()} onAddContractor={vi.fn()} />);
    // Refetch overlay has a spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
