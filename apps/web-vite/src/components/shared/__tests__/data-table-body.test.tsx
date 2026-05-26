/**
 * Step 10 port of apps/web/src/components/shared/__tests__/data-table-body.test.tsx.
 *
 * DataTableBody is the shared table body used across every data-table — it
 * owns the (loading skeleton | data rows | filtered no-results | empty)
 * branch logic plus the per-column skeleton shape mapping. The legacy
 * suite stubbed `flexRender` to passthrough so cell text could be
 * asserted; we keep that approach and replace user-event with the
 * domain-local `click` helper.
 */

import type { Table } from '@tanstack/react-table';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableBody } from '../data-table-body.js';
import { click, findButton, mount } from './_render.js';

vi.mock('@tanstack/react-table', () => ({
  flexRender: (cell: unknown) => cell,
}));

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

interface MockCell {
  id: string;
  column: { columnDef: { cell: string } };
}

interface MockRow {
  id: string;
  original: unknown;
  cells: MockCell[];
}

function createMockTable(rows: MockRow[] = []): Table<unknown> {
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
  } as unknown as Table<unknown>;
}

function renderBody(ui: React.ReactElement) {
  return mount(<table>{ui}</table>);
}

describe('DataTableBody (web-vite)', () => {
  it('renders skeleton rows when loading', async () => {
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable()}
        isLoading
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
        skeletonRows={3}
      />,
    );
    expect(container.querySelectorAll('tr')).toHaveLength(3);
    expect(container.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders data rows when data is present', async () => {
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
    const { container } = await renderBody(
      <DataTableBody
        table={table}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
      />,
    );
    expect(container.textContent ?? '').toContain('Alice');
    expect(container.textContent ?? '').toContain('Bob');
    expect(container.textContent ?? '').toContain('Engineer');
  });

  it('renders the empty-state copy when there are no rows and no filters', async () => {
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable([])}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No contractors yet"
        emptyDescription="Add your first contractor to get started."
        noResultsTitle="No results"
      />,
    );
    expect(container.textContent ?? '').toContain('No contractors yet');
    expect(container.textContent ?? '').toContain('Add your first contractor to get started.');
  });

  it('renders no-results copy when filters are active and rows are empty', async () => {
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable([])}
        isLoading={false}
        hasFiltersOrSearch
        emptyTitle="No data"
        noResultsTitle="No matching results"
        noResultsDescription="Try adjusting your filters."
      />,
    );
    expect(container.textContent ?? '').toContain('No matching results');
    expect(container.textContent ?? '').toContain('Try adjusting your filters.');
  });

  it('fires the empty-state CTA on click', async () => {
    const onCta = vi.fn();
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable([])}
        isLoading={false}
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        emptyCta="Add item"
        onEmptyCta={onCta}
        noResultsTitle="No results"
      />,
    );
    const button = findButton(container, 'Add item');
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);
    expect(onCta).toHaveBeenCalled();
  });

  it('fires the clear-filters CTA in the no-results state', async () => {
    const onClear = vi.fn();
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable([])}
        isLoading={false}
        hasFiltersOrSearch
        emptyTitle="No data"
        noResultsTitle="No results"
        noResultsCta="Clear filters"
        onClearFilters={onClear}
      />,
    );
    const button = findButton(container, 'Clear filters');
    expect(button).not.toBeNull();
    await click(button as HTMLButtonElement);
    expect(onClear).toHaveBeenCalled();
  });

  it('applies per-column skeleton shapes when descriptors are provided', async () => {
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable()}
        isLoading
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
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons).toHaveLength(2);
    expect(skeletons[0]?.className).toMatch(/h-4 w-4/);
    expect(skeletons[1]?.className).toMatch(/rounded-full/);
  });

  it('falls back to the default skeleton shape when no descriptor is provided', async () => {
    const { container } = await renderBody(
      <DataTableBody
        table={createMockTable()}
        isLoading
        hasFiltersOrSearch={false}
        emptyTitle="No data"
        noResultsTitle="No results"
        skeletonRows={1}
      />,
    );
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons).toHaveLength(2);
    for (const sk of Array.from(skeletons)) {
      expect(sk.className).toMatch(/h-4/);
      expect(sk.className).toMatch(/max-w-\[120px\]/);
    }
  });
});
