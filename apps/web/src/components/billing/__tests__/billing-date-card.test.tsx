import { render, screen } from "@/test/test-utils";
import { BillingDateCard } from "../billing-date-card";

describe("BillingDateCard", () => {
  it("renders the next billing date label", () => {
    render(<BillingDateCard date="2026-05-01" isTrialing={false} />);
    expect(screen.getByText("Next Billing Date")).toBeInTheDocument();
  });

  it("formats and displays the date when provided", () => {
    render(<BillingDateCard date="2026-05-01" isTrialing={false} />);
    // The formatter is real via NextIntlClientProvider so we look for the formatted string
    expect(screen.getByText(/May/)).toBeInTheDocument();
  });

  it("shows em-dash when date is null", () => {
    render(<BillingDateCard date={null} isTrialing={false} />);
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("shows 'Renews on' when not trialing and date is present", () => {
    render(<BillingDateCard date="2026-05-01" isTrialing={false} />);
    expect(screen.getByText("Renews on")).toBeInTheDocument();
  });

  it("shows 'Trial ends' when trialing and date is present", () => {
    render(<BillingDateCard date="2026-05-01" isTrialing={true} />);
    expect(screen.getByText("Trial ends")).toBeInTheDocument();
  });

  it("does not show renewal text when date is null", () => {
    render(<BillingDateCard date={null} isTrialing={false} />);
    expect(screen.queryByText("Renews on")).not.toBeInTheDocument();
    expect(screen.queryByText("Trial ends")).not.toBeInTheDocument();
  });
});
