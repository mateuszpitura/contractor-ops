/**
 * Ported from apps/web/src/components/contracts/contract-table/__tests__/data-table-filters.test.tsx.
 *
 * Web-vite split: DataTableFilters takes `users` as a prop (no tRPC inside).
 * We pass a static user list and exercise badge / clear-all / remove flows.
 */

import { vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DataTableFilters } from '../data-table-filters';

const users = [
  { id: 'u1', userId: 'u1', name: 'Alice', email: 'alice@test.com' },
  { id: 'u2', userId: 'u2', name: 'Bob', email: 'bob@test.com' },
];

const emptyFilters = {
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

describe('DataTableFilters (contracts)', () => {
  it('renders filter button', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} users={users} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('shows active filter count badge', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('does not show badge when no filters are active', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} users={users} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('counts date filters in active filter count', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={vi.fn()}
        users={users}
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
        users={users}
      />,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders filter badge chips for active status filters', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders filter badge for billing model filter', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('Hourly')).toBeInTheDocument();
  });

  it('renders filter badge for compliance risk level', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, complianceRiskLevel: ['HIGH'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders date filter badges with label prefix', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText(/From: 2026-01-01/)).toBeInTheDocument();
  });

  it('renders owner filter badge with user name', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['u1'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('shows clear all when filters are active', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show clear all when no filters', () => {
    render(<DataTableFilters filters={emptyFilters} onFiltersChange={vi.fn()} users={users} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls onFiltersChange to clear all filters when clear all is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalledWith({
      status: [],
      type: [],
      billingModel: [],
      ownerUserId: [],
      startDateFrom: '',
      startDateTo: '',
      endDateFrom: '',
      endDateTo: '',
      complianceRiskLevel: [],
    });
  });

  it('calls onFiltersChange when a filter badge remove button is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, status: ['ACTIVE', 'DRAFT'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const activeChip = screen.getByText('Active').closest("[data-slot='badge']");
    const removeBtn = activeChip?.querySelector('button');
    expect(removeBtn).toBeTruthy();
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ status: ['DRAFT'] });
  });

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
        users={users}
      />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Non-Disclosure Agreement')).toBeInTheDocument();
    expect(screen.getByText(/To: 2026-12-31/)).toBeInTheDocument();
  });

  it('removes endDateFrom when its badge remove is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01' }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText(/From: 2026-01-01/).closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ endDateFrom: '' });
  });

  it('removes endDateTo when its badge remove is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateTo: '2026-12-31' }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText(/To: 2026-12-31/).closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ endDateTo: '' });
  });

  it('removes owner filter when badge is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['u1'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText('Alice').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ ownerUserId: [] });
  });

  it('removes type filter when badge is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, type: ['NDA'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText('Non-Disclosure Agreement').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ type: [] });
  });

  it('removes billing model filter badge', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText('Hourly').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ billingModel: [] });
  });

  it('removes compliance risk level badge', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableFilters
        filters={{ ...emptyFilters, complianceRiskLevel: ['HIGH'] }}
        onFiltersChange={onFiltersChange}
        users={users}
      />,
    );
    const badge = screen.getByText('High').closest("[data-slot='badge']");
    const removeBtn = badge?.querySelector('button');
    await user.click(removeBtn!);
    expect(onFiltersChange).toHaveBeenCalledWith({ complianceRiskLevel: [] });
  });

  it('renders owner ID as badge text when user not found in list', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, ownerUserId: ['unknown-id'] }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText('unknown-id')).toBeInTheDocument();
  });

  it('renders both date filter badges', () => {
    render(
      <DataTableFilters
        filters={{ ...emptyFilters, endDateFrom: '2026-01-01', endDateTo: '2026-12-31' }}
        onFiltersChange={vi.fn()}
        users={users}
      />,
    );
    expect(screen.getByText(/From: 2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText(/To: 2026-12-31/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
