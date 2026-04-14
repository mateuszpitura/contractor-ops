import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DataTableFilters } from '../data-table-filters';

vi.mock('@tanstack/react-query', async importOriginal => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com' },
        { id: 'u2', name: 'Bob', email: 'bob@test.com' },
      ],
    }),
  };
});
vi.mock('@/trpc/init', () => ({
  trpc: {
    user: {
      list: { queryOptions: () => ({ queryKey: ['user', 'list'] }) },
    },
  },
}));

const emptyFilters = {
  status: [],
  type: [],
  billingModel: [],
  ownerUserId: [],
  endDateFrom: '',
  endDateTo: '',
  complianceRiskLevel: [],
};

describe('DataTableFilters (contracts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- Filter button ----
  it('renders filter button', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  // ---- Filter count badge ----
  it('shows active filter count badge', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show badge when no filters are active', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} />);
    // No count badge
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('counts date filters in active filter count', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('counts multiple filter types in badge', () => {
    render(
      <DataTableFilters
        filters={{
          ...emptyFilters,
          status: ['ACTIVE'],
          type: ['NDA'],
          complianceRiskLevel: ['HIGH'],
        }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  // ---- Filter chips ----
  it('renders filter badge chips for active status filters', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders filter badge for billing model filter', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Hourly')).toBeInTheDocument();
  });

  it('renders filter badge for compliance risk level', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, complianceRiskLevel: ['HIGH'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders date filter badges with label prefix', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/From: 2026-01-01/)).toBeInTheDocument();
  });

  it('renders owner filter badge with user name', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['u1'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  // ---- Clear all ----
  it('shows clear all when filters are active', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show clear all when no filters', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onFiltersChange to clear all filters when clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
    });
  });

  // ---- Remove individual filter ----
  it('calls onFiltersChange when a filter badge remove button is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    // Find the remove button for "Active" badge
    const activeChip = screen.getByText('Active').closest("[data-slot='badge']");
    const removeBtn = activeChip?.querySelector('button');
    expect(removeBtn).toBeTruthy();
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: ['DRAFT'],
    });
  });

  // ---- Multiple filter types displayed ----
  it('renders multiple filter type chips simultaneously', () => {
    render(
      <DataTableFilters
        filters={{
          ...emptyFilters,
          status: ['ACTIVE'],
          type: ['NDA'],
          endDateTo: '2026-12-31',
        }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
    expect(screen.getByText(/To: 2026-12-31/)).toBeInTheDocument();
  });

  // ---- Remove date filters ----
  it('removes endDateFrom when its badge remove is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText(/From: 2026-01-01/).closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ endDateFrom: '' });
  });

  it('removes endDateTo when its badge remove is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateTo: '2026-12-31' }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText(/To: 2026-12-31/).closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ endDateTo: '' });
  });

  // ---- Remove owner filter ----
  it('removes owner filter when badge is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['u1'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText('Alice').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ ownerUserId: [] });
  });

  // ---- Remove type filter ----
  it('removes type filter when badge is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, type: ['NDA'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText('Non-Disclosure Agreement').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ type: [] });
  });

  // ---- Remove billing model filter ----
  it('removes billing model filter badge', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText('Hourly').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ billingModel: [] });
  });

  // ---- Remove compliance risk filter ----
  it('removes compliance risk level badge', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, complianceRiskLevel: ['HIGH'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const badge = screen.getByText('High').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ complianceRiskLevel: [] });
  });

  // ---- Owner badge shows ID when owner not found ----
  it('renders owner ID as badge text when user not found in list', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['unknown-id'] }}
        onFiltersChange={vi.fn()}
      />,
    );
    // Falls back to owner ID when no match in the mock user list
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  // ---- Both date filters at once ----
  it('renders both date filter badges', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01', endDateTo: '2026-12-31' }}
        onFiltersChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/From: 2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/To: 2026-12-31/)).toBeInTheDocument();
    // Count badge should be 2
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
