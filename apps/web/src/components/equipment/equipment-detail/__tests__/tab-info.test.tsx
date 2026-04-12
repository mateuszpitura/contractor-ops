import { render, screen } from "@/test/test-utils";
import { TabInfo } from "../tab-info";

function makeEquipment(overrides: Record<string, unknown> = {}) {
  return {
    id: "eq-1",
    name: "MacBook Pro 16",
    serialNumber: "SN-ABC123",
    type: "LAPTOP",
    customType: null,
    status: "AVAILABLE",
    notes: "Company laptop",
    purchaseDate: "2026-01-15",
    createdAt: "2026-01-10T10:00:00Z",
    updatedAt: "2026-02-20T14:30:00Z",
    ...overrides,
  };
}

describe("TabInfo", () => {
  it("renders equipment name and serial number", () => {
    render(<TabInfo equipment={makeEquipment()} onEdit={vi.fn()} />);

    expect(screen.getByText("MacBook Pro 16")).toBeInTheDocument();
    expect(screen.getByText("SN-ABC123")).toBeInTheDocument();
  });

  it("renders notes when provided", () => {
    render(<TabInfo equipment={makeEquipment()} onEdit={vi.fn()} />);

    expect(screen.getByText("Company laptop")).toBeInTheDocument();
  });

  it("shows 'No notes' when notes is null", () => {
    render(<TabInfo equipment={makeEquipment({ notes: null })} onEdit={vi.fn()} />);

    expect(screen.getByText("No notes")).toBeInTheDocument();
  });

  it("formats purchase date", () => {
    render(<TabInfo equipment={makeEquipment()} onEdit={vi.fn()} />);

    expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
  });

  it("renders created and updated timestamps", () => {
    render(<TabInfo equipment={makeEquipment()} onEdit={vi.fn()} />);

    expect(screen.getByText(/Jan 10, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Feb 20, 2026/)).toBeInTheDocument();
  });
});
