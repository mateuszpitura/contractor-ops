/**
 * web-vite port. Toolbar takes `users` + isSearching + disabled directly.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup, waitFor } from '../../../../test/test-utils.js';
import { DataTableToolbar } from '../data-table-toolbar.js';

const defaultFilters = {
  status: [],
  lifecycleStage: [],
  type: [],
  owner: [],
  team: [],
  billingModel: [],
  health: [],
};

const baseProps = {
  search: '',
  onSearchChange: vi.fn(),
  filters: defaultFilters,
  onFiltersChange: vi.fn(),
  users: [],
  isSearching: false,
  disabled: false,
  onAddContractor: vi.fn(),
};

describe('DataTableToolbar', () => {
  it('renders search input', () => {
    render(<DataTableToolbar {...baseProps} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders add contractor button', () => {
    render(<DataTableToolbar {...baseProps} />);
    expect(screen.getByText('Add contractor')).toBeInTheDocument();
  });

  it('renders import button when onImport is provided', () => {
    render(<DataTableToolbar {...baseProps} onImport={vi.fn()} />);
    expect(screen.getByText('Import')).toBeInTheDocument();
  });

  it('does not render import button when onImport is not provided', () => {
    render(<DataTableToolbar {...baseProps} />);
    expect(screen.queryByText('Import')).not.toBeInTheDocument();
  });

  it('shows clear all when SECONDARY filters are active (lifecycle lives in chip bar)', () => {
    render(
      <DataTableToolbar {...baseProps} filters={{ ...defaultFilters, billingModel: ['FIXED'] }} />,
    );
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show clear all when no secondary filters active', () => {
    render(<DataTableToolbar {...baseProps} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('renders search input with initial value', () => {
    render(<DataTableToolbar {...baseProps} search="test query" />);
    expect(screen.getByRole('textbox')).toHaveValue('test query');
  });

  it('updates local search value on input', async () => {
    const { user } = setup(<DataTableToolbar {...baseProps} />);
    await user.type(screen.getByRole('textbox'), 'abc');
    expect(screen.getByRole('textbox')).toHaveValue('abc');
  });

  it('shows the lifecycle popover trigger with a count badge when stages are set', () => {
    render(
      <DataTableToolbar
        {...baseProps}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE'] }}
      />,
    );
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('reflects the count of selected lifecycle stages in the popover trigger', () => {
    render(
      <DataTableToolbar
        {...baseProps}
        filters={{ ...defaultFilters, lifecycleStage: ['ACTIVE', 'DRAFT'] }}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders filter badge for billing model filter', () => {
    render(
      <DataTableToolbar {...baseProps} filters={{ ...defaultFilters, billingModel: ['FIXED'] }} />,
    );
    expect(screen.getByText('Fixed')).toBeInTheDocument();
  });

  it('renders filter badge for health filter', () => {
    render(<DataTableToolbar {...baseProps} filters={{ ...defaultFilters, health: ['green'] }} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('clears all filters when "Clear all" is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        {...baseProps}
        filters={{ ...defaultFilters, billingModel: ['FIXED'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    await user.click(screen.getByText('Clear all'));
    expect(onFiltersChange).toHaveBeenCalled();
  });

  it('calls onAddContractor when add button is clicked', async () => {
    const onAdd = vi.fn();
    const { user } = setup(<DataTableToolbar {...baseProps} onAddContractor={onAdd} />);
    await user.click(screen.getByText('Add contractor'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onImport when import button is clicked', async () => {
    const onImport = vi.fn();
    const { user } = setup(<DataTableToolbar {...baseProps} onImport={onImport} />);
    await user.click(screen.getByText('Import'));
    expect(onImport).toHaveBeenCalled();
  });

  it('renders loading spinner when isSearching is true', () => {
    const { container } = render(
      <DataTableToolbar {...baseProps} search="test" isSearching={true} />,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('calls onSearchChange after debounce when user types', async () => {
    const onSearchChange = vi.fn();
    const { user } = setup(<DataTableToolbar {...baseProps} onSearchChange={onSearchChange} />);
    await user.type(screen.getByRole('textbox'), 'acme');
    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalled();
    });
  });

  it('removes a secondary filter when its badge X is clicked', async () => {
    const onFiltersChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        {...baseProps}
        filters={{ ...defaultFilters, billingModel: ['HOURLY'] }}
        onFiltersChange={onFiltersChange}
      />,
    );
    const removeBtn = screen.getByLabelText(/Remove filter/i);
    await user.click(removeBtn);
    expect(onFiltersChange).toHaveBeenCalledWith({ billingModel: [] });
  });
});
