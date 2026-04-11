import { render, screen, setup } from "@/test/test-utils";
import { DataTableToolbar } from "../data-table-toolbar";

describe("DataTableToolbar", () => {
  it("renders search input and start workflow button", () => {
    render(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        onStartWorkflow={vi.fn()}
      />,
    );
    expect(screen.getByPlaceholderText("Search workflows...")).toBeInTheDocument();
    expect(screen.getByText("Start workflow")).toBeInTheDocument();
  });

  it("calls onStartWorkflow when button is clicked", async () => {
    const onStartWorkflow = vi.fn();
    const { user } = setup(
      <DataTableToolbar
        search=""
        onSearchChange={vi.fn()}
        onStartWorkflow={onStartWorkflow}
      />,
    );
    await user.click(screen.getByText("Start workflow"));
    expect(onStartWorkflow).toHaveBeenCalled();
  });

  it("displays current search value", () => {
    render(
      <DataTableToolbar
        search="onboarding"
        onSearchChange={vi.fn()}
        onStartWorkflow={vi.fn()}
      />,
    );
    const input = screen.getByPlaceholderText("Search workflows...") as HTMLInputElement;
    expect(input.value).toBe("onboarding");
  });
});
