import { render, screen } from "@/test/test-utils";
import { AuditLogDiffViewer } from "../audit-log-diff-viewer";

describe("AuditLogDiffViewer", () => {
  it("shows noChanges when both values are null", () => {
    render(<AuditLogDiffViewer oldValues={null} newValues={null} />);
    expect(screen.getByText("No field changes recorded")).toBeInTheDocument();
  });

  it("shows noChanges when values are identical", () => {
    const vals = { name: "Acme" };
    render(<AuditLogDiffViewer oldValues={vals} newValues={vals} />);
    expect(screen.getByText("No field changes recorded")).toBeInTheDocument();
  });

  it("renders before/after columns for changed fields", () => {
    render(<AuditLogDiffViewer oldValues={{ name: "Old" }} newValues={{ name: "New" }} />);
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    expect(screen.getByText("Old")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("displays field keys as labels", () => {
    render(
      <AuditLogDiffViewer oldValues={{ email: "a@b.com" }} newValues={{ email: "c@d.com" }} />,
    );
    const fieldLabels = screen.getAllByText(/email:/i);
    expect(fieldLabels.length).toBe(2);
  });

  it("handles null old values with non-null new values", () => {
    render(<AuditLogDiffViewer oldValues={null} newValues={{ status: "active" }} />);
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("null")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });
});
