import { fireEvent } from "@testing-library/react";

import { render, screen } from "@/test/test-utils";
import { TrialBanner } from "../trial-banner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date("2026-04-02T12:00:00Z");

function trialEndInDays(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TrialBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // Visibility rules
  // ---------------------------------------------------------------------------

  it("is not rendered when trial ends in more than 7 days", () => {
    const { container } = render(<TrialBanner trialEnd={trialEndInDays(10)} onUpgrade={vi.fn()} />);

    expect(container.innerHTML).toBe("");
  });

  it("is not rendered when trial has expired (0 or negative days)", () => {
    const { container } = render(<TrialBanner trialEnd={trialEndInDays(-1)} onUpgrade={vi.fn()} />);

    expect(container.innerHTML).toBe("");
  });

  // ---------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------

  it("shows correct message for 7 days remaining", () => {
    render(<TrialBanner trialEnd={trialEndInDays(7)} onUpgrade={vi.fn()} />);

    expect(
      screen.getByText("Your trial ends in 7 days. Upgrade to keep your data and full access."),
    ).toBeInTheDocument();
  });

  it("shows correct message for 3 days remaining", () => {
    render(<TrialBanner trialEnd={trialEndInDays(3)} onUpgrade={vi.fn()} />);

    expect(
      screen.getByText(
        "Your trial ends in 3 days. Choose a plan to continue without interruption.",
      ),
    ).toBeInTheDocument();
  });

  it("shows correct message for 1 day remaining", () => {
    render(<TrialBanner trialEnd={trialEndInDays(1)} onUpgrade={vi.fn()} />);

    expect(
      screen.getByText("Your trial ends tomorrow. Upgrade now to avoid losing access to features."),
    ).toBeInTheDocument();
  });

  it("shows default message for 5 days remaining", () => {
    render(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />);

    expect(
      screen.getByText("Your trial ends in 5 days. Upgrade to keep your data and full access."),
    ).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Interactions
  // ---------------------------------------------------------------------------

  it("calls onUpgrade when 'Choose a plan' button is clicked", () => {
    const onUpgrade = vi.fn();

    render(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={onUpgrade} />);

    fireEvent.click(screen.getByRole("button", { name: "Choose a plan" }));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });

  it("hides the banner when dismiss button is clicked", () => {
    render(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss trial banner" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------

  it("has role='alert' for accessibility", () => {
    render(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("has aria-live='polite'", () => {
    render(<TrialBanner trialEnd={trialEndInDays(5)} onUpgrade={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
  });
});
