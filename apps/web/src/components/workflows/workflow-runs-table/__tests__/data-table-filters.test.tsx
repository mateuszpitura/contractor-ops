import { useQuery } from '@tanstack/react-query';
import { render, screen, setup } from '@/test/test-utils';
import { DataTableFilters } from '../data-table-filters';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

vi.mock('@/trpc/init', () => ({
  trpc: {
    workflow: {
      listTemplates: { queryOptions: () => ({ queryKey: ['workflow', 'listTemplates'] }) },
    },
  },
}));

const mockedUseQuery = vi.mocked(useQuery);

describe('DataTableFilters', () => {
  beforeEach(() => {
    mockedUseQuery.mockReturnValue({ data: { items: [] }, isLoading: false } as unknown as never);
  });

  it('renders filter button', () => {
    render(
      <DataTableFilters
        filters={{ status: [], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('shows filter count badge when filters are active', () => {
    render(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders active filter badges', () => {
    render(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: true }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Overdue only')).toBeInTheDocument();
  });

  it('shows clear all when filters are active', () => {
    render(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show filter count or badges when no filters active', () => {
    render(
      <DataTableFilters
        filters={{ status: [], templateId: [], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('shows correct filter count for multiple active filters', () => {
    render(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS', 'COMPLETED'], templateId: ['t-1'], overdueOnly: true }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders template filter badges using template name', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [{ id: 't-1', name: 'Onboarding Flow' }] },
      isLoading: false,
    } as unknown as never);
    render(
      <DataTableFilters
        filters={{ status: [], templateId: ['t-1'], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Onboarding Flow')).toBeInTheDocument();
  });

  it('falls back to templateId when template not found in query data', () => {
    mockedUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as unknown as never);
    render(
      <DataTableFilters
        filters={{ status: [], templateId: ['unknown-id'], overdueOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('calls onFiltersChange with cleared filters when clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: ['IN_PROGRESS'], templateId: [], overdueOnly: true }}
        onFiltersChange={onFiltersChange}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      templateId: [],
      overdueOnly: false,
    });
  });

  it('calls onFiltersChange to remove overdue filter when badge X is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ status: [], templateId: [], overdueOnly: true }}
        onFiltersChange={onFiltersChange}
      />,
    );
    // Find the remove button for overdue badge
    const removeBtn = screen.getByRole('button', { name: /remove.*overdue/i });
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ overdueOnly: false });
  });
});
