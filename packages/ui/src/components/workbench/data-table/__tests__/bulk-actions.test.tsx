import type { ColumnDef } from '@tanstack/react-table';
import { Trash2 } from 'lucide-react';

import { render, screen, setup } from '../../../../__tests__/test-utils.js';
import { DataTable } from '../data-table.js';
import type { DataTableBulkAction } from '../types.js';

type Row = { id: string; name: string };

const rows: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
];

const columns: ColumnDef<Row, unknown>[] = [
  {
    id: 'select',
    header: () => 'sel',
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label={`Select ${row.original.name}`}
        checked={row.getIsSelected()}
        onChange={e => row.toggleSelected(e.target.checked)}
      />
    ),
    enableSorting: false,
  },
  { id: 'name', accessorKey: 'name', header: 'Name' },
];

const baseProps = {
  columns,
  data: rows,
  totalRows: rows.length,
  entityLabel: 'items',
  emptyTitle: 'none',
  noResultsTitle: 'none',
  pageIndex: 0,
  pageSize: 25,
  onPageChange: () => {},
  onPageSizeChange: () => {},
  getRowId: (row: Row) => row.id,
} as const;

describe('DataTable — bulk actions', () => {
  it('hides bulk-action bar with zero selection', () => {
    const actions: DataTableBulkAction<Row>[] = [
      { id: 'delete', icon: Trash2, label: 'Delete', onRun: vi.fn() },
    ];
    render(<DataTable {...baseProps} bulkActions={actions} />);
    expect(screen.queryByRole('region', { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it('reveals bar after row selection + runs action with selected originals', async () => {
    const onRun = vi.fn();
    const actions: DataTableBulkAction<Row>[] = [
      { id: 'delete', icon: Trash2, label: 'Delete', onRun },
    ];
    const { user } = setup(<DataTable {...baseProps} bulkActions={actions} />);
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(screen.getByRole('region', { name: /bulk actions/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRun).toHaveBeenCalledTimes(1);
    expect(onRun.mock.calls[0]?.[0]).toEqual([rows[0]]);
  });

  it('clear-selection button hides the bar', async () => {
    const actions: DataTableBulkAction<Row>[] = [
      { id: 'noop', icon: Trash2, label: 'Noop', onRun: vi.fn() },
    ];
    const { user } = setup(<DataTable {...baseProps} bulkActions={actions} />);
    await user.click(screen.getByRole('checkbox', { name: 'Select Alpha' }));
    expect(screen.getByRole('region', { name: /bulk actions/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(screen.queryByRole('region', { name: /bulk actions/i })).not.toBeInTheDocument();
  });
});
