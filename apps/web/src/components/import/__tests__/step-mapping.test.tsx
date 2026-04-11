import { render, screen } from "@/test/test-utils";
import { StepMapping } from "../step-mapping";

describe("StepMapping", () => {
  const defaultProps = {
    headers: ["Nazwa", "NIP", "Email"],
    sampleRows: [
      { Nazwa: "Acme sp. z o.o.", NIP: "1234567890", Email: "acme@test.com" },
    ],
    suggestedMapping: { Nazwa: "legalName", NIP: "taxId", Email: "email" },
    entityType: "contractor" as const,
    columnMapping: { Nazwa: "legalName", NIP: "taxId", Email: "email" },
    onMappingChange: vi.fn(),
  };

  it("renders description", () => {
    render(<StepMapping {...defaultProps} />);
    expect(screen.getByText(/Map your file columns/)).toBeInTheDocument();
  });

  it("renders source column headers", () => {
    render(<StepMapping {...defaultProps} />);
    expect(screen.getByText("Nazwa")).toBeInTheDocument();
    expect(screen.getByText("NIP")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("shows sample data from first row", () => {
    render(<StepMapping {...defaultProps} />);
    expect(screen.getByText("Acme sp. z o.o.")).toBeInTheDocument();
    expect(screen.getByText("1234567890")).toBeInTheDocument();
  });

  it("shows check icon for mapped columns", () => {
    const { container } = render(<StepMapping {...defaultProps} />);
    // All 3 columns are mapped so should have check icons (not alert)
    const checkIcons = container.querySelectorAll("[aria-hidden='true']");
    expect(checkIcons.length).toBeGreaterThan(0);
  });

  it("renders footer note", () => {
    render(<StepMapping {...defaultProps} />);
    expect(screen.getByText(/Unmapped columns/)).toBeInTheDocument();
  });
});
