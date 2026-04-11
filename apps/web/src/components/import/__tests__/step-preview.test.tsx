import { render, screen, setup } from "@/test/test-utils";
import { StepPreview } from "../step-preview";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("./import-wizard-dialog", () => ({}));

// ---------------------------------------------------------------------------
// Types (local mirror – the real type is re-exported from the mocked module)
// ---------------------------------------------------------------------------

interface ImportRow {
  rowNumber: number;
  data: Record<string, unknown>;
  status: "valid" | "invalid";
  errors: Array<{ field: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validRow = (
  rowNumber: number,
  data: Record<string, unknown>,
): ImportRow => ({
  rowNumber,
  data,
  status: "valid",
  errors: [],
});

const invalidRow = (
  rowNumber: number,
  data: Record<string, unknown>,
  errors: Array<{ field: string; message: string }>,
): ImportRow => ({
  rowNumber,
  data,
  status: "invalid",
  errors,
});

const ROW_VALID_1 = validRow(1, {
  name: "John Doe",
  email: "john@test.com",
  nip: "1234567890",
});

const ROW_VALID_2 = validRow(2, {
  name: "Jane Smith",
  email: "jane@test.com",
  nip: "0987654321",
});

const ROW_INVALID_3 = invalidRow(
  3,
  { name: "", email: "bad-email", nip: "123" },
  [
    { field: "name", message: "Name is required" },
    { field: "email", message: "Invalid email format" },
  ],
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StepPreview", () => {
  // -------------------------------------------------------------------------
  // Stats bar
  // -------------------------------------------------------------------------

  it("renders stats bar with valid, invalid, and total counts", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={3}
      />,
    );

    expect(screen.getByText("2 valid rows")).toBeInTheDocument();
    expect(screen.getByText("1 invalid row")).toBeInTheDocument();
    expect(screen.getByText("3 total rows")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // All valid state
  // -------------------------------------------------------------------------

  it("shows 'All X rows are valid' when there are no invalid rows", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[]}
        totalRows={2}
      />,
    );

    expect(screen.getByText("All 2 rows are valid")).toBeInTheDocument();
  });

  it("does NOT show filter buttons when there are no invalid rows", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[]}
        totalRows={1}
      />,
    );

    expect(screen.queryByText("Show all")).not.toBeInTheDocument();
    expect(screen.queryByText("Show errors only")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Filter buttons
  // -------------------------------------------------------------------------

  it("shows filter buttons when there are invalid rows", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={2}
      />,
    );

    expect(screen.getByText("Show all")).toBeInTheDocument();
    expect(screen.getByText("Show errors only")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Table rows
  // -------------------------------------------------------------------------

  it("renders correct number of table rows", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={3}
      />,
    );

    // 3 data rows (header row is in <thead>, body rows in <tbody>)
    const rows = screen.getAllByRole("row");
    // 1 header + 3 body rows
    expect(rows).toHaveLength(4);
  });

  it("renders all data columns as table headers", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[]}
        totalRows={1}
      />,
    );

    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("nip")).toBeInTheDocument();
  });

  it("shows row numbers", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[]}
        totalRows={2}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Invalid row styling
  // -------------------------------------------------------------------------

  it("applies destructive background class to invalid rows", () => {
    const { container } = render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={2}
      />,
    );

    const destructiveRows = container.querySelectorAll(".bg-destructive\\/5");
    expect(destructiveRows).toHaveLength(1);
  });

  it("applies destructive border class to error cells", () => {
    const { container } = render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={2}
      />,
    );

    const errorCells = container.querySelectorAll(".border-destructive");
    // ROW_INVALID_3 has errors on "name" and "email" fields
    expect(errorCells).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Toggle filtering
  // -------------------------------------------------------------------------

  it("filters to only invalid rows when 'Show errors only' is clicked", async () => {
    const { user } = setup(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={3}
      />,
    );

    // Initially all 3 rows are visible (1 header + 3 body)
    expect(screen.getAllByRole("row")).toHaveLength(4);

    await user.click(screen.getByText("Show errors only"));

    // Now only 1 invalid row visible (1 header + 1 body)
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });

  it("shows all rows again after clicking 'Show all'", async () => {
    const { user } = setup(
      <StepPreview
        validRows={[ROW_VALID_1, ROW_VALID_2]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={3}
      />,
    );

    await user.click(screen.getByText("Show errors only"));
    expect(screen.getAllByRole("row")).toHaveLength(2);

    await user.click(screen.getByText("Show all"));
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  it("handles empty data gracefully (0 rows)", () => {
    render(
      <StepPreview validRows={[]} invalidRows={[]} totalRows={0} />,
    );

    expect(screen.getByText("0 valid rows")).toBeInTheDocument();
    expect(screen.getByText("0 invalid rows")).toBeInTheDocument();
    expect(screen.getByText("0 total rows")).toBeInTheDocument();
    expect(screen.getByText("No rows to preview")).toBeInTheDocument();
    expect(screen.queryByText(/All \d+ rows are valid/)).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Error tooltip
  // -------------------------------------------------------------------------

  it("renders error tooltip content matching error message", async () => {
    const { user } = setup(
      <StepPreview
        validRows={[]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={1}
      />,
    );

    // Hover over the first AlertCircle icon to trigger tooltip
    // AlertCircle icons are inside TooltipTrigger buttons
    const triggers = screen.getAllByRole("button");
    // The tooltip triggers are buttons wrapping the AlertCircle icons
    // We expect 2 triggers for 2 error fields (name, email)
    const tooltipTriggers = triggers.filter(
      (btn) => !btn.textContent || btn.textContent.trim() === "",
    );

    await user.hover(tooltipTriggers[0]);
    expect(
      await screen.findByText("Name is required"),
    ).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Multiple errors in same row
  // -------------------------------------------------------------------------

  it("highlights each errored cell independently in the same row", () => {
    const { container } = render(
      <StepPreview
        validRows={[]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={1}
      />,
    );

    // ROW_INVALID_3 has errors on "name" and "email" — both cells should be highlighted
    const errorCells = container.querySelectorAll(
      ".border-l-2.border-destructive",
    );
    expect(errorCells).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Column order
  // -------------------------------------------------------------------------

  it("derives column order from all row data keys", () => {
    const rowA = validRow(1, { alpha: "a", beta: "b" });
    const rowB = validRow(2, { beta: "b2", gamma: "g" });

    render(
      <StepPreview
        validRows={[rowA, rowB]}
        invalidRows={[]}
        totalRows={2}
      />,
    );

    const headers = screen.getAllByRole("columnheader");
    // First header is "#", then data columns
    const headerTexts = headers.map((h) => h.textContent);
    expect(headerTexts).toEqual(["#", "alpha", "beta", "gamma"]);
  });

  // -------------------------------------------------------------------------
  // Rows are sorted by rowNumber
  // -------------------------------------------------------------------------

  it("sorts rows by rowNumber", () => {
    const row5 = validRow(5, { name: "Fifth" });
    const row1 = validRow(1, { name: "First" });
    const row3 = validRow(3, { name: "Third" });

    const { container } = render(
      <StepPreview
        validRows={[row5, row1, row3]}
        invalidRows={[]}
        totalRows={3}
      />,
    );

    // Get all body rows (skip header)
    const rows = container.querySelectorAll("tbody tr");
    const rowNumbers = Array.from(rows).map((row) => {
      const firstCell = row.querySelector("td");
      return firstCell?.textContent;
    });
    expect(rowNumbers).toEqual(["1", "3", "5"]);
  });

  // -------------------------------------------------------------------------
  // i18n: Polish locale
  // -------------------------------------------------------------------------

  it("renders stats in Polish", () => {
    render(
      <StepPreview
        validRows={[ROW_VALID_1]}
        invalidRows={[ROW_INVALID_3]}
        totalRows={2}
      />,
      { locale: "pl" },
    );

    expect(screen.getByText("1 poprawny wiersz")).toBeInTheDocument();
    expect(screen.getByText("1 nieprawidłowy wiersz")).toBeInTheDocument();
    expect(screen.getByText("2 wiersze łącznie")).toBeInTheDocument();
  });
});
