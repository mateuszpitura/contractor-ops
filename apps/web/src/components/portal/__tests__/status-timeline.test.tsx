import { render, screen } from "@/test/test-utils";
import { StatusTimeline, StatusTimelineSkeleton } from "../status-timeline";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StatusTimeline", () => {
  const defaultProps = {
    status: "RECEIVED",
    approvalStatus: "PENDING",
    paymentStatus: "NONE",
  };

  // -------------------------------------------------------------------------
  // Step labels
  // -------------------------------------------------------------------------

  it("renders all 5 step labels", () => {
    render(<StatusTimeline {...defaultProps} />);

    expect(screen.getAllByText("Submitted")).toHaveLength(2); // desktop + mobile
    expect(screen.getAllByText("In Review")).toHaveLength(2);
    expect(screen.getAllByText("Approved")).toHaveLength(2);
    expect(screen.getAllByText("Payment Scheduled")).toHaveLength(2);
    expect(screen.getAllByText("Paid")).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Active step states
  // -------------------------------------------------------------------------

  it("highlights submitted as active for RECEIVED status", () => {
    const { container } = render(<StatusTimeline {...defaultProps} />);

    // Active step (index 0 = Submitted) should have primary pulse
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);

    // No green (past) circles should exist — step 0 is active, none before it
    const greenCircles = container.querySelectorAll(".bg-green-600");
    expect(greenCircles).toHaveLength(0);
  });

  it("shows first 2 steps as green and 3rd as active for APPROVED", () => {
    render(
      <StatusTimeline
        status="UNDER_REVIEW"
        approvalStatus="APPROVED"
        paymentStatus="NONE"
      />,
    );

    // Active step index = 2 (Approved), so steps 0 (Submitted) and 1 (In Review) are past
    // Past step labels should have green text
    const submittedLabels = screen.getAllByText("Submitted");
    const reviewLabels = screen.getAllByText("In Review");
    for (const el of [...submittedLabels, ...reviewLabels]) {
      expect(el.className).toContain("text-green");
    }

    // Active step (Approved) should have primary text
    const approvedLabels = screen.getAllByText("Approved");
    for (const el of approvedLabels) {
      expect(el.className).toContain("text-primary");
    }

    // Future steps should have muted text
    const paidLabels = screen.getAllByText("Paid");
    for (const el of paidLabels) {
      expect(el.className).toContain("text-muted-foreground");
    }
  });

  it("shows all steps as green for PAID", () => {
    render(
      <StatusTimeline
        status="UNDER_REVIEW"
        approvalStatus="APPROVED"
        paymentStatus="PAID"
      />,
    );

    // Active step index = 4 (all steps are past), so all labels should be green
    const allLabels = [
      ...screen.getAllByText("Submitted"),
      ...screen.getAllByText("In Review"),
      ...screen.getAllByText("Approved"),
      ...screen.getAllByText("Payment Scheduled"),
    ];
    for (const el of allLabels) {
      expect(el.className).toContain("text-green");
    }
  });

  // -------------------------------------------------------------------------
  // Rejected state
  // -------------------------------------------------------------------------

  it("shows destructive styling on step 1 when rejected", () => {
    const { container } = render(
      <StatusTimeline
        {...defaultProps}
        rejectedAt="2026-04-01T00:00:00Z"
      />,
    );

    const destructiveCircles = container.querySelectorAll(".bg-destructive");
    // Desktop + mobile = 2
    expect(destructiveCircles.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  it("renders both desktop and mobile layouts with role list", () => {
    render(<StatusTimeline {...defaultProps} />);

    const lists = screen.getAllByRole("list");
    expect(lists).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // Skeleton
  // -------------------------------------------------------------------------

  it("renders skeleton without error", () => {
    const { container } = render(<StatusTimelineSkeleton />);

    expect(container.firstChild).toBeInTheDocument();
  });
});
