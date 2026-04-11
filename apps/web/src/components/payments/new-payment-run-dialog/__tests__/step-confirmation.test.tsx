import { render, screen, setup } from "@/test/test-utils";
import { StepConfirmation } from "../step-confirmation";

function makeProps(overrides: Partial<Parameters<typeof StepConfirmation>[0]> = {}) {
  return {
    runNumber: "PR-2026-001",
    fileBase64: btoa("test-content"),
    fileName: "payment-export.csv",
    invoiceCount: 5,
    totalMinor: 500000,
    currency: "PLN",
    exportFormat: "CSV",
    onViewRun: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("StepConfirmation", () => {
  it("renders success heading", () => {
    render(<StepConfirmation {...makeProps()} />);

    expect(screen.getByText("Payment run created")).toBeInTheDocument();
  });

  it("shows invoice count", () => {
    render(<StepConfirmation {...makeProps()} />);

    expect(screen.getByText(/invoices/i)).toBeInTheDocument();
  });

  it("shows total label", () => {
    render(<StepConfirmation {...makeProps()} />);

    expect(screen.getByText(/total/i)).toBeInTheDocument();
  });

  it("shows export format label", () => {
    render(<StepConfirmation {...makeProps()} />);

    expect(screen.getByText(/CSV/)).toBeInTheDocument();
  });

  it("renders download button", () => {
    render(<StepConfirmation {...makeProps()} />);

    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("calls onViewRun when view run link is clicked", async () => {
    const onViewRun = vi.fn();
    const { user } = setup(
      <StepConfirmation {...makeProps({ onViewRun })} />,
    );

    await user.click(screen.getByText(/view payment run/i));
    expect(onViewRun).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const { user } = setup(
      <StepConfirmation {...makeProps({ onClose })} />,
    );

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows Elixir for BANK_FILE format", () => {
    render(<StepConfirmation {...makeProps({ exportFormat: "BANK_FILE" })} />);

    expect(screen.getByText(/Elixir/)).toBeInTheDocument();
  });

  it("shows SEPA XML for SEPA_XML format", () => {
    render(<StepConfirmation {...makeProps({ exportFormat: "SEPA_XML" })} />);

    expect(screen.getByText(/SEPA XML/)).toBeInTheDocument();
  });
});
