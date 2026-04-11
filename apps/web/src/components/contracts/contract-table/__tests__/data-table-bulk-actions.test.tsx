import { render, screen } from "@/test/test-utils";
import { DataTableBulkActions } from "../data-table-bulk-actions";

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    contract: {
      bulkTransition: { mutationOptions: (opts: any) => opts },
    },
  },
}));

function makeMockTable(selectedCount: number) {
  const rows = Array.from({ length: selectedCount }, (_, i) => ({
    original: { id: `ct${i}` },
  }));
  return {
    getFilteredSelectedRowModel: () => ({ rows }),
    toggleAllPageRowsSelected: vi.fn(),
  } as any;
}

describe("DataTableBulkActions (contracts)", () => {
  it("returns null when no rows selected", () => {
    const { container } = render(
      <DataTableBulkActions table={makeMockTable(0)} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders action buttons when rows are selected", () => {
    render(<DataTableBulkActions table={makeMockTable(2)} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });
});
