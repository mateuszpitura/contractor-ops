import { render, screen } from "@/test/test-utils";
import { TimeEntryStatusBadge } from "../time-entry-status-badge";

describe("TimeEntryStatusBadge", () => {
  it.each([
    { status: "DRAFT" as const, label: "Draft" },
    { status: "SUBMITTED" as const, label: "Submitted" },
    { status: "APPROVED" as const, label: "Approved" },
    { status: "REJECTED" as const, label: "Rejected" },
  ])("renders $status with label '$label'", ({ status, label }) => {
    render(<TimeEntryStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders DRAFT with info variant", () => {
    const { container } = render(<TimeEntryStatusBadge status="DRAFT" />);
    const badge = container.querySelector("[data-slot='badge']") ?? container.firstElementChild;
    expect(badge?.className).toContain("bg-blue");
  });

  it("renders REJECTED with destructive variant", () => {
    const { container } = render(<TimeEntryStatusBadge status="REJECTED" />);
    const badge = container.querySelector("[data-slot='badge']") ?? container.firstElementChild;
    expect(badge?.className).toContain("destructive");
  });
});
