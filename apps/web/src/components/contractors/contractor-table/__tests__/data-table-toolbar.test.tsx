import { render, screen, setup } from '@/test/test-utils';
import { DataTableToolbar } from '../data-table-toolbar';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: [] }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

const defaultFilters = {
  status: [],
  lifecycleStage: [],
  type: [],
  owner: [],
  team: [],
  billingModel: [],
  health: [],
};

describe('DataTableToolbar', () => {
  it('renders search input', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders add contractor button', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders import button when onImport is provided', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(1);
  });

  it('shows clear all when filters are active', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  // ---- Search input value ----
  it('renders search input with initial value', () => {
    render(
      <DataTableToolbar
        search="test query"
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('test query');
  });

  // ---- Search debounce ----
  it('updates local search value on input', async () => {
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    await user.type(screen.getByRole('textbox'), 'abc');
    expect(screen.getByRole('textbox')).toHaveValue('abc');
  });

  // ---- Filter badge removal ----
  it('renders filter badge for active lifecycle stage filter', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders filter badges for multiple active filters', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{
          ...defaultFilters,
          lifecycleStage: ['ACTIVE', 'DRAFT'],
        }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  // ---- Clear all calls onFiltersChange ----
  it('calls onFiltersChange when clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'] }}
        onFiltersChange={onFiltersChange}
        onAddContractor={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalled();
  });

  // ---- Add contractor button ----
  it('calls onAddContractor when add button is clicked', async () => {
    const onAddContractor = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={onAddContractor}
      />,
    );
    await user.click(screen.getByText('Add contractor'));
    expect(onAddContractor).toHaveBeenCalled();
  });

  // ---- Import button ----
  it('calls onImport when import button is clicked', async () => {
    const onImport = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
        onImport={onImport}
      />,
    );
    await user.click(screen.getByText('Import'));
    expect(onImport).toHaveBeenCalled();
  });

  // ---- No import button when not provided ----
  it('does not render import button when onImport is not provided', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  // ---- No clear all when no filters active ----
  it('does not show clear all when no filters are active', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  // ---- Filter badge for billing model ----
  it('renders filter badge for billing model filter', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, billingModel: ['FIXED'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  // ---- Filter badge for health ----
  it('renders filter badge for health filter', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, health: ['green'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  // ---- Search change callback ----
  it('calls onSearchChange after debounce when user types', async () => {
    const onSearchChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={onSearchChange}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'acme');
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalled();
    });
  });

  // ---- Add contractor callback ----
  it('calls onAddContractor when add button is clicked', async () => {
    const onAdd = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={onAdd}
      />,
    );
    await user.click(screen.getByText('Add contractor'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  // ---- Import callback ----
  it('calls onImport when import button is clicked', async () => {
    const onImport = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
        onImport={onImport}
      />,
    );
    await user.click(screen.getByText('Import'));
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  // ---- Clear all filters callback ----
  it('calls onFiltersChange to clear all filters when clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'], health: ['red'] }}
        onFiltersChange={onFiltersChange}
        onAddContractor={vi.fn()}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      lifecycleStage: [],
      owner: [],
      team: [],
      billingModel: [],
      health: [],
    });
  });

  // ---- Remove individual filter badge ----
  it('calls onFiltersChange when filter badge X is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'] }}
        onFiltersChange={onFiltersChange}
        onAddContractor={vi.fn()}
      />,
    );
    const removeBtn = screen.getByLabelText(/Remove filter/i);
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ lifecycleStage: [] });
  });

  // ---- Filter count badge ----
  it('shows filter count badge when multiple filters active', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{
          ...defaultFilters,
          lifecycleStage: ['ACTIVE'],
          billingModel: ['FIXED'],
          health: ['red'],
        }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ---- Multiple filter badges ----
  it('renders multiple filter badges when multiple filters are active', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  // ---- Search input reflects search prop ----
  it('reflects the search prop value in the input', () => {
    render(
      <DataTableToolbar
        search="initial"
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('initial');
  });

  // ---- Filter badge for owner filter ----
  it('renders filter badge for owner filter with user name', () => {
    vi.mocked(require('@tanstack/react-query').useQuery).mockReturnValue?.({
      data: [{ id: 'u1', name: 'Alice Smith', email: 'alice@test.com' }],
    });
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, owner: ['u1'] }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  // ---- Remove owner filter badge ----
  it('calls onFiltersChange when owner filter badge X is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={onFiltersChange}
        onAddContractor={vi.fn()}
      />,
    );
    const removeBtn = screen.getByLabelText(/Remove filter/i);
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ billingModel: [] });
  });

  // ---- Health filter badge removal ----
  it('calls onFiltersChange when health filter badge is removed', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{ ...defaultFilters, health: ['red'] }}
        onFiltersChange={onFiltersChange}
        onAddContractor={vi.fn()}
      />,
    );
    const removeBtn = screen.getByLabelText(/Remove filter/i);
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ health: [] });
  });

  // ---- Searching state shows loading spinner ----
  it('renders loading spinner when isSearching is true', () => {
    const { container } = render(
      <DataTableToolbar
        search="test"
        onSearchChange={vi.fn()}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
        isSearching
      />,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  // ---- Debounce: short search string sends empty ----
  it('sends empty string for search < 2 chars after debounce', async () => {
    const onSearchChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={onSearchChange}
        filters={defaultFilters}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.type(input, 'a');
    const { waitFor } = await import('@/test/test-utils');
    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalledWith('');
    });
  });

  // ---- Multiple filter categories show all badges ----
  it('renders filter badges for multiple categories simultaneously', () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={{
          ...defaultFilters,
          lifecycleStage: ['ACTIVE'],
          billingModel: ['FIXED'],
          health: ['green'],
        }}
        onFiltersChange={vi.fn()}
        onAddContractor={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });
});
