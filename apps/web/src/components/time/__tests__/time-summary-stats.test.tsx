import { render, screen } from "@/test/test-utils";
import { TimeSummaryStats } from "../time-summary-stats";

describe("TimeSummaryStats", () => {
  it("renders three summary cards", () => {
    render(
      <TimeSummaryStats
        currentWeekMinutes={480}
        pendingCount={2}
        approvedMonthMinutes={3600}
      />,
    );
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("Pending Review")).toBeInTheDocument();
    expect(screen.getByText("Approved This Month")).toBeInTheDocument();
  });

  it("formats whole hours without decimal", () => {
    render(
      <TimeSummaryStats
        currentWeekMinutes={480}
        pendingCount={0}
        approvedMonthMinutes={3600}
      />,
    );
    expect(screen.getByText("8h")).toBeInTheDocument();
    expect(screen.getByText("60h")).toBeInTheDocument();
  });

  it("formats fractional hours with one decimal", () => {
    render(
      <TimeSummaryStats
        currentWeekMinutes={90}
        pendingCount={0}
        approvedMonthMinutes={150}
      />,
    );
    expect(screen.getByText("1.5h")).toBeInTheDocument();
    expect(screen.getByText("2.5h")).toBeInTheDocument();
  });

  it("renders pending count as number", () => {
    render(
      <TimeSummaryStats
        currentWeekMinutes={0}
        pendingCount={5}
        approvedMonthMinutes={0}
      />,
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders loading skeletons when isLoading is true", () => {
    const { container } = render(
      <TimeSummaryStats
        currentWeekMinutes={0}
        pendingCount={0}
        approvedMonthMinutes={0}
        isLoading
      />,
    );
    // Should not render the actual labels
    expect(screen.queryByText("This Week")).not.toBeInTheDocument();
    // Should render skeleton placeholders
    const skeletons = container.querySelectorAll("[data-slot='skeleton']");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
