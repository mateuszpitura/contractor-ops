import { render, screen } from "@/test/test-utils";
import { getColumns, type WorkflowRunRow } from "../columns";

function makeRow(overrides: Partial<WorkflowRunRow> = {}): WorkflowRunRow {
  return {
    id: "run-1",
    status: "IN_PROGRESS",
    dueAt: null,
    startedAt: "2026-01-15",
    createdAt: "2026-01-01",
    workflowTemplate: { name: "Onboarding", type: "ONBOARDING" },
    contractor: { id: "c-1", legalName: "ACME Sp. z o.o.", displayName: "ACME" },
    progress: { done: 3, total: 5, percent: 60 },
    tasks: [],
    ...overrides,
  };
}

function renderCell(columnId: string, row: WorkflowRunRow) {
  const t = (key: string) => key;
  const columns = getColumns(t);
  const col = columns.find(
    (c) => ("accessorKey" in c && c.accessorKey === columnId) || c.id === columnId,
  );
  if (!col?.cell) throw new Error(`No cell for column ${columnId}`);
  const cellFn = col.cell as (info: any) => any;
  const result = cellFn({
    row: { original: row, getIsSelected: () => false, toggleSelected: vi.fn() },
    getValue: () => (row as any)[columnId],
  });
  const { container } = render(<>{result}</>);
  return container;
}

describe("getColumns", () => {
  const t = (key: string) => key;
  const columns = getColumns(t);

  it("returns expected number of columns", () => {
    expect(columns.length).toBe(8);
  });

  it("has a select column as first", () => {
    expect(columns[0].id).toBe("select");
  });

  it("has workflow name column", () => {
    const col = columns.find((c) => c.id === "workflowName");
    expect(col).toBeDefined();
  });

  it("has contractor column", () => {
    const col = columns.find((c) => c.id === "contractor");
    expect(col).toBeDefined();
  });

  it("has status column", () => {
    const col = columns.find((c) => "accessorKey" in c && c.accessorKey === "status");
    expect(col).toBeDefined();
  });

  it("has progress column", () => {
    const col = columns.find((c) => c.id === "progress");
    expect(col).toBeDefined();
  });

  it("select column has sorting disabled", () => {
    expect(columns[0].enableSorting).toBe(false);
  });
});

describe("getColumns cell renderers (workflow runs)", () => {
  it("workflowName cell renders template name", () => {
    renderCell("workflowName", makeRow({ workflowTemplate: { name: "Offboarding", type: "OFFBOARDING" } }));
    expect(screen.getByText("Offboarding")).toBeInTheDocument();
  });

  it("contractor cell shows displayName when present", () => {
    renderCell("contractor", makeRow({
      contractor: { id: "c-1", legalName: "ACME Corp", displayName: "ACME" },
    }));
    expect(screen.getByText("ACME")).toBeInTheDocument();
  });

  it("contractor cell falls back to legalName when displayName is null", () => {
    renderCell("contractor", makeRow({
      contractor: { id: "c-1", legalName: "ACME Corp", displayName: null },
    }));
    expect(screen.getByText("ACME Corp")).toBeInTheDocument();
  });

  it("templateType cell renders badge with translated type", () => {
    renderCell("templateType", makeRow({ workflowTemplate: { name: "Test", type: "ONBOARDING" } }));
    expect(screen.getByText("templateType.ONBOARDING")).toBeInTheDocument();
  });

  it("status cell renders badge for each status", () => {
    for (const status of ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "BLOCKED", "OVERDUE"]) {
      const { unmount } = render(<>{(() => {
        const t = (key: string) => key;
        const cols = getColumns(t);
        const col = cols.find((c) => (c as any).accessorKey === "status");
        return (col!.cell as any)({
          row: { original: makeRow({ status }), getIsSelected: () => false, toggleSelected: vi.fn() },
          getValue: () => status,
        });
      })()}</>);
      expect(screen.getByText(`runStatus.${status}`)).toBeInTheDocument();
      unmount();
    }
  });

  it("progress cell renders done/total format", () => {
    renderCell("progress", makeRow({ progress: { done: 2, total: 7, percent: 28 } }));
    expect(screen.getByText("2/7")).toBeInTheDocument();
  });

  it("startedAt cell renders mdash when null", () => {
    const container = renderCell("startedAt", makeRow({ startedAt: null }));
    expect(container.textContent).toContain("—");
  });

  it("startedAt cell renders formatted date when present", () => {
    renderCell("startedAt", makeRow({ startedAt: "2026-03-15" }));
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it("dueAt cell renders mdash when null", () => {
    const container = renderCell("dueAt", makeRow({ dueAt: null }));
    expect(container.textContent).toContain("—");
  });

  it("dueAt cell renders date when present", () => {
    renderCell("dueAt", makeRow({ dueAt: "2027-12-31", status: "IN_PROGRESS" }));
    expect(screen.getByText(/31/)).toBeInTheDocument();
  });

  it("dueAt cell applies destructive style when overdue and not completed", () => {
    const container = renderCell("dueAt", makeRow({
      dueAt: "2020-01-01",
      status: "IN_PROGRESS",
    }));
    const span = container.querySelector("span");
    expect(span?.className).toContain("text-destructive");
  });

  it("dueAt cell does NOT apply destructive style when overdue but completed", () => {
    const container = renderCell("dueAt", makeRow({
      dueAt: "2020-01-01",
      status: "COMPLETED",
    }));
    const span = container.querySelector("span");
    expect(span?.className).not.toContain("text-destructive");
  });
});
