/**
 * Ported from apps/web/src/components/workflows/workflow-runs-table/__tests__/data-table-pagination.test.tsx.
 *
 * Web-vite DataTablePagination is presentational. We pass a minimal mock
 * table with the methods the component reads.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { click, findButton, mount } from '../../__tests__/_render.js';
import { DataTablePagination } from '../data-table-pagination.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function makeTable(selected = 0) {
  return {
    getFilteredSelectedRowModel: () => ({
      rows: Array.from({ length: selected }, (_, i) => ({ original: { id: `r${i}` } })),
    }),
  } as never;
}

describe('DataTablePagination (workflow runs)', () => {
  it('disables Previous on page 1', async () => {
    await mount(
      <DataTablePagination
        table={makeTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const prev = buttons.find(b =>
      b.getAttribute('aria-label')?.toLowerCase().includes('previous'),
    );
    expect(prev?.disabled).toBe(true);
  });

  it('disables Next on the last page', async () => {
    await mount(
      <DataTablePagination
        table={makeTable()}
        totalRows={50}
        pageSize={25}
        currentPage={2}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const next = buttons.find(b => b.getAttribute('aria-label')?.toLowerCase().includes('next'));
    expect(next?.disabled).toBe(true);
  });

  it('invokes onPageChange when Next is clicked', async () => {
    const onPageChange = vi.fn();
    await mount(
      <DataTablePagination
        table={makeTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={onPageChange}
        onPageSizeChange={vi.fn()}
      />,
    );
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const next = buttons.find(b =>
      b.getAttribute('aria-label')?.toLowerCase().includes('next'),
    ) as HTMLButtonElement;
    await click(next);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders the selected-row label when rows are selected', async () => {
    await mount(
      <DataTablePagination
        table={makeTable(3)}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    expect(document.body.textContent).toMatch(/3/);
  });

  it('renders the rows-per-page select', async () => {
    await mount(
      <DataTablePagination
        table={makeTable()}
        totalRows={100}
        pageSize={25}
        currentPage={1}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />,
    );
    const rowsBtn = findButton(document.body, /rows per page|25/i);
    // Either label exists OR the trigger shows the value
    expect(rowsBtn).not.toBeNull();
  });
});
