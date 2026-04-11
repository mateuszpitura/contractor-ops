import { render, screen, setup } from "@/test/test-utils";
import { DataTableToolbar } from "../data-table-toolbar";

function makeProps(overrides: Partial<Parameters<typeof DataTableToolbar>[0]> = {}) {
  return {
    activeStatus: "all",
    onStatusChange: vi.fn(),
    dateFrom: undefined,
    dateTo: undefined,
    onDateFromChange: vi.fn(),
    onDateToChange: vi.fn(),
    ...overrides,
  };
}

describe("DataTableToolbar", () => {
  it("renders all status chips", () => {
    render(<DataTableToolbar {...makeProps()} />);

    // 6 chips: all, draft, locked, exported, completed, cancelled
    const buttons = screen.getAllByRole("button").filter(
      (b) => b.classList.contains("rounded-full"),
    );
    expect(buttons).toHaveLength(6);
  });

  it("highlights the active status chip", () => {
    render(<DataTableToolbar {...makeProps({ activeStatus: "DRAFT" })} />);

    const draftChip = screen.getByText(/draft/i);
    expect(draftChip.className).toContain("text-primary");
  });

  it("calls onStatusChange when a chip is clicked", async () => {
    const onStatusChange = vi.fn();
    const { user } = setup(
      <DataTableToolbar {...makeProps({ onStatusChange })} />,
    );

    await user.click(screen.getByText(/exported/i));
    expect(onStatusChange).toHaveBeenCalledWith("EXPORTED");
  });

  it("renders date range button", () => {
    render(<DataTableToolbar {...makeProps()} />);

    expect(screen.getByText(/date range/i)).toBeInTheDocument();
  });
});
