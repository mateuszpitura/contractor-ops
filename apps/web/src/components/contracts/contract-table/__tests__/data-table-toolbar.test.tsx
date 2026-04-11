import { render, screen } from "@/test/test-utils";
import { DataTableToolbar } from "../data-table-toolbar";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
}));

vi.mock("@/trpc/init", () => ({
  trpc: {
    user: {
      list: { queryOptions: () => ({ queryKey: ["user", "list"] }) },
    },
  },
}));

const emptyFilters = {
  status: [],
  type: [],
  billingModel: [],
  ownerUserId: [],
  endDateFrom: "",
  endDateTo: "",
  complianceRiskLevel: [],
};

describe("DataTableToolbar (contracts)", () => {
  it("renders search input", () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        onNewContract={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders new contract button", () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        onNewContract={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("renders import button when onImport provided", () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        filters={emptyFilters}
        onFiltersChange={vi.fn()}
        onNewContract={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(1);
  });
});
