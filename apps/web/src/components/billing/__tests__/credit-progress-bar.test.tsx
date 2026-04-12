import { render, screen } from "@/test/test-utils";
import { CreditProgressBar } from "../credit-progress-bar";

describe("CreditProgressBar", () => {
  it("renders remaining credits text when credits are available", () => {
    render(<CreditProgressBar used={30} total={100} />);
    expect(screen.getByText("70 of 100 credits remaining")).toBeInTheDocument();
  });

  it("renders exhausted text when all credits are used", () => {
    render(<CreditProgressBar used={100} total={100} />);
    expect(
      screen.getByText("No credits remaining -- purchase more to continue OCR processing"),
    ).toBeInTheDocument();
  });

  it("renders exhausted text when used exceeds total", () => {
    render(<CreditProgressBar used={120} total={100} />);
    expect(
      screen.getByText("No credits remaining -- purchase more to continue OCR processing"),
    ).toBeInTheDocument();
  });

  it("handles zero total gracefully", () => {
    render(<CreditProgressBar used={0} total={0} />);
    // 0 remaining, 0 total -> remaining = 0, not isExhausted because total is 0
    // isExhausted = total > 0 && remaining <= 0 -> false
    expect(screen.getByText("0 of 0 credits remaining")).toBeInTheDocument();
  });

  it("renders a progressbar element", () => {
    render(<CreditProgressBar used={10} total={100} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
