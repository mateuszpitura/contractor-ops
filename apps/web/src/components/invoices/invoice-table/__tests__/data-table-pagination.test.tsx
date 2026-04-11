import { useState } from "react";
import { describe, it, expect } from "vitest";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";

import { render, screen, setup } from "@/test/test-utils";

import { DataTablePagination } from "../data-table-pagination";

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
  const columns: ColumnDef<Row>[] = [{ accessorKey: "id", header: "ID" }];
  const data: Row[] = [{ id: "1" }];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    getRowId: (row) => row.id,
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

describe("DataTablePagination", () => {
  it("renders total row count and page indicator", () => {
    render(<PaginationHarness />);
    expect(screen.getByText(/of 25/i)).toBeInTheDocument();
    expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
  });

  it("advances page when Next is clicked", async () => {
    const { user } = setup(<PaginationHarness />);
    await user.click(screen.getByRole("button", { name: /next page/i }));
    expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
  });

  it("disables Previous on the first page", () => {
    render(<PaginationHarness />);
    expect(
      screen.getByRole("button", { name: /previous page/i }),
    ).toBeDisabled();
  });

  it("disables Next on the last page", () => {
    render(
      <PaginationHarness totalRows={5} initialPage={1} initialPageSize={10} />,
    );
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
  });
});
