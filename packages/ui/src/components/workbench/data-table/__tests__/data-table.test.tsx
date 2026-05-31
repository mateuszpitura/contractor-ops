import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';

import { render, screen, setup } from '../../../../__tests__/test-utils.js';
import { DataTable } from '../data-table.js';
import type { DataTableProps } from '../types.js';

type Row = { id: string; name: string; value: number };

const columns: ColumnDef<Row, unknown>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', enableSorting: true },
  { id: 'value', accessorKey: 'value', header: 'Value' },
];

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: String(i + 1), name: `Row ${i + 1}`, value: i }));

function harness(overrides: Partial<DataTableProps<Row>> = {}) {
  const defaults: DataTableProps<Row> = {
    columns,
    data: makeRows(25),
    totalRows: 100,
    entityLabel: 'rows',
    emptyTitle: 'No rows',
    noResultsTitle: 'Nothing matches',
    pageIndex: 0,
    pageSize: 25,
    onPageChange: () => {},
    onPageSizeChange: () => {},
  };
  return <DataTable {...defaults} {...overrides} />;
}

describe('DataTable', () => {
  it('renders rows from the data prop', () => {
    render(harness());
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByText('Row 25')).toBeInTheDocument();
  });

  it('renders count strip with entityLabel', () => {
    render(harness({ totalRows: 100 }));
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('rows')).toBeInTheDocument();
  });

  it('shows skeleton rows while loading', () => {
    const { container } = render(harness({ isLoading: true, data: [] }));
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0);
  });

  it('renders compact empty state with title when no rows and no filters', () => {
    render(harness({ data: [], totalRows: 0, emptyTitle: 'No rows yet' }));
    expect(screen.getByText('No rows yet')).toBeInTheDocument();
  });

  it('renders no-results row when filters active and zero rows', () => {
    render(
      harness({
        data: [],
        totalRows: 0,
        hasFiltersOrSearch: true,
        noResultsTitle: 'Nothing matches',
      }),
    );
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
  });

  it('fires onPageChange when next pressed', async () => {
    const onPageChange = vi.fn();
    const { user } = setup(harness({ onPageChange, totalRows: 100 }));
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('disables pagination controls while loading', () => {
    render(harness({ isLoading: true }));
    expect(screen.getByRole('button', { name: /next page/i })).toBeDisabled();
  });

  it('hides pagination footer when totalRows <= smallest page-size option', () => {
    render(harness({ data: makeRows(5), totalRows: 5 }));
    expect(screen.queryByRole('button', { name: /next page/i })).not.toBeInTheDocument();
  });

  it('exposes loading state to toolbar render prop', () => {
    render(
      harness({
        isLoading: true,
        toolbar: ({ disabled }) => <div data-testid="toolbar">{disabled ? 'off' : 'on'}</div>,
      }),
    );
    expect(screen.getByTestId('toolbar')).toHaveTextContent('off');
  });

  it('renders rightSlot via render prop with table instance', () => {
    render(
      harness({
        rightSlot: table => <span data-testid="rs">{table.getRowModel().rows.length}</span>,
      }),
    );
    expect(screen.getByTestId('rs')).toHaveTextContent('25');
  });

  it('renders featured empty state when emptyIllustration is set + no data + no filters', () => {
    const Illustration = ({ className }: { className?: string }) => (
      <svg data-testid="illustration" className={className} />
    );
    render(
      harness({
        data: [],
        totalRows: 0,
        emptyTitle: 'No contractors yet',
        emptyDescription: 'Add your first contractor to get started.',
        emptyIllustration: Illustration,
      }),
    );
    expect(screen.getByTestId('illustration')).toBeInTheDocument();
    expect(screen.getByText('No contractors yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first contractor to get started.')).toBeInTheDocument();
  });

  it('client pagination slices data locally', async () => {
    function Harness() {
      const [pageIndex, setPageIndex] = useState(0);
      return (
        <DataTable
          columns={columns}
          data={makeRows(30)}
          totalRows={30}
          entityLabel="rows"
          emptyTitle="empty"
          noResultsTitle="none"
          clientPagination
          pageIndex={pageIndex}
          pageSize={10}
          onPageChange={setPageIndex}
          onPageSizeChange={() => {}}
        />
      );
    }
    const { user } = setup(<Harness />);
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 11')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText('Row 11')).toBeInTheDocument();
    expect(screen.queryByText('Row 1')).not.toBeInTheDocument();
  });
});
