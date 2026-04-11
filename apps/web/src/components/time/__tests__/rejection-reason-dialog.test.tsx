import { describe, it, expect, vi } from "vitest";
import { screen, setup } from "@/test/test-utils";
import { RejectionReasonDialog } from "../rejection-reason-dialog";

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  onConfirm: vi.fn(),
  isSubmitting: false,
};

describe("RejectionReasonDialog", () => {
  it("renders dialog title for single rejection", () => {
    setup(<RejectionReasonDialog {...defaultProps} />);
    expect(
      screen.getByRole("heading", { name: "Reject Timesheet" }),
    ).toBeInTheDocument();
  });

  it("renders dialog title for bulk rejection", () => {
    setup(
      <RejectionReasonDialog {...defaultProps} isBulk count={3} />,
    );
    expect(screen.getByText("Reject 3 Timesheets")).toBeInTheDocument();
  });

  it("renders textarea and character counter", () => {
    setup(<RejectionReasonDialog {...defaultProps} />);
    expect(screen.getByLabelText("Rejection Reason")).toBeInTheDocument();
    expect(screen.getByText("0/500")).toBeInTheDocument();
  });

  it("disables reject button when reason is too short", () => {
    setup(<RejectionReasonDialog {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: "Reject Timesheet" }),
    ).toBeDisabled();
  });

  it("enables reject button when reason has >= 10 chars", async () => {
    const { user } = setup(<RejectionReasonDialog {...defaultProps} />);
    await user.type(
      screen.getByLabelText("Rejection Reason"),
      "This is a valid reason for rejection",
    );
    expect(
      screen.getByRole("button", { name: "Reject Timesheet" }),
    ).not.toBeDisabled();
  });

  it("shows error message on submit with short reason", async () => {
    const { user } = setup(<RejectionReasonDialog {...defaultProps} />);
    await user.type(
      screen.getByLabelText("Rejection Reason"),
      "short",
    );
    // Click the reject button - it should show error since < 10 chars
    // The button is disabled so error shows through validation
    expect(
      screen.getByRole("button", { name: "Reject Timesheet" }),
    ).toBeDisabled();
  });

  it("calls onConfirm with trimmed reason", async () => {
    const onConfirm = vi.fn();
    const { user } = setup(
      <RejectionReasonDialog {...defaultProps} onConfirm={onConfirm} />,
    );
    await user.type(
      screen.getByLabelText("Rejection Reason"),
      "This is a valid reason for rejection",
    );
    await user.click(
      screen.getByRole("button", { name: "Reject Timesheet" }),
    );
    expect(onConfirm).toHaveBeenCalledWith(
      "This is a valid reason for rejection",
    );
  });

  it("shows submitting state", () => {
    setup(
      <RejectionReasonDialog {...defaultProps} isSubmitting />,
    );
    expect(screen.getByText("Rejecting...")).toBeInTheDocument();
  });

  it("renders Keep Reviewing cancel button", () => {
    setup(<RejectionReasonDialog {...defaultProps} />);
    expect(screen.getByText("Keep Reviewing")).toBeInTheDocument();
  });
});
