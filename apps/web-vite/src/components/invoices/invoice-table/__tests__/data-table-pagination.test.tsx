import type { ColumnDef } from '@tanstack/react-table';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { cleanup } from '@testing-library/react';
import { useState } from 'react';

import { render, screen, setup } from '@/test/test-utils';

import { DataTablePagination } from '../data-table-pagination';

afterEach(() => {
  cleanup();
});

type Row = { id: string };

function PaginationHarness({
  totalRows = 25,
  initialPage = 1,
  initialPageSize = 10,
}: {
  totalRows?: number;
  initialPage?: number;
  initialPageSize?: number;
}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const columns: ColumnDef<Row>[] = [{ accessorKey: 'id', header: 'ID' }];
  const data: Row[] = [{ id: '1' }];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    getRowId: row => row.id,
  });

  return (
    <DataTablePagination
      table={table}
      totalRows={totalRows}
      pageSize={pageSize}
      currentPage={page}
      onPageChange={setPage}
      onPageSizeChange={setPageSize}
    />
  );
}

describe('DataTablePagination', () => {
  // i18n ICU compiler caches a parsed message after first render — warmup so
  // tests asserting interpolated copy ("of 25", "Page 1 of 3") hit the cache.
  beforeAll(() => {
    const { unmount } = render(<PaginationHarness />);
    unmount();
  });

  it('renders page indicator (total row count lives in TableChrome, not pagination)', () => {
    render(<PaginationHarness />);
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  it('advances page when Next is clicked', async () => {
    const { user } = setup(<PaginationHarness />);
    await user.click(screen.getAllByRole('button', { name: /next page/i })[0]);
    expect(screen.getAllByText(/page 2 of 3/i).length).toBeGreaterThan(0);
  });

  it('disables Previous on the first page', () => {
    render(<PaginationHarness />);
    const prev = screen.getAllByRole('button', { name: /previous page/i });
    expect(prev[prev.length - 1]).toBeDisabled();
  });

  it('disables Next on the last page', () => {
    render(<PaginationHarness totalRows={5} initialPage={1} initialPageSize={10} />);
    const next = screen.getAllByRole('button', { name: /next page/i });
    expect(next[next.length - 1]).toBeDisabled();
  });
});
