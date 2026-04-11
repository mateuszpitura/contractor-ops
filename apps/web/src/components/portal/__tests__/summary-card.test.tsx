import { render, screen } from "@/test/test-utils";
import { SummaryCard, SummaryCardSkeleton } from "../summary-card";
import { Receipt } from "lucide-react";

describe("SummaryCard", () => {
  it("renders label and value", () => {
    render(<SummaryCard icon={Receipt} label="Total Invoices" value={42} />);

    expect(screen.getByText("Total Invoices")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders string value", () => {
    render(<SummaryCard icon={Receipt} label="Amount" value="$1,200" />);

    expect(screen.getByText("$1,200")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <SummaryCard icon={Receipt} label="Test" value={0} className="custom-class" />,
    );

    expect(container.firstChild).toHaveClass("custom-class");
  });
});

describe("SummaryCardSkeleton", () => {
  it("renders without error", () => {
    const { container } = render(<SummaryCardSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<SummaryCardSkeleton className="extra" />);

    expect(container.firstChild).toHaveClass("extra");
  });
});
