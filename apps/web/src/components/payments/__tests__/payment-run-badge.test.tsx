import { render, screen } from "@/test/test-utils";
import { PaymentItemBadge, PaymentRunBadge } from "../payment-run-badge";

describe("PaymentRunBadge", () => {
  const KNOWN_STATUSES = ["DRAFT", "LOCKED", "EXPORTED", "COMPLETED", "CANCELLED"];

  it.each(KNOWN_STATUSES)("renders %s status text", (status) => {
    render(<PaymentRunBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it.each(KNOWN_STATUSES)("renders an icon for %s", (status) => {
    const { container } = render(<PaymentRunBadge status={status} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders unknown status with secondary variant", () => {
    render(<PaymentRunBadge status="UNKNOWN" />);
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });
});

describe("PaymentItemBadge", () => {
  const ITEM_STATUSES = ["PENDING", "PAID", "FAILED"];

  it.each(ITEM_STATUSES)("renders %s status text", (status) => {
    render(<PaymentItemBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("renders unknown status without crashing", () => {
    render(<PaymentItemBadge status="REFUNDED" />);
    expect(screen.getByText("REFUNDED")).toBeInTheDocument();
  });
});
