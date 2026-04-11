import { render, screen, setup } from "@/test/test-utils";
import { TimesheetHeader } from "../timesheet-header";

describe("TimesheetHeader", () => {
  const defaultProps = {
    weekStartDate: new Date("2025-03-03"), // Monday
    status: "DRAFT" as const,
    totalMinutes: 2400,
    onWeekChange: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders week label", () => {
    render(<TimesheetHeader {...defaultProps} />);
    // Mar 3 - Mar 9, 2025
    expect(screen.getByText(/Mar 3/)).toBeInTheDocument();
  });

  it("renders total hours", () => {
    render(<TimesheetHeader {...defaultProps} />);
    // 2400 / 60 = 40h
    expect(screen.getByText("40h")).toBeInTheDocument();
  });

  it("renders fractional hours with one decimal", () => {
    render(<TimesheetHeader {...defaultProps} totalMinutes={90} />);
    expect(screen.getByText("1.5h")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<TimesheetHeader {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Submit Timesheet" }),
    ).toBeInTheDocument();
  });

  it("disables submit when status is SUBMITTED", () => {
    render(<TimesheetHeader {...defaultProps} status="SUBMITTED" />);
    expect(
      screen.getByRole("button", { name: "Submit Timesheet" }),
    ).toBeDisabled();
  });

  it("disables submit when status is APPROVED", () => {
    render(<TimesheetHeader {...defaultProps} status="APPROVED" />);
    expect(
      screen.getByRole("button", { name: "Submit Timesheet" }),
    ).toBeDisabled();
  });

  it("enables submit when status is REJECTED with minutes > 0", () => {
    render(<TimesheetHeader {...defaultProps} status="REJECTED" />);
    expect(
      screen.getByRole("button", { name: "Submit Timesheet" }),
    ).toBeEnabled();
  });

  it("disables submit when totalMinutes is 0", () => {
    render(<TimesheetHeader {...defaultProps} totalMinutes={0} />);
    expect(
      screen.getByRole("button", { name: "Submit Timesheet" }),
    ).toBeDisabled();
  });

  it("shows submitting text when isSubmitting is true", () => {
    render(<TimesheetHeader {...defaultProps} isSubmitting />);
    expect(
      screen.getByRole("button", { name: "Submitting..." }),
    ).toBeDisabled();
  });

  it("calls onWeekChange with previous week on prev click", async () => {
    const onWeekChange = vi.fn();
    const { user } = setup(
      <TimesheetHeader {...defaultProps} onWeekChange={onWeekChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(onWeekChange).toHaveBeenCalledTimes(1);
    const arg = onWeekChange.mock.calls[0][0] as Date;
    expect(arg.getDate()).toBe(24); // Feb 24
  });

  it("calls onWeekChange with next week on next click", async () => {
    const onWeekChange = vi.fn();
    const { user } = setup(
      <TimesheetHeader {...defaultProps} onWeekChange={onWeekChange} />,
    );
    await user.click(screen.getByRole("button", { name: "Next week" }));
    expect(onWeekChange).toHaveBeenCalledTimes(1);
    const arg = onWeekChange.mock.calls[0][0] as Date;
    expect(arg.getDate()).toBe(10); // Mar 10
  });

  it("renders status badge", () => {
    render(<TimesheetHeader {...defaultProps} status="DRAFT" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
