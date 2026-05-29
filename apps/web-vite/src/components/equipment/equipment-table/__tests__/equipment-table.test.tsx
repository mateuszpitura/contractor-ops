/**
 * Step 10 port of apps/web/src/components/equipment/equipment-table/__tests__/equipment-table.test.tsx.
 *
 * Web-vite split the table into `EquipmentTableContainer` (owns the tRPC query
 * via useEquipmentTable) and `EquipmentTableView` (pure presentational, props
 * include the hook return). Tests target the view so no tRPC/react-query mocks
 * are needed — we pass a shaped `tableState`.
 */

import { describe, expect, it, vi } from 'vitest';

import { render, screen, setup } from '../../../../test/test-utils.js';
import type { EquipmentRow } from '../equipment-columns.js';
import { EquipmentTableView } from '../equipment-table.js';

type ViewProps = React.ComponentProps<typeof EquipmentTableView>;

function makeRow(overrides: Partial<EquipmentRow> = {}): EquipmentRow {
  return {
    id: 'eq-1',
    name: 'MacBook Pro',
    serialNumber: 'SN-001',
    type: 'LAPTOP',
    customType: null,
    status: 'AVAILABLE',
    notes: null,
    purchaseDate: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    currentAssignment: null,
    ...overrides,
  };
}

function makeViewProps(overrides: Partial<ViewProps> = {}): ViewProps {
  const equipmentQuery = {
    isPending: false,
    isFetching: false,
    data: { items: [], total: 0 },
  } as unknown as ViewProps['equipmentQuery'];
  return {
    onEdit: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onCreateShipment: vi.fn(),
    onRetire: vi.fn(),
    onAddEquipment: vi.fn(),
    parentLoading: undefined,
    equipmentQuery,
    data: [],
    totalRows: 0,
    search: '',
    typeFilter: [],
    statusFilter: [],
    page: 1,
    pageSize: 25,
    sortBy: 'createdAt',
    sortOrder: 'desc' as const,
    onSearchChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onPageChange: vi.fn(),
    onSortChange: vi.fn(),
    onClearFilters: vi.fn(),
    isLoading: false,
    isRefetching: false,
    activeFilterCount: 0,
    hasFiltersOrSearch: false,
    totalPages: 1,
    rowSelection: {},
    setRowSelection: vi.fn(),
    bulkActions: {
      onBulkRetire: vi.fn(async () => undefined),
      onBulkUnassign: vi.fn(async () => undefined),
      onExportCsv: vi.fn(),
      isRetiring: false,
      isUnassigning: false,
    },
    ...overrides,
  } as ViewProps;
}

describe('EquipmentTableView (web-vite)', () => {
  it('renders empty state heading when no data', () => {
    render(<EquipmentTableView {...makeViewProps()} />);
    expect(screen.getByText(/no equipment tracked yet/i)).toBeInTheDocument();
  });

  it('renders add equipment button in empty state', () => {
    render(<EquipmentTableView {...makeViewProps()} />);
    const buttons = screen.getAllByRole('button', { name: /add equipment/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onAddEquipment when add equipment button is clicked', async () => {
    const onAddEquipment = vi.fn();
    const { user } = setup(<EquipmentTableView {...makeViewProps({ onAddEquipment })} />);
    const addBtn = screen.getAllByRole('button', { name: /add equipment/i })[0];
    await user.click(addBtn as HTMLButtonElement);
    expect(onAddEquipment).toHaveBeenCalled();
  });

  it('renders the table element', () => {
    render(<EquipmentTableView {...makeViewProps()} />);
    expect(document.querySelector('table')).toBeInTheDocument();
  });

  it('renders toolbar with a search input', () => {
    render(<EquipmentTableView {...makeViewProps()} />);
    expect(document.querySelector('input')).toBeInTheDocument();
  });

  it('does not show pagination when no items', () => {
    render(<EquipmentTableView {...makeViewProps()} />);
    expect(screen.queryByText('Previous')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  it('renders pagination when items exist (totalRows > 0)', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow({ id: 'eq-1', name: 'Laptop 1' })],
          totalRows: 30,
          totalPages: 2,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /previous page/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
    // Item count lives in TableChrome (top-left of table), not in the footer.
  });

  it('disables previous button on first page', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 30,
          totalPages: 2,
          page: 1,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
  });

  it('disables next button on last page', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 5,
          totalPages: 1,
          page: 1,
        })}
      />,
    );
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('renders pagination controls even with a single item', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 1,
          totalPages: 1,
        })}
      />,
    );
    // Total row count is now in TableChrome (top-left), not the footer.
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('renders page indicator', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 50,
          totalPages: 2,
          page: 1,
        })}
      />,
    );
    expect(screen.getByText(/page 1 of 2/i)).toBeInTheDocument();
  });

  it('advances to next page when Next button is clicked', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(
      <EquipmentTableView
        {...makeViewProps({
          data: Array.from({ length: 25 }, (_, i) => makeRow({ id: `eq-${i}`, name: `Item ${i}` })),
          totalRows: 75,
          totalPages: 3,
          page: 1,
          onPageChange,
        })}
      />,
    );
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders data row content when items present', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow({ id: 'eq-1', name: 'MacBook Pro' })],
          totalRows: 1,
          totalPages: 1,
        })}
      />,
    );
    expect(screen.getByText('MacBook Pro')).toBeInTheDocument();
    expect(screen.queryByText(/no equipment tracked yet/i)).not.toBeInTheDocument();
  });

  it('handles search input changes (controlled via local state)', async () => {
    const { user } = setup(<EquipmentTableView {...makeViewProps()} />);
    const searchInput = document.querySelector('input') as HTMLInputElement;
    await user.type(searchInput, 'laptop');
    expect(searchInput.value).toBe('laptop');
  });

  it('renders column headers when data is present', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 1,
          totalPages: 1,
        })}
      />,
    );
    const headers = document.querySelectorAll('table th');
    expect(headers.length).toBeGreaterThan(2);
  });

  it('renders sortable column header buttons', () => {
    render(
      <EquipmentTableView
        {...makeViewProps({
          data: [makeRow()],
          totalRows: 1,
          totalPages: 1,
        })}
      />,
    );
    const sortButtons = document.querySelectorAll('table th button');
    expect(sortButtons.length).toBeGreaterThan(0);
  });
});
