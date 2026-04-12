import { render, screen } from "@/test/test-utils";
import type { ReadyInvoiceRow } from "../columns";
import { getColumns } from "../columns";

function makeRow(overrides: Partial<ReadyInvoiceRow> = {}): ReadyInvoiceRow {
  return {
    id: "inv-1",
    invoiceNumber: "FV/2026/001",
    totalMinor: 100000,
    amountToPayMinor: 100000,
    currency: "PLN",
    dueDate: "2026-04-15",
    paymentStatus: "READY",
    contractor: { id: "c-1", legalName: "Acme Corp", taxId: "1234567890" },
    billingProfile: { id: "bp-1", bankAccountMasked: "****1234", preferredCurrency: "PLN" },
    contract: { id: "ct-1", contractNumber: "CTR-001" },
    ...overrides,
  };
}

function renderCell(columnId: string, row: ReadyInvoiceRow) {
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
  if (result === null) return null;
  const { container } = render(<>{result}</>);
  return container;
}

describe("getColumns", () => {
  const t = (key: string) => key;

  it("returns expected column count", () => {
    const columns = getColumns(t);
    expect(columns).toHaveLength(8);
  });

  it("select column has fixed size 40", () => {
    const columns = getColumns(t);
    const selectCol = columns.find((c) => "id" in c && c.id === "select");
    expect(selectCol?.size).toBe(40);
  });

  it("invoiceNumber column disables hiding", () => {
    const columns = getColumns(t);
    const invCol = columns.find((c) => "accessorKey" in c && c.accessorKey === "invoiceNumber");
    expect(invCol?.enableHiding).toBe(false);
  });

  it("inRun column disables sorting", () => {
    const columns = getColumns(t);
    const inRunCol = columns.find((c) => "id" in c && c.id === "inRun");
    expect(inRunCol?.enableSorting).toBe(false);
  });
});

describe("getColumns cell renderers (invoice selection)", () => {
  it("invoiceNumber cell renders the number", () => {
    renderCell("invoiceNumber", makeRow({ invoiceNumber: "FV/2026/042" }));
    expect(screen.getByText("FV/2026/042")).toBeInTheDocument();
  });

  it("contractor cell renders legalName", () => {
    renderCell(
      "contractor",
      makeRow({
        contractor: { id: "c-1", legalName: "Test Corp", taxId: "123" },
      }),
    );
    expect(screen.getByText("Test Corp")).toBeInTheDocument();
  });

  it("contractor cell renders mdash when contractor is null", () => {
    const container = renderCell("contractor", makeRow({ contractor: null }));
    expect(container!.textContent).toContain("—");
  });

  it("contractor cell shows Missing IBAN badge when bankAccountMasked is null", () => {
    renderCell(
      "contractor",
      makeRow({
        billingProfile: { id: "bp-1", bankAccountMasked: null, preferredCurrency: "PLN" },
      }),
    );
    expect(screen.getByText("Missing IBAN")).toBeInTheDocument();
  });

  it("contractor cell does NOT show Missing IBAN when bankAccountMasked is present", () => {
    renderCell(
      "contractor",
      makeRow({
        billingProfile: { id: "bp-1", bankAccountMasked: "****1234", preferredCurrency: "PLN" },
      }),
    );
    expect(screen.queryByText("Missing IBAN")).not.toBeInTheDocument();
  });

  it("amountToPayMinor cell renders formatted amount", () => {
    renderCell("amountToPayMinor", makeRow({ amountToPayMinor: 50000 }));
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
  });

  it("currency cell renders the currency", () => {
    renderCell("currency", makeRow({ currency: "EUR" }));
    expect(screen.getByText("EUR")).toBeInTheDocument();
  });

  it("dueDate cell renders mdash when null", () => {
    const container = renderCell("dueDate", makeRow({ dueDate: null }));
    expect(container!.textContent).toContain("—");
  });

  it("dueDate cell renders formatted date when present", () => {
    renderCell("dueDate", makeRow({ dueDate: "2026-04-15" }));
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it("contract cell renders contract number when present", () => {
    renderCell("contract", makeRow({ contract: { id: "ct-1", contractNumber: "CTR-042" } }));
    expect(screen.getByText("CTR-042")).toBeInTheDocument();
  });

  it("contract cell renders mdash when contract is null", () => {
    const container = renderCell("contract", makeRow({ contract: null }));
    expect(container!.textContent).toContain("—");
  });

  it("inRun cell returns null when not in a run", () => {
    const result = renderCell("inRun", makeRow({ _inRunNumber: undefined }));
    expect(result).toBeNull();
  });

  it("inRun cell renders badge with run number when in a run", () => {
    renderCell("inRun", makeRow({ _inRunNumber: "PR-005" }));
    expect(screen.getByText(/In run PR-005/)).toBeInTheDocument();
  });

  it("select cell checkbox is disabled when invoice is in a run", () => {
    const t = (key: string) => key;
    const columns = getColumns(t);
    const selectCol = columns.find((c) => c.id === "select");
    const cellFn = selectCol!.cell as (info: any) => any;
    const result = cellFn({
      row: {
        original: makeRow({ _inRunNumber: "PR-001" }),
        getIsSelected: () => false,
        toggleSelected: vi.fn(),
      },
    });
    const { container } = render(<>{result}</>);
    const checkbox = container.querySelector("[disabled]");
    expect(checkbox).not.toBeNull();
  });
});
