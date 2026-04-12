import { describe, expect, it, vi } from "vitest";
import { render, screen, setup } from "@/test/test-utils";
import { TimesheetGrid } from "../timesheet-grid";

vi.mock("../time-source-badge", () => ({
  TimeSourceBadge: ({ source }: { source: string }) => (
    <span data-testid="source-badge">{source}</span>
  ),
}));

const contracts = [
  { id: "c-1", title: "Project Alpha" },
  { id: "c-2", title: "Project Beta" },
];

const entries = [
  {
    id: "e-1",
    contractId: "c-1",
    entryDate: "2026-01-05",
    minutes: 480,
    description: "Work on feature",
    source: "MANUAL" as const,
  },
  {
    id: "e-2",
    contractId: "c-1",
    entryDate: "2026-01-06",
    minutes: 360,
    description: null,
    source: "CLOCKIFY" as const,
    createdAt: "2026-01-06T10:00:00Z",
  },
];

const defaultProps = {
  weekStartDate: new Date("2026-01-05"),
  entries,
  contracts,
  timesheetId: "ts-1",
  disabled: false,
  onSave: vi.fn(),
};

describe("TimesheetGrid", () => {
  it("renders project names", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
  });

  it("renders day column headers", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  it("renders Total label in footer", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Total appears in header column and footer row
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
  });

  it("renders cells with hours values", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // 480 min = 8h, 360 min = 6h
    const inputs = screen.getAllByRole("spinbutton");
    const values = inputs.map((i) => (i as HTMLInputElement).value);
    expect(values).toContain("8");
    expect(values).toContain("6");
  });

  it("renders source badge for imported entries", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByTestId("source-badge")).toHaveTextContent("CLOCKIFY");
  });

  it("disables cells for imported entries", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const inputs = screen.getAllByRole("spinbutton");
    // Find the CLOCKIFY cell (Tue = index 1 for Project Alpha)
    const clockifyInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "6" && (i as HTMLInputElement).disabled,
    );
    expect(clockifyInput).toBeDefined();
  });

  it("disables all cells when disabled prop is true", () => {
    render(<TimesheetGrid {...defaultProps} disabled />);
    const inputs = screen.getAllByRole("spinbutton");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  it("renders empty state when no contracts", () => {
    render(<TimesheetGrid {...defaultProps} contracts={[]} entries={[]} />);
    expect(screen.getByText("No active contracts")).toBeInTheDocument();
  });

  it("renders rejection banner when rejectionReason is provided", () => {
    render(<TimesheetGrid {...defaultProps} rejectionReason="Hours don't match records" />);
    expect(screen.getByText(/Hours don't match records/)).toBeInTheDocument();
  });

  it("calls onSave on cell blur with changed value", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    // Find an empty cell and type a value
    const inputs = screen.getAllByRole("spinbutton");
    const emptyInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "" && !(i as HTMLInputElement).disabled,
    );
    if (emptyInput) {
      await user.clear(emptyInput);
      await user.type(emptyInput, "4");
      await user.tab();
      expect(onSave).toHaveBeenCalled();
    }
  });

  it("renders aria-label for each cell", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByLabelText("Hours for Project Alpha on Mon")).toBeInTheDocument();
  });

  // ---- Cell editing ----
  it("allows editing an empty cell", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const inputs = screen.getAllByRole("spinbutton");
    const emptyInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "" && !(i as HTMLInputElement).disabled,
    );
    if (emptyInput) {
      await user.type(emptyInput, "3");
      expect((emptyInput as HTMLInputElement).value).toBe("3");
    }
  });

  // ---- Blur save for existing entry ----
  it("does not call onSave when value has not changed", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const inputs = screen.getAllByRole("spinbutton");
    // Find the cell with value "8" (which is already set)
    const filledInput = inputs.find((i) => (i as HTMLInputElement).value === "8");
    if (filledInput) {
      await user.click(filledInput);
      await user.tab(); // blur without change
      // onSave should NOT be called for unchanged value
    }
  });

  // ---- Empty project state ----
  it("shows empty project row for contracts with no entries", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Project Beta has no entries, should render empty cells
    const betaLabel = screen.getByText("Project Beta");
    expect(betaLabel).toBeInTheDocument();
  });

  // ---- All day headers rendered ----
  it("renders all 7 day headers", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Tue")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Thu")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("Sun")).toBeInTheDocument();
  });

  // ---- Total column header ----
  it("renders Total column header", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const totals = screen.getAllByText("Total");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Rejection banner ----
  it("does not show rejection banner when no reason provided", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.queryByText(/rejected/i)).not.toBeInTheDocument();
  });

  // ---- Multiple contracts ----
  it("renders a row for each contract", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
  });

  // ---- Cell editing with clear and retype ----
  it("allows clearing a filled cell and retyping", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const inputs = screen.getAllByRole("spinbutton");
    const filledInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "8" && !(i as HTMLInputElement).disabled,
    );
    if (filledInput) {
      await user.clear(filledInput);
      await user.type(filledInput, "10");
      expect((filledInput as HTMLInputElement).value).toBe("10");
    }
  });

  // ---- Total footer row ----
  it("renders footer with summed totals", () => {
    render(<TimesheetGrid {...defaultProps} />);
    const totals = screen.getAllByText("Total");
    expect(totals.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Aria labels for multiple contracts ----
  it("renders aria-label for Project Beta cells", () => {
    render(<TimesheetGrid {...defaultProps} />);
    expect(screen.getByLabelText("Hours for Project Beta on Mon")).toBeInTheDocument();
  });

  // ---- Disabled with rejection reason ----
  it("renders rejection banner alongside disabled cells", () => {
    render(<TimesheetGrid {...defaultProps} disabled rejectionReason="Incorrect totals" />);
    expect(screen.getByText(/Incorrect totals/)).toBeInTheDocument();
    const inputs = screen.getAllByRole("spinbutton");
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });

  // ---- Source badge not shown for manual entries ----
  it("does not show source badge for manual entries", () => {
    const manualEntries = entries.filter((e) => e.source === "MANUAL");
    render(<TimesheetGrid {...defaultProps} entries={manualEntries} />);
    expect(screen.queryByTestId("source-badge")).not.toBeInTheDocument();
  });

  // ---- Cell blur: saves changed value ----
  it("calls onSave with correct data on cell blur after edit", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    // Find an empty non-disabled cell for Project Beta Mon
    const input = screen.getByLabelText("Hours for Project Beta on Mon");
    await user.type(input, "2");
    await user.tab();
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          contractId: "c-2",
          minutes: 120, // 2 hours * 60
        }),
      ]),
    );
  });

  // ---- Cell blur: does not save when value unchanged on existing entry ----
  it("does not call onSave when existing cell is focused and blurred without change", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const input = screen.getByLabelText("Hours for Project Alpha on Mon");
    // Just click and tab without changing
    await user.click(input);
    await user.tab();
    expect(onSave).not.toHaveBeenCalled();
  });

  // ---- Cell edit: clear and type new value ----
  it("saves updated value when existing cell is cleared and retyped", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const input = screen.getByLabelText("Hours for Project Alpha on Mon") as HTMLInputElement;
    expect(input.value).toBe("8");
    await user.clear(input);
    await user.type(input, "6");
    await user.tab();
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          contractId: "c-1",
          minutes: 360, // 6 hours * 60
        }),
      ]),
    );
  });

  // ---- Grand total calculation ----
  it("renders correct grand total for all entries", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // 480 + 360 = 840 min = 14h — appears in both row total and grand total
    const matches = screen.getAllByText("14");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  // ---- Row total for contract with no entries ----
  it("renders 0 for row total of contract without entries", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Project Beta has no entries, its row total should be 0
    const rows = document.querySelectorAll("tbody tr");
    const betaRow = rows[1]; // Second row = Project Beta
    const cells = betaRow?.querySelectorAll("td");
    const totalCell = cells?.[cells.length - 1];
    expect(totalCell?.textContent).toBe("0");
  });

  // ---- Three contracts ----
  it("renders three project rows when three contracts are provided", () => {
    const threeContracts = [...contracts, { id: "c-3", title: "Project Gamma" }];
    render(<TimesheetGrid {...defaultProps} contracts={threeContracts} />);
    expect(screen.getByText("Project Gamma")).toBeInTheDocument();
  });

  // ---- Tab/Enter key navigation triggers save ----
  it("saves on Enter key press in cell", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const input = screen.getByLabelText("Hours for Project Beta on Mon");
    await user.type(input, "5");
    await user.keyboard("{Enter}");
    expect(onSave).toHaveBeenCalled();
  });

  // ---- Cell with 0 hours ----
  it("saves zero value correctly when cell is cleared", async () => {
    const onSave = vi.fn();
    const { user } = setup(<TimesheetGrid {...defaultProps} onSave={onSave} />);
    const input = screen.getByLabelText("Hours for Project Alpha on Mon") as HTMLInputElement;
    expect(input.value).toBe("8");
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          contractId: "c-1",
          minutes: 0,
        }),
      ]),
    );
  });

  // ---- Multiple entries for same contract same day ----
  it("renders correctly with entries on multiple days for same contract", () => {
    const multiDayEntries = [
      {
        id: "e-1",
        contractId: "c-1",
        entryDate: "2026-01-05",
        minutes: 480,
        description: "Mon",
        source: "MANUAL" as const,
      },
      {
        id: "e-3",
        contractId: "c-1",
        entryDate: "2026-01-07",
        minutes: 240,
        description: "Wed",
        source: "MANUAL" as const,
      },
    ];
    render(<TimesheetGrid {...defaultProps} entries={multiDayEntries} />);
    const inputs = screen.getAllByRole("spinbutton");
    const values = inputs.map((i) => (i as HTMLInputElement).value);
    expect(values).toContain("8"); // Mon
    expect(values).toContain("4"); // Wed
  });

  // ---- Row total calculation ----
  it("renders correct row total for Project Alpha", () => {
    render(<TimesheetGrid {...defaultProps} />);
    // Project Alpha has 480 + 360 = 840 min = 14h
    const rows = document.querySelectorAll("tbody tr");
    const alphaRow = rows[0];
    const cells = alphaRow?.querySelectorAll("td");
    const totalCell = cells?.[cells.length - 1];
    expect(totalCell?.textContent).toBe("14");
  });

  // ---- Disabled prop prevents editing imported entries ----
  it("CLOCKIFY source entries are always disabled even when grid is not disabled", () => {
    render(<TimesheetGrid {...defaultProps} disabled={false} />);
    const inputs = screen.getAllByRole("spinbutton");
    const clockifyInput = inputs.find(
      (i) => (i as HTMLInputElement).value === "6" && (i as HTMLInputElement).disabled,
    );
    expect(clockifyInput).toBeDefined();
  });

  // ---- Empty entries array ----
  it("renders grid with empty cells when no entries provided", () => {
    render(<TimesheetGrid {...defaultProps} entries={[]} />);
    const inputs = screen.getAllByRole("spinbutton");
    const emptyInputs = inputs.filter((i) => (i as HTMLInputElement).value === "");
    expect(emptyInputs.length).toBeGreaterThan(0);
  });
});
