import { render, screen } from "@/test/test-utils";
import { DataTableColumnToggle } from "../data-table-column-toggle";

function makeMockTable() {
  return {
    getAllColumns: () => [
      {
        id: "title",
        accessorFn: () => "",
        getCanHide: () => true,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
      {
        id: "select",
        accessorFn: undefined,
        getCanHide: () => false,
        getIsVisible: () => true,
        toggleVisibility: vi.fn(),
      },
    ],
  } as any;
}

describe("DataTableColumnToggle (contracts)", () => {
  it("renders the toggle button", () => {
    render(<DataTableColumnToggle table={makeMockTable()} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });
});
