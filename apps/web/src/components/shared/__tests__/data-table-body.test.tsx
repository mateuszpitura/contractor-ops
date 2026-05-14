import { describe, expect, it, vi } from 'vitest';
import { render, screen, setup } from '@/test/test-utils';
import { DataTableBody } from '../data-table-body';

vi.mock('@tanstack/react-table', () => ({
  flexRender: (cell: unknown) => cell,
}));

function createMockTable(
  rows: Array<{
    id: string;
    original: unknown;
    cells: Array<{ id: string; column: { columnDef: { cell: string } } }>;
  }> = [],
) {
  return {
    getVisibleLeafColumns: () => [{ id: 'col-1' }, { id: 'col-2' }],
    getRowModel: () => ({
      rows: rows.map(r => ({
        ...r,
        getIsSelected: () => false,
        getVisibleCells: () =>
          r.cells.map(c => ({
            ...c,
            getContext: () => ({}),
          })),
      })),
    }),
  };
}

function renderInTable(ui: React.ReactElement) {
  return render(<table>{ui}</table>);
}

function setupInTable(ui: React.ReactElement) {
  return setup(<table>{ui}</table>);
}

describe('DataTableBody', () => {
  it('renders skeleton rows when loading', () => {
    const table = createMockTable();
    renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={true}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
        skeletonRows={3}
      />,
    );
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
  });

  it('renders data rows when data is present', () => {
    const table = createMockTable([
      {
        id: 'row-1',
        original: { name: 'Alice' },
        cells: [
          { id: 'c1', column: { columnDef: { cell: 'Alice' } } },
          { id: 'c2', column: { columnDef: { cell: 'Engineer' } } },
        ],
      },
      {
        id: 'row-2',
        original: { name: 'Bob' },
        cells: [
          { id: 'c3', column: { columnDef: { cell: 'Bob' } } },
          { id: 'c4', column: { columnDef: { cell: 'Designer' } } },
        ],
      },
    ]);
    renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders empty state when no rows and no filters', () => {
    const table = createMockTable([]);
    renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No contractors yet"
        emptyDescription="Add your first contractor to get started."
        noResultsTitle="No results"
      />,
    );
    expect(screen.getByText('No contractors yet')).toBeInTheDocument();
    expect(screen.getByText('Add your first contractor to get started.')).toBeInTheDocument();
  });

  it('renders no-results state when no rows and filters active', () => {
    const table = createMockTable([]);
    renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={false}
        hasFiltersOrSearch={true}
        emptyTitle="No data"
        noResultsTitle="No matching results"
        noResultsDescription="Try adjusting your filters."
      />,
    );
    expect(screen.getByText('No matching results')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument();
  });

  it('renders empty CTA button when provided', async () => {
    const table = createMockTable([]);
    const onCta = vi.fn();
    const { user } = setupInTable(
      <DataTableBody
        table={table as never}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        emptyCta="Add item"
        onEmptyCta={onCta}
        noResultsTitle="No results"
      />,
    );
    const button = screen.getByRole('button', { name: 'Add item' });
    await user.click(button);
    expect(onCta).toHaveBeenCalled();
  });

  it('renders clear-filters button in no-results state', async () => {
    const table = createMockTable([]);
    const onClear = vi.fn();
    const { user } = setupInTable(
      <DataTableBody
        table={table as never}
        isLoading={false}
        hasFiltersOrSearch={true}
        emptyTitle="No data"
        noResultsTitle="No results"
        noResultsCta="Clear filters"
        onClearFilters={onClear}
      />,
    );
    const button = screen.getByRole('button', { name: 'Clear filters' });
    await user.click(button);
    expect(onClear).toHaveBeenCalled();
  });

  it('applies per-column skeleton shapes when skeletonColumns is provided', () => {
    const table = createMockTable();
    const { container } = renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={true}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
        skeletonRows={1}
        skeletonColumns={{
          'col-1': { shape: 'checkbox' },
          'col-2': { shape: 'badge' },
        }}
      />,
    );

    // Two cells in the single skeleton row — one checkbox-sized, one badge-shaped.
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(2);
    expect(skeletons[0]?.className).toMatch(/h-4 w-4/);
    expect(skeletons[1]?.className).toMatch(/rounded-full/);
  });

  it('falls back to default skeleton shape when no descriptor is provided', () => {
    const table = createMockTable();
    const { container } = renderInTable(
      <DataTableBody
        table={table as never}
        isLoading={true}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
        skeletonRows={1}
      />,
    );

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(2);
    for (const sk of skeletons) {
      expect(sk.className).toMatch(/h-4/);
      expect(sk.className).toMatch(/max-w-\[120px\]/);
    }
  });
});
